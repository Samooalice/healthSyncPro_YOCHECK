// TrendChart — 측정 추세(SVG) + 정상범위 밴드 + 현재 수치. 상태 없음(서버/클라 공용).
// 서버 컴포넌트와 클라이언트 컴포넌트 양쪽에서 쓰이므로 훅을 직접 부르지 않고
// 번역 함수를 주입받는다(호출부에서 getTranslations/useTranslations 로 얻은 t).
import type { Translate } from "@/i18n/t";

export interface TrendPoint {
  date: string;
  value: number;
}

export default function TrendChart({
  t,
  data,
  analyteLabel,
  color = "#2E5A88",
  normal,
  unit,
  valueFormat,
}: {
  t: Translate;
  data: TrendPoint[];
  analyteLabel: string;
  color?: string;
  normal?: [number, number];
  unit?: string;
  valueFormat?: (v: number) => string;
}) {
  if (!data || data.length === 0) {
    return <div className="py-6 text-center text-sm text-gray-400">{t("chart.noData")}</div>;
  }

  const W = 320, H = 110, padX = 10, padTop = 16, padBottom = 22;
  const vals = data.map((d) => d.value);
  const lo = Math.min(...vals, normal ? normal[0] : Infinity);
  const hi = Math.max(...vals, normal ? normal[1] : -Infinity);
  let min = Math.min(lo, normal ? normal[0] : lo);
  let max = Math.max(hi, normal ? normal[1] : hi);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min || 1;
  const n = data.length;

  const x = (i: number) => (n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1));
  const y = (v: number) => H - padBottom - ((v - min) / span) * (H - padTop - padBottom);

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const last = data[n - 1];
  const fmtDate = (s: string) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };
  const numFmt = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(v < 2 ? 3 : 1));
  const fmt = valueFormat ?? ((v: number) => `${numFmt(v)}${unit ? ` ${unit}` : ""}`);
  const showNormalText = normal && normal[0] !== normal[1];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-500">{t("chart.trendOf", { name: analyteLabel })}</span>
        <span className="text-gray-700">
          {t("chart.current")} <b style={{ color }}>{fmt(last.value)}</b>
          {showNormalText && <span className="text-gray-400"> · {t("result.normalInline", { normal: `${fmt(normal![0])}~${fmt(normal![1])}` })}</span>}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 130 }}>
        {/* 정상범위 밴드 */}
        {normal && (
          <>
            <rect x={0} y={y(normal[1])} width={W} height={Math.max(1, y(normal[0]) - y(normal[1]))}
              fill="#2E9E5B" opacity={0.08} />
            <line x1={0} y1={y(normal[1])} x2={W} y2={y(normal[1])} stroke="#2E9E5B" strokeWidth={0.6} strokeDasharray="3 3" opacity={0.5} />
            {normal[0] !== normal[1] && (
              <line x1={0} y1={y(normal[0])} x2={W} y2={y(normal[0])} stroke="#2E9E5B" strokeWidth={0.6} strokeDasharray="3 3" opacity={0.5} />
            )}
          </>
        )}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={3} fill="#fff" stroke={color} strokeWidth={2} />
        ))}
        {/* 마지막 점 값 라벨 */}
        <text x={x(n - 1)} y={y(last.value) - 7} textAnchor="middle" fontSize={10} fontWeight={700} fill={color}>
          {fmt(last.value)}
        </text>
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{fmtDate(data[0].date)}</span>
        {n > 1 && <span>{fmtDate(data[n - 1].date)}</span>}
      </div>
    </div>
  );
}
