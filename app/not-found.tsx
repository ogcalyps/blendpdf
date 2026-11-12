import Link from 'next/link';

// Root-level 404 — rendered for any unmatched route in any locale, so it
// carries every language inline rather than relying on next-intl context.
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md text-center py-24">
        <p className="text-6xl font-extrabold text-primary mb-4" style={{ color: '#FF6B35' }}>
          404
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-lg text-gray-700 mb-1" lang="es">
          Página no encontrada
        </p>
        <p className="text-lg text-gray-700 mb-1" lang="fr">
          Page introuvable
        </p>
        <p className="text-lg text-gray-700 mb-1" dir="rtl" lang="ar">
          الصفحة غير موجودة
        </p>
        <p className="text-gray-500 mb-8">
          The page you are looking for doesn&apos;t exist or has moved.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            className="inline-block rounded-lg px-5 py-2.5 font-semibold text-white"
            style={{ backgroundColor: '#FF6B35' }}
          >
            Go to homepage
          </Link>
          <Link
            href="/merge-pdf"
            className="inline-block rounded-lg px-5 py-2.5 font-semibold border border-gray-300 text-gray-700"
          >
            Merge PDF
          </Link>
        </div>
      </div>
    </main>
  );
}
