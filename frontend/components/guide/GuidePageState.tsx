export function GuideLoading({ text = 'Memuat aplikasi Guide...' }: { text?: string }) {
  return <main className="grid min-h-screen place-items-center px-6 text-center text-sm font-semibold text-slate-500">{text}</main>;
}

export function GuideError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Data belum dapat dimuat</h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <button onClick={retry} className="mt-5 min-h-12 rounded-2xl bg-[#1a3a2e] px-5 font-bold text-white">Coba Lagi</button>
      </div>
    </main>
  );
}

export function GuideEmpty({ title, description }: { title: string; description: string }) {
  return <section className="rounded-3xl bg-white p-6 text-center shadow-sm"><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-500">{description}</p></section>;
}
