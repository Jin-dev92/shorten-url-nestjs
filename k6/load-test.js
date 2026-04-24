import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const redirectDuration = new Trend('redirect_duration', true);

// 테스트 시나리오: 점진적 부하 증가 후 피크 유지
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // 워밍업
    { duration: '1m', target: 200 },   // 부하 증가
    { duration: '2m', target: 200 },   // 피크 유지
    { duration: '30s', target: 0 },    // 정리
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95%ile 200ms 이하
    errors: ['rate<0.01'],             // 에러율 1% 미만
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// 사전에 생성된 단축 키 목록 (테스트 전 setup에서 생성)
let shortKeys = [];

export function setup() {
  const keys = [];
  for (let i = 0; i < 20; i++) {
    const res = http.post(
      `${BASE_URL}/shorten`,
      JSON.stringify({ originalUrl: `https://www.example.com/page/${i}` }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (res.status === 201) {
      const body = JSON.parse(res.body);
      keys.push(body.shortUrl.split('/').pop());
    }
  }
  return { keys };
}

export default function (data) {
  const keys = data.keys;
  if (!keys.length) return;

  // 80% 조회, 20% 생성 (실제 트래픽 패턴 근사)
  if (Math.random() < 0.8) {
    const key = keys[Math.floor(Math.random() * keys.length)];
    const start = Date.now();
    const res = http.get(`${BASE_URL}/${key}`, { redirects: 0 });
    redirectDuration.add(Date.now() - start);

    const ok = check(res, {
      '302 리다이렉트': (r) => r.status === 302,
      'Location 헤더 존재': (r) => r.headers['Location'] !== undefined,
    });
    errorRate.add(!ok);
  } else {
    const res = http.post(
      `${BASE_URL}/shorten`,
      JSON.stringify({ originalUrl: `https://www.example.com/dynamic/${Date.now()}` }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    check(res, { '201 생성': (r) => r.status === 201 });
  }

  sleep(0.1);
}
