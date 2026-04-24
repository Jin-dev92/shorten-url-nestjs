const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = BigInt(CHARS.length);

export function encode(id: bigint): string {
  if (id === 0n) return CHARS[0];

  let result = '';
  let n = id;
  while (n > 0n) {
    result = CHARS[Number(n % BASE)] + result;
    n = n / BASE;
  }
  return result;
}
