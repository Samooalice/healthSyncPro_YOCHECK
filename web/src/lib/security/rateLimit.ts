// 간이 레이트 리미터 (보안 13장) — 인메모리 슬라이딩 윈도. 데모/단일 인스턴스 기준.
// 운영(다중 인스턴스)에선 Redis 등 공유 저장소 기반으로 교체한다.
interface Bucket { hits: number[]; }
const store = new Map<string, Bucket>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * key 기준 windowMs 동안 limit회 허용. 초과 시 allowed=false.
 * @param key   식별자(예: `login:email` 또는 `login:ip`)
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const b = store.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    store.set(key, b);
    const oldest = b.hits[0];
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }
  b.hits.push(now);
  store.set(key, b);
  return { allowed: true, remaining: limit - b.hits.length, retryAfterSec: 0 };
}

/** 성공 시 카운터 리셋(예: 로그인 성공). */
export function rateLimitReset(key: string) {
  store.delete(key);
}
