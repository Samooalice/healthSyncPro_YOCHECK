// 구조화 로깅 (관측성 8장) — JSON 라인 로그. 운영에선 수집기(Datadog/CloudWatch 등)로 전송.
// PII는 절대 직접 로깅하지 않는다(가명 id·집계만).
type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  [k: string]: unknown;
}

function emit(level: Level, event: string, fields?: LogFields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, f?: LogFields) => emit("debug", event, f),
  info: (event: string, f?: LogFields) => emit("info", event, f),
  warn: (event: string, f?: LogFields) => emit("warn", event, f),
  error: (event: string, f?: LogFields) => emit("error", event, f),
};

/** 비동기 작업 실행시간을 측정해 로깅하고 결과를 반환. */
export async function timed<T>(event: string, fn: () => Promise<T>, fields?: LogFields): Promise<T> {
  const start = performance.now();
  try {
    const r = await fn();
    log.info(event, { ...fields, ms: Math.round(performance.now() - start), ok: true });
    return r;
  } catch (e) {
    log.error(event, { ...fields, ms: Math.round(performance.now() - start), ok: false, error: (e as Error).message });
    throw e;
  }
}
