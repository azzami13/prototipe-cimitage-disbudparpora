'use client';

import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { roleLabels, type UserRole } from "@/lib/rbac";
import { useBackendReadiness } from "@/components/providers/BackendReadinessProvider";
import { DEMO_MODE } from "@/lib/runtime-config";

const devUsers: Array<{
  role: UserRole;
  email: string;
  password: string;
}> = [
  { role: "super_admin", email: "admin@cimahiheritage.id", password: "admin123" },
  { role: "admin_operasional", email: "operasional@cimahiheritage.id", password: "admin123" },
  { role: "tour_guide", email: "guide@cimahiheritage.id", password: "admin123" },
  { role: "driver", email: "driver@cimahiheritage.id", password: "admin123" },
];

const isDevMode = process.env.NODE_ENV !== "production" && !DEMO_MODE;

const demoAccounts: Array<{ key: string; label: string; email: string; icon: string; badge: string; desc: string; highlights: string[] }> = [
  { key: "super_admin", label: "Super Admin", email: "admin@cimahiheritage.id", icon: "🛡️", badge: "Akses penuh", desc: "Mengelola seluruh sistem.", highlights: ["Dashboard & laporan", "Master data heritage, paket, Sakoci", "Graph routing, user & RBAC", "Audit log & pengaturan"] },
  { key: "admin_operasional", label: "Admin Operasional", email: "operasional@cimahiheritage.id", icon: "🗂️", badge: "Operasional", desc: "Mengurus pesanan harian.", highlights: ["Verifikasi pembayaran", "Penugasan driver/guide/Sakoci", "Monitoring trip live", "Laporan operasional"] },
  { key: "driver", label: "Driver (Asep Sunandar)", email: "driver@cimahiheritage.id", icon: "🚐", badge: "Mobile", desc: "Jadwal tugas, rute, riwayat.", highlights: ["Tugas aktif, akan datang & selesai", "Rute berurutan + peta", "Aksi perjalanan & lapor kendala", "Riwayat perjalanan"] },
  { key: "tour_guide", label: "Tour Guide (Rina Kusumawati)", email: "guide@cimahiheritage.id", icon: "🧭", badge: "Mobile", desc: "Pemanduan di setiap destinasi.", highlights: ["Tugas & sesi pemanduan", "Materi destinasi", "Catatan sesi & riwayat", "Lapor kendala"] },
  { key: "customer", label: "Customer (Dewi Anggraini)", email: "customer@cimahiheritage.id", icon: "🎒", badge: "Wisatawan", desc: "Memesan & memantau perjalanan.", highlights: ["Pesanan saya (riwayat & mendatang)", "Booking paket/sewa/privat", "Upload bukti bayar & kwitansi", "Peta Sakoci live"] },
];
const demoOthers = [
  { label: "Admin Operasional 2 (Budi)", email: "operasional2@cimahiheritage.id" },
  { label: "Driver 2 (Dedi Suryana)", email: "driver2@cimahiheritage.id" },
  { label: "Guide 2 (Nanda Permata)", email: "guide2@cimahiheritage.id" },
  { label: "Pelanggan lain", email: "pelanggan1@contoh.id" },
];

function LoginForm() {
  const { status: backendStatus } = useBackendReadiness();
  const backendReady = backendStatus === 'ready';
  const router = useRouter();
  
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [devLoadingRole, setDevLoadingRole] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(DEMO_MODE);

  const redirectAfterLogin = async () => {
    const session = await getSession();
    if (session?.accessToken) localStorage.setItem("token", session.accessToken);
    const defaultUrl = session?.user?.role === "driver"
      ? "/driver"
      : session?.user?.role === "tour_guide"
        ? "/guide"
      : session?.user?.role === "super_admin" || session?.user?.role === "admin_operasional"
        ? "/admin"
        : "/";
    router.push(isAllowedCallback(callbackUrl, session?.user?.role) ? callbackUrl! : defaultUrl);
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setIsLoading(false);

    if (res?.error) {
      setError("Email atau password yang Anda masukkan salah.");
    } else {
      await redirectAfterLogin();
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    await signIn("google", {
      callbackUrl: isSafePublicCallback(callbackUrl) ? callbackUrl! : "/",
    });
    setGoogleLoading(false);
  };

  const handleDevLogin = async (user: { role: string; email: string; password: string }) => {
    setIsLoading(true);
    setDevLoadingRole(user.role);
    setError("");

    const res = await signIn("credentials", {
      redirect: false,
      email: user.email,
      password: user.password,
    });

    setIsLoading(false);
    setDevLoadingRole(null);

    if (res?.error) {
      setError("Login dev gagal. Pastikan database sudah di-seed dan backend aktif.");
      return;
    }

    await redirectAfterLogin();
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#1a3a2e]">Masuk ke CimHeritage</h2>
          <p className="text-sm text-gray-500 mt-2">Silakan login untuk mengakses halaman Admin</p>
        </div>
        
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading || googleLoading || !backendReady}
          className={`mb-5 flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 ${DEMO_MODE ? "hidden" : ""}`}
        >
          <span className="text-base font-bold text-blue-600">G</span>
          {googleLoading ? "Menghubungkan..." : "Masuk dengan Google"}
        </button>

        {DEMO_MODE && (
          <button type="button" onClick={() => setDemoOpen(true)} className="mb-5 w-full rounded-md border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 hover:bg-amber-100">
            🎭 Pilih akun demo (login cepat)
          </button>
        )}
        <div className={`mb-5 flex items-center gap-3 text-xs text-gray-400 ${DEMO_MODE ? "hidden" : ""}`}>
          <span className="h-px flex-1 bg-gray-200" />
          <span>atau</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-4 py-2.5 focus:border-[#1a3a2e] focus:outline-none focus:ring-1 focus:ring-[#1a3a2e]"
              placeholder="admin@cimahiheritage.id"
            />
          </div>
          
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-4 py-2.5 focus:border-[#1a3a2e] focus:outline-none focus:ring-1 focus:ring-[#1a3a2e]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !backendReady}
            className="w-full rounded-md bg-[#1a3a2e] py-2.5 text-white font-medium transition-colors hover:bg-[#132a21] disabled:bg-gray-400 mt-2"
          >
            {isLoading ? "Memproses..." : backendReady ? "Masuk" : "Layanan sedang disiapkan…"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Belum punya akun? <Link href="/register" className="font-semibold text-[#1a3a2e] hover:underline">Daftar customer</Link>
        </p>

        {isDevMode && (
          <div className="mt-6 border-t border-dashed border-gray-200 pt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Dev Login Console</p>
                <p className="text-xs text-gray-500">Pilih akun untuk inject session tanpa input manual.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                DEV
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {devUsers.map((user) => (
                <button
                  key={user.role}
                  type="button"
                  onClick={() => handleDevLogin(user)}
                  disabled={isLoading || !backendReady}
                  className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm font-semibold text-gray-700 transition-colors hover:border-[#1a3a2e] hover:bg-emerald-50 hover:text-[#1a3a2e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {devLoadingRole === user.role ? "Injecting..." : roleLabels[user.role]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {demoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 sm:p-6" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Prototipe Demo</p>
                <h3 className="text-xl font-bold text-[#1a3a2e]">Masuk sebagai siapa?</h3>
                <p className="mt-1 text-sm text-gray-500">Pilih peran untuk menjelajahi aplikasi dengan data contoh yang lengkap.</p>
              </div>
              <button type="button" onClick={() => setDemoOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Tutup">✕</button>
            </div>
            <div className="mx-5 mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>⚠ Hanya untuk demo.</strong> Akun, nama, nomor, dan foto pada prototipe ini adalah data contoh. Perubahan disimpan sementara di memori server dan kembali ke awal saat server dijalankan ulang.
            </div>
            {error && <div className="mx-5 mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {demoAccounts.map((a) => (
                <button key={a.key} type="button" disabled={isLoading || !backendReady} onClick={() => handleDevLogin({ role: a.key, email: a.email, password: "admin123" })}
                  className="group rounded-xl border border-gray-200 p-4 text-left transition hover:border-[#1a3a2e] hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl">{a.icon}</span>
                    <span className="rounded-full bg-[#1a3a2e]/10 px-2 py-0.5 text-[11px] font-bold text-[#1a3a2e]">{a.badge}</span>
                  </div>
                  <p className="mt-2 font-bold text-gray-900">{devLoadingRole === a.key ? "Masuk…" : a.label}</p>
                  <p className="text-xs text-gray-500">{a.email}</p>
                  <p className="mt-1 text-sm text-gray-700">{a.desc}</p>
                  <ul className="mt-2 space-y-0.5 text-xs text-gray-500">{a.highlights.map((h) => <li key={h}>• {h}</li>)}</ul>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 px-5 pb-5 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Akun demo lain (password sama: admin123)</p>
              <div className="flex flex-wrap gap-2">
                {demoOthers.map((o) => (
                  <button key={o.email} type="button" disabled={isLoading || !backendReady} onClick={() => handleDevLogin({ role: o.email, email: o.email, password: "admin123" })}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-[#1a3a2e] hover:bg-emerald-50 disabled:opacity-60">{o.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isAllowedCallback(callbackUrl: string | null, role?: string | null) {
  if (!callbackUrl) return false;
  if (role === "driver") return callbackUrl.startsWith("/driver");
  if (role === "tour_guide") return callbackUrl.startsWith("/guide");
  if (role === "super_admin" || role === "admin_operasional") return callbackUrl.startsWith("/admin");
  return !callbackUrl.startsWith("/admin") && !callbackUrl.startsWith("/driver") && !callbackUrl.startsWith("/guide");
}

function isSafePublicCallback(callbackUrl: string | null) {
  if (!callbackUrl) return false;
  return !callbackUrl.startsWith("/admin") && !callbackUrl.startsWith("/driver") && !callbackUrl.startsWith("/guide");
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
