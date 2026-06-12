// 404 페이지 (품질) — 존재하지 않는 경로 안내.
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 text-5xl font-bold text-primary">404</div>
      <h1 className="text-xl font-bold text-ink">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-sm text-body">주소가 바뀌었거나 삭제된 페이지일 수 있어요.</p>
      <Link href="/" className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700">홈으로</Link>
    </main>
  );
}
