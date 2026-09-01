// DB 콘텐츠(care.content) 다국어 조회.
//
// 기준어(ko)는 care.content 본체에, 번역은 care.content_i18n 에 둔다(마이그레이션 0008).
// Prisma 모델을 재생성하지 않아도 동작하도록 원시 SQL 로 조회하고,
// 테이블이 아직 없거나(마이그레이션 전) 조회에 실패하면 조용히 ko 로 폴백한다.
// → 마이그레이션 적용 전후 어느 쪽에서도 화면이 깨지지 않는다.
import { prisma } from "@/lib/db";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

export interface ContentText {
  title: string;
  body: string | null;
  payload: unknown;
}

/**
 * content_i18n 미적용(테이블 없음)으로 판정되면 이후 요청에서 조회를 건너뛴다.
 * ⚠️ 다른 원인의 실패(쿼리 버그·일시적 장애)까지 여기서 꺼 버리면 번역이 조용히
 *    영구 비활성화된다. 그래서 "relation does not exist"(42P01)일 때만 끈다.
 */
let tableMissing = false;

/**
 * PostgreSQL 42P01 = undefined_table.
 * Prisma 가 드라이버 오류를 감싸 code 를 잃는 경우가 있어 메시지도 함께 본다
 * (Postgres 서버 메시지는 영어 기준 — lc_messages 를 바꿨다면 code 로만 판정된다).
 */
function isMissingTable(e: unknown): boolean {
  if ((e as { code?: string })?.code === "42P01") return true;
  const msg = String((e as Error)?.message ?? "");
  return msg.includes("content_i18n") && msg.includes("does not exist");
}

/**
 * 콘텐츠 id 목록 → 해당 로케일 번역 맵.
 * 기준어이거나 번역이 없으면 빈 맵을 돌려주고, 호출부가 ko 원문을 그대로 쓴다.
 */
export async function contentTranslations(
  locale: Locale,
  ids: string[],
): Promise<Map<string, ContentText>> {
  const out = new Map<string, ContentText>();
  if (locale === DEFAULT_LOCALE || ids.length === 0 || tableMissing) return out;
  try {
    const rows = await prisma.$queryRaw<
      { content_id: string; title: string; body: string | null; payload: unknown }[]
    >`SELECT content_id, title, body, payload
        FROM care.content_i18n
       WHERE locale = ${locale} AND content_id = ANY(${ids}::varchar[])`;
    for (const r of rows) {
      out.set(r.content_id, { title: r.title, body: r.body, payload: r.payload });
    }
  } catch (e) {
    // 어느 경우든 화면은 기준어(ko)로 계속 진행한다 — 콘텐츠가 비어 보이지 않게.
    if (isMissingTable(e)) {
      // 마이그레이션 0008 미적용. 이후 요청에서는 조회 자체를 건너뛴다.
      tableMissing = true;
    } else {
      // 그 외 실패는 끄지 않고 남긴다(다음 요청에서 다시 시도).
      console.error(JSON.stringify({
        ts: new Date().toISOString(), level: "error",
        event: "content_i18n_query_failed", locale,
        message: (e as Error)?.message,
      }));
    }
  }
  return out;
}

/** 단건 조회 헬퍼. */
export async function contentTranslation(
  locale: Locale,
  id: string,
): Promise<ContentText | null> {
  const m = await contentTranslations(locale, [id]);
  return m.get(id) ?? null;
}

/** ko 원문 + 번역 → 화면에 쓸 문구. 번역이 비어 있으면 항목 단위로 ko 를 쓴다. */
export function applyTranslation<T extends { title: string; body?: string | null; payload?: unknown }>(
  base: T,
  tr: ContentText | undefined | null,
): T {
  if (!tr) return base;
  return {
    ...base,
    title: tr.title || base.title,
    body: tr.body ?? base.body,
    payload: tr.payload ?? base.payload,
  };
}
