export function DriverLoading({ text = 'Memuat data perjalanan...' }: { text?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-[#1a3a2e]" />
        <p className="mt-4 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}

export function DriverError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="m-4 rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
      <div className="text-4xl">⚠</div>
      <h2 className="mt-3 font-bold text-slate-800">Data belum dapat dimuat</h2>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <button onClick={retry} className="mt-5 min-h-11 rounded-xl bg-[#1a3a2e] px-6 font-bold text-white">
        Coba Lagi
      </button>
    </div>
  );
}

export function DriverEmpty({ title, description, icon = '🚐' }: { title: string; description: string; icon?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-emerald-200 bg-white p-8 text-center">
      <div className="text-5xl">{icon}</div>
      <h2 className="mt-4 font-bold text-slate-800">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
