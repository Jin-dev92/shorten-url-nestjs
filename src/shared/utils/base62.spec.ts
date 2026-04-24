import { encode } from './base62';

describe('encode()', () => {
  afterEach(() => jest.clearAllMocks());

  describe('경계값', () => {
    it('0을 인코딩하면 "0"을 반환한다', () => {
      expect(encode(0n)).toBe('0');
    });

    it('61을 인코딩하면 마지막 단일 문자 "Z"를 반환한다', () => {
      expect(encode(61n)).toBe('Z');
    });

    it('62를 인코딩하면 자릿수가 늘어나 "10"을 반환한다', () => {
      expect(encode(62n)).toBe('10');
    });
  });

  describe('일관성', () => {
    it('동일한 입력에 대해 항상 같은 결과를 반환한다', () => {
      expect(encode(12345n)).toBe(encode(12345n));
    });

    it('순차 ID 100개에 대해 중복 없이 고유한 키를 생성한다', () => {
      // Arrange
      const ids = Array.from({ length: 100 }, (_, i) => BigInt(i + 1));

      // Act
      const keys = ids.map(encode);

      // Assert
      expect(new Set(keys).size).toBe(100);
    });
  });

  describe('길이', () => {
    it('10억 ID도 6자리 이내의 단축 키를 생성한다', () => {
      expect(encode(1_000_000_000n).length).toBeLessThanOrEqual(6);
    });
  });
});
