import Link from 'next/link';

export default function AdminUnauthorizedPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-600">
          Akses ditolak
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[#1a3a2e]">
          Role Anda tidak memiliki izin untuk halaman ini
        </h1>
        <p className="mt-3 text-sm text-gray-500">
          Silakan kembali ke dashboard atau login dengan akun yang memiliki hak akses sesuai.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/admin"
            className="rounded-md bg-[#1a3a2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132a21]"
          >
            Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
