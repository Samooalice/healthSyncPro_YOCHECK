// 번역 함수 타입 — 서버(getTranslations)/클라이언트(useTranslations) 양쪽에서
// 같은 순수 함수를 재사용하기 위해, 라이브러리 훅에 의존하지 않고 t 를 주입받는다.
// 네임스페이스 없이 얻은 전역 translator 를 넘기므로 키는 "analyte.protein" 같은 전체 경로다.
export type Translate = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;
