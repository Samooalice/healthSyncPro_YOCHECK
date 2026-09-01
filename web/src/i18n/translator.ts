import "server-only";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, type Locale } from "./config";
import type { Translate } from "./t";

// 요청 컨텍스트 밖(분석 파이프라인·배치 스크립트)에서 쓰는 번역기.
// getTranslations() 는 요청 스코프를 전제로 하므로, 파이프라인처럼 백그라운드에서
// 특정 언어로 문장을 만들어야 할 때는 이 함수를 쓴다.
export async function translatorFor(locale: Locale = DEFAULT_LOCALE): Promise<Translate> {
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, onError() {} });
  return ((key: string, values?: Record<string, string | number | Date>) => {
    try {
      // 키가 없으면 예외 대신 키 경로를 돌려준다(호출부의 폴백 판정과 동일 규약).
      return t(key as never, values as never) as unknown as string;
    } catch {
      return key;
    }
  }) as Translate;
}
