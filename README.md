# URL Shortener

NestJS + PostgreSQL + Redis로 만든 URL 단축 서비스. 단순히 기능 구현에 그치지 않고, 실제 트래픽이 몰리는 환경에서 어떤 선택을 해야 하는지를 직접 검증해보고 싶어서 시작한 프로젝트다.

---

## 아키텍처

DDD 기반의 헥사고날 아키텍처를 적용했다.

```
src/
├── common/            ← 전역 상수, 필터
├── config/            ← DB 설정, TypeORM CLI DataSource
├── shared/utils/      ← Base62 인코딩 유틸
└── url/
    ├── domain/        ← 엔티티, 리포지토리 인터페이스(포트), 예외
    ├── application/   ← 유스케이스, 캐시 포트
    ├── infrastructure/← TypeORM 구현체, Redis 캐시 구현체
    └── presentation/  ← 컨트롤러, DTO
```

도메인 레이어가 인프라에 의존하지 않는 구조다. TypeORM을 Redis로 교체하거나, PostgreSQL을 다른 DB로 바꿔도 도메인 코드는 손대지 않아도 된다. 테스트할 때도 실제 구현체 대신 목(mock)만 갈아끼우면 돼서 단위 테스트가 훨씬 편해진다.

---

## 주요 기술 결정

### PK — UUID vs BigInt

처음엔 UUID를 고려했다. 전역 고유성이 보장되고 ID 추측이 어렵다는 이점이 있다. 근데 UUID는 랜덤값이라 삽입할 때마다 B-Tree 인덱스 페이지가 순서 없이 분산된다. 레코드가 쌓일수록 페이지 분할이 잦아지고 인덱스 크기도 BigInt 대비 2~4배 커진다.

BigInt auto-increment는 값이 순차적으로 증가하니까 삽입이 항상 인덱스 끝에 붙는다. 페이지 분할이 거의 없고 인덱스가 조밀하게 유지된다. 단축 키 자체는 어차피 별도 생성하기 때문에 ID가 노출될 일도 없다. 대용량을 가정한 프로젝트인 만큼 BigInt를 선택했다.

### 단축 키 생성 — 충돌 없는 랜덤 키

초기엔 DB auto-increment ID를 Base62로 인코딩해서 단축 키로 쓰는 방식을 택했다. ID가 유일하니 충돌 걱정이 없고 구현도 간단하다.

근데 k6 부하 테스트를 돌려보니 POST /shorten이 200 VU 동시 요청 기준 65%나 실패했다. 원인을 파악해보니 INSERT 시점에 `short_key`를 빈 문자열로 임시 저장하고, ID를 받아온 뒤 UPDATE하는 2단계 구조였는데, 동시 요청이 몰리면서 빈 문자열끼리 unique 제약이 충돌하는 거였다.

결국 방식을 바꿨다. `crypto.randomBytes(6)`으로 48비트 랜덤값을 생성해 Base62 인코딩한 키를 먼저 만들고, 처음부터 키를 포함해서 단일 INSERT한다. 충돌이 발생하면(PostgreSQL 에러코드 `23505`) 최대 5회 재시도한다. 48비트면 경우의 수가 약 281조라 실제로 재시도가 발생할 확률은 거의 없다.

```
변경 전: INSERT (short_key='') → UPDATE (short_key=encode(id))  -- DB 왕복 2번, 동시성 충돌
변경 후: INSERT (short_key=random)                               -- DB 왕복 1번, 충돌 없음
```

### 인덱스 설계

```sql
-- 리다이렉트 조회의 핵심 경로. 모든 GET /:shortKey 요청이 여기를 거침
CREATE UNIQUE INDEX ON urls (short_key);

-- 만료 URL 정리 스케줄러용. 만료 기간이 없는 URL(NULL)은 대상이 아니라서 partial index로 처리
CREATE INDEX ON urls (expires_at) WHERE expires_at IS NOT NULL;
```

### Cache-Aside + 확률적 조기 만료(PER)

조회마다 PostgreSQL을 직접 조회하면 트래픽이 몰릴 때 DB 커넥션이 병목이 된다. Redis를 먼저 확인하고, 캐시 미스일 때만 DB를 조회하는 Cache-Aside 패턴을 적용했다.

여기서 **캐시 쇄도(Cache Stampede)** 문제가 따라온다. 인기 URL의 캐시가 만료되는 순간 대기하던 수백 개의 요청이 동시에 DB로 쏟아지는 상황이다. 분산 락(SETNX)도 검토했는데, 락을 잡지 못한 요청이 대기하거나 재시도를 반복해야 한다. URL 리다이렉트는 응답 지연에 민감한데 락 대기가 레이턴시로 직결되는 게 마음에 걸렸다.

대신 **확률적 조기 만료(Probabilistic Early Expiration)** 방식을 선택했다. TTL이 얼마 안 남은 시점부터 요청마다 일정 확률로 캐시를 미리 갱신한다. 만료 직전에 갱신이 자연스럽게 분산되니까 실제 만료 순간에 DB에 부하가 몰리지 않는다. 단축 URL의 원본 주소는 생성 후 바뀌지 않으니까 갱신 타이밍에 약간의 편차가 생겨도 정합성 문제가 없다.

### 조회수 — Redis INCR + 배치 sync

조회가 발생할 때마다 DB에 UPDATE를 날리면 고트래픽에서 쓰기 부하가 상당하다. Redis `INCR`로 메모리에 카운터를 쌓아두고, 30초 간격 스케줄러로 DB에 일괄 반영한다. 실시간 집계가 필요하다면 구조를 바꿔야겠지만, 이 서비스에서는 약간의 지연이 허용 가능하다고 판단했다.

### 301 vs 302

기본은 302로 가져갔다. 301은 브라우저가 응답을 캐싱해서 이후 요청이 서버를 거치지 않으니 서버 부하는 낮아지지만 조회수 트래킹이 불가능하다. 302는 매번 서버를 거치니 트래킹은 되지만 트래픽이 높을수록 부하가 누적된다. 핫 URL을 감지해서 동적으로 301로 전환하는 방식을 나중에 고려하고 있다.

---

## 부하 테스트 결과

> k6, 로컬 환경(M-series Mac), 200 VU 기준

**시나리오:** 워밍업(30s) → 부하 증가(1m, 0→200 VU) → 피크 유지(2m, 200 VU) → 정리(30s)

**트래픽 구성:** 리다이렉트(GET) 80% / 단축 URL 생성(POST) 20%

| 지표 | 결과 | 목표 |
|------|------|------|
| 처리량 | 1,417 req/s | - |
| p95 응답시간 | 8.5ms | 200ms 이하 |
| redirect p95 | 7ms | - |
| 에러율 | 0.00% | 1% 미만 |
| 총 요청 수 | 340,246건 / 4분 | - |

---

## 기술 스택

| | |
|--|--|
| Framework | NestJS 11 |
| DB | PostgreSQL 16 + TypeORM |
| Cache | Redis 7 |
| Infra | Docker Compose |
| Docs | Swagger (`/api-docs`) |
| Test | Jest, Supertest, k6 |

---

## 실행 방법

```bash
# 인프라 실행
docker-compose up -d

# 환경변수 설정
cp .env.example .env

# 개발 서버
npm run start:dev

# Swagger
open http://localhost:3000/api-docs
```

**DB 마이그레이션**

```bash
npm run migration:run    # 스키마 적용
npm run migration:revert # 롤백
```

**테스트**

```bash
npm test          # 단위 테스트
npm run test:e2e  # E2E 테스트
k6 run k6/load-test.js  # 부하 테스트
```
