import type { NextConfig } from "next";

// 전역 보안 헤더 (보안 13장). 인라인 스타일/HMR을 깨지 않도록 default-src는 두지 않고,
// 클릭재킹·MIME스니핑·레퍼러 유출·object/base 주입 등 안전한 강화만 적용.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), browsing-topics=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // 서버 핑거프린팅 표면 축소
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
