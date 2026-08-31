import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "./config";
import { getUserLocale } from "./locale";

// next-intl 요청 설정 — URL 접두사 없이 쿠키에서 로케일을 읽는다.
// 번역 누락 시 ko 원문으로 폴백한다(빈 화면 방지). Phase 3 진행 중에도
// 화면이 깨지지 않게 하려는 의도이며, 누락 자체는 i18n_scan.py 가 잡는다.
export default getRequestConfig(async () => {
  const locale = await getUserLocale();

  const [messages, fallback] = await Promise.all([
    import(`../../messages/${locale}.json`).then((m) => m.default),
    locale === DEFAULT_LOCALE
      ? Promise.resolve(null)
      : import(`../../messages/${DEFAULT_LOCALE}.json`).then((m) => m.default),
  ]);

  return {
    locale,
    messages: fallback ? deepMerge(fallback, messages) : messages,
    // 번역 키가 없을 때 앱을 죽이지 않고 키 경로를 그대로 노출한다.
    onError() {},
    getMessageFallback({ key, namespace }) {
      return namespace ? `${namespace}.${key}` : key;
    },
  };
});

type Tree = { [k: string]: string | Tree };

/** base(ko) 위에 target 을 덮어써 부분 번역을 허용한다. */
function deepMerge(base: Tree, target: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(target)) {
    const b = out[k];
    if (v && typeof v === "object" && b && typeof b === "object") {
      out[k] = deepMerge(b as Tree, v as Tree);
    } else if (v !== "" && v != null) {
      out[k] = v;
    }
  }
  return out;
}
