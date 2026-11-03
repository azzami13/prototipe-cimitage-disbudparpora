'use client';
import { useEffect, useState } from 'react';
import { api, RentalOption } from '@/lib/api';

const EMPTY = {
  name: '',
  description: '',
  base_price: 0,
  price_per_person: 0,
  active: true,
};

export default function AdminSewaPage() {
  const [items, setItems] = useState<RentalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.rentalOptions.list()
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const reset = () => {
    setForm(EMPTY);
    setEditId(null);
  };

  const edit = (item: RentalOption) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      base_price: Number(item.base_price),
      price_per_person: Number(item.price_per_person),
      active: item.active,
    });
  };

  const save = async () => {
    if (!form.name.trim()) return alert('Nama opsi sewa wajib diisi');
    setSaving(true);
    try {
      if (editId) await api.rentalOptions.update(editId, form);
      else await api.rentalOptions.create(form);
      reset();
      load();
    } catch (err: any) {
      alert(err.message ?? 'Gagal menyimpan opsi sewa');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Hapus opsi sewa ini?')) return;
    await api.rentalOptions.delete(id);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <a href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block">← Admin Dashboard</a>
        <h1 className="text-2xl font-bold text-[#1a3a2e]">🚐 Atur Sewa</h1>
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <div className="bg-white rounded-2xl shadow p-5 h-fit">
          <h2 className="font-bold text-[#1a3a2e] mb-4">{editId ? 'Edit Opsi Sewa' : 'Tambah Opsi Sewa'}</h2>
          <div className="space-y-3">
            <Field label="Nama Opsi *">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Sewa Mobil Heritage"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Deskripsi">
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Termasuk driver, BBM, dan penjemputan area Cimahi"
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Harga Dasar">
              <input type="number" min={0} value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Harga / Pengguna">
              <input type="number" min={0} value={form.price_per_person} onChange={e => setForm(f => ({ ...f, price_per_person: Number(e.target.value) }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Aktif
            </label>
            <div className="flex gap-2 pt-2">
              {editId && <button onClick={reset} className="flex-1 border py-2 rounded-lg text-sm">Batal</button>}
              <button onClick={save} disabled={saving}
                className="flex-1 bg-[#1a3a2e] text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3">Opsi</th>
                <th className="text-left px-4 py-3">Harga</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">Memuat...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">Belum ada opsi sewa</td></tr>
              ) : items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1a3a2e]">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{fmt(Number(item.base_price))} dasar</p>
                    <p className="text-xs text-gray-500">+ {fmt(Number(item.price_per_person))}/pengguna</p>
                  </td>
                  <td className="px-4 py-3">{item.active ? 'Aktif' : 'Nonaktif'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => edit(item)} className="bg-amber-500 text-white px-3 py-1 rounded text-xs">Edit</button>
                      <button onClick={() => remove(item.id)} className="bg-red-500 text-white px-3 py-1 rounded text-xs">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{label}</label>
      {children}
    </div>
  );
}
