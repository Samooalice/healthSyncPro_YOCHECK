// 클라이언트로 내려보낼 네임스페이스 화이트리스트.
// 카탈로그 전체(약 700키)를 매 페이지 직렬화하면 낭비이므로,
// "use client" 컴포넌트가 실제로 쓰는 것만 고른다.
//
// 새 클라이언트 컴포넌트가 useTranslations("x") 를 쓰면 여기 x 를 추가해야 한다.
// 빠뜨리면 화면에 "x.key" 형태의 키 경로가 그대로 보인다(무음 실패 아님).

export const CLIENT_NAMESPACES = [
  "common",     // PrintButton 등 공용 버튼
  "nav",        // TopNav
  "auth",       // login / signup / signup·clinician
  "consent",    // 가입 폼의 동의 항목
  "license",    // 의료진 가입 폼의 면허 종류 선택
  "measure",    // 측정 화면(BLE 로그·상태)
  "phr",        // PhrUpload
  "contentView", // QuizView / ChecklistView
  "chart",      // TrendChart (클라이언트에서 렌더될 때)
  "result",     // TrendChart 가 쓰는 result.normalInline
  "errors",     // error.tsx
] as const;

type AnyMessages = Record<string, unknown>;

export function pickNamespaces(
  messages: AnyMessages,
  names: readonly string[],
): AnyMessages {
  const out: AnyMessages = {};
  for (const n of names) {
    if (n in messages) out[n] = messages[n];
  }
  return out;
}
