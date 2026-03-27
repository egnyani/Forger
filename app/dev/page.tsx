export default function DevPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Dev Links</h1>
        <div className="mt-6 space-y-2 text-sm text-slate-700">
          <a href="/preview" className="text-blue-600 underline">
            → /preview
          </a>
          <a href="/preview/test" className="text-blue-600 underline">
            → /preview/test
          </a>
          <a href="/preview/tailor-test" className="text-blue-600 underline">
            → /preview/tailor-test
          </a>
        </div>
      </div>
    </main>
  );
}
