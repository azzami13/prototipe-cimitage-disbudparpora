'use client';

import { useEffect, useMemo, useState } from 'react';
import { AccountStatus, api, CreateManagedUserBody, ManagedUser, Role } from '@/lib/api';
import { roleLabels } from '@/lib/rbac';

const STATUS_LABEL: Record<AccountStatus, string> = {
  normal: 'Normal',
  suspended: 'Suspend',
  review: 'Dalam peninjauan',
  deleted: 'Dihapus',
};

const STATUS_CLASS: Record<AccountStatus, string> = {
  normal: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  review: 'bg-amber-100 text-amber-800',
  deleted: 'bg-gray-200 text-gray-700',
};

const STATUS_OPTIONS: AccountStatus[] = ['normal', 'suspended', 'review', 'deleted'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateManagedUserBody>({
    name: '',
    email: '',
    password: '',
    nik: '',
    birth_place: '',
    birth_date: '',
    domicile: '',
    ktp_address: '',
    account_status: 'normal',
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 15)), [total]);

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '15' };
    if (search) params.search = search;
    if (status) params.status = status;
    if (role) params.role = role;

    api.users.list(params)
      .then(({ data, total }) => {
        setUsers(data);
        setTotal(total);
        if (selected) {
          const fresh = data.find((user) => user.id === selected.id);
          if (fresh) setSelected(fresh);
        }
      })
      .catch((err: any) => alert(err.message ?? 'Gagal memuat user'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, search, status, role]);

  useEffect(() => {
    api.users.roles().then(setRoles).catch(() => setRoles([]));
  }, []);

  const updateStatus = async (user: ManagedUser, nextStatus: AccountStatus) => {
    setSavingId(user.id);
    try {
      const updated = await api.users.updateStatus(user.id, nextStatus);
      setUsers((items) => items.map((item) => item.id === user.id ? updated : item));
      setSelected((current) => current?.id === user.id ? updated : current);
    } catch (err: any) {
      alert(err.message ?? 'Gagal mengubah status akun');
    } finally {
      setSavingId(null);
    }
  };

  const updateRole = async (user: ManagedUser, roleId?: number) => {
    setSavingId(user.id);
    try {
      const updated = await api.users.updateRole(user.id, roleId);
      setUsers((items) => items.map((item) => item.id === user.id ? updated : item));
      setSelected((current) => current?.id === user.id ? updated : current);
    } catch (err: any) {
      alert(err.message ?? 'Gagal mengubah role akun');
    } finally {
      setSavingId(null);
    }
  };

  const deleteAccount = async (user: ManagedUser) => {
    if (!confirm(`Hapus akun "${user.name}"? Akun akan ditandai sebagai dihapus dan tidak bisa login.`)) return;
    setSavingId(user.id);
    try {
      const result = await api.users.delete(user.id);
      setUsers((items) => items.map((item) => item.id === user.id ? result.user : item));
      setSelected((current) => current?.id === user.id ? result.user : current);
    } catch (err: any) {
      alert(err.message ?? 'Gagal menghapus akun');
    } finally {
      setSavingId(null);
    }
  };

  const createUser = async () => {
    if (!form.name.trim()) return alert('Nama user wajib diisi');
    if (!form.email.trim()) return alert('Email user wajib diisi');
    if (!form.password || form.password.length < 6) return alert('Password minimal 6 karakter');
    if (!form.nik.trim()) return alert('NIK wajib diisi');
    if (!form.birth_place.trim()) return alert('Tempat lahir wajib diisi');
    if (!form.birth_date) return alert('Tanggal lahir wajib diisi');
    if (!form.domicile.trim()) return alert('Domisili saat ini wajib diisi');
    if (!form.ktp_address.trim()) return alert('Alamat sesuai KTP wajib diisi');

    setCreating(true);
    try {
      const created = await api.users.create({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        nik: form.nik.trim(),
        birth_place: form.birth_place.trim(),
        domicile: form.domicile.trim(),
        ktp_address: form.ktp_address.trim(),
        role_id: form.role_id || undefined,
      });
      setUsers((items) => [created, ...items]);
      setSelected(created);
      setTotal((value) => value + 1);
      setShowCreate(false);
      setForm({
        name: '',
        email: '',
        password: '',
        nik: '',
        birth_place: '',
        birth_date: '',
        domicile: '',
        ktp_address: '',
        account_status: 'normal',
      });
    } catch (err: any) {
      alert(err.message ?? 'Gagal menambahkan user');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <a href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block">← Admin Dashboard</a>
          <h1 className="text-2xl font-bold text-[#1a3a2e]">User Control</h1>
          <p className="text-sm text-gray-500 mt-1">Kontrol akses akun, status login, dan detail user.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-500">{total} akun</span>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-[#1a3a2e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2d6a4f]"
          >
            + Tambah User
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4 grid md:grid-cols-[1fr_180px_180px] gap-3">
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
              placeholder="Cari nama atau email"
            />
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Semua status</option>
              {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
            </select>
            <select
              value={role}
              onChange={(event) => { setRole(event.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Semua role</option>
              {roles.map((item) => <option key={item.id} value={item.name}>{getRoleLabel(item.name)}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Terakhir Login</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array(6).fill(0).map((_, index) => (
                    <tr key={index}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                  ))
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada user</td></tr>
                ) : users.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 ${selected?.id === user.id ? 'bg-green-50/60' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(user)} className="text-left">
                        <p className="font-semibold text-gray-800">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{getRoleLabel(user.role?.name)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_CLASS[user.account_status]}`}>
                        {STATUS_LABEL[user.account_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(user.last_login)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={user.account_status}
                          disabled={savingId === user.id}
                          onChange={(event) => updateStatus(user, event.target.value as AccountStatus)}
                          className="border rounded px-2 py-1 text-xs"
                        >
                          {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
                        </select>
                        <button
                          onClick={() => deleteAccount(user)}
                          disabled={savingId === user.id || user.account_status === 'deleted'}
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded disabled:opacity-40"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-1.5 border rounded-lg text-sm disabled:opacity-40">← Prev</button>
            <span className="text-sm text-gray-500 px-2">Hal {page} / {totalPages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
              className="px-4 py-1.5 border rounded-lg text-sm disabled:opacity-40">Next →</button>
          </div>
        </div>

        <UserDetail
          user={selected}
          roles={roles}
          onStatus={updateStatus}
          onRole={updateRole}
          onDelete={deleteAccount}
          saving={savingId === selected?.id}
        />
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="bg-white rounded-t-xl shadow-2xl w-full max-w-lg max-h-[94vh] overflow-y-auto sm:rounded-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-bold text-[#1a3a2e]">Tambah User</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Nama">
                <input value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nama user" />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="user@email.com" />
              </Field>
              <Field label="Password">
                <input type="password" value={form.password} onChange={(event) => setForm((f) => ({ ...f, password: event.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Minimal 6 karakter" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="NIK">
                  <input value={form.nik} onChange={(event) => setForm((f) => ({ ...f, nik: event.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Tempat Lahir">
                  <input value={form.birth_place} onChange={(event) => setForm((f) => ({ ...f, birth_place: event.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Tanggal Lahir">
                <input type="date" value={form.birth_date} onChange={(event) => setForm((f) => ({ ...f, birth_date: event.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Domisili Saat Ini">
                <input value={form.domicile} onChange={(event) => setForm((f) => ({ ...f, domicile: event.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Alamat Sesuai KTP">
                <textarea rows={3} value={form.ktp_address} onChange={(event) => setForm((f) => ({ ...f, ktp_address: event.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Role">
                  <select value={form.role_id ?? ''} onChange={(event) => setForm((f) => ({ ...f, role_id: event.target.value ? Number(event.target.value) : undefined }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Tanpa role</option>
                    {roles.map((item) => <option key={item.id} value={item.id}>{getRoleLabel(item.name)}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.account_status ?? 'normal'} onChange={(event) => setForm((f) => ({ ...f, account_status: event.target.value as AccountStatus }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
                  </select>
                </Field>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white p-4 sm:p-5 border-t flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={createUser} disabled={creating}
                className="px-4 py-2 bg-[#1a3a2e] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {creating ? 'Menyimpan...' : 'Simpan User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserDetail({
  user,
  roles,
  saving,
  onStatus,
  onRole,
  onDelete,
}: {
  user: ManagedUser | null;
  roles: Role[];
  saving: boolean;
  onStatus: (user: ManagedUser, status: AccountStatus) => void;
  onRole: (user: ManagedUser, roleId?: number) => void;
  onDelete: (user: ManagedUser) => void;
}) {
  if (!user) {
    return (
      <aside className="bg-white rounded-xl border p-5 h-fit">
        <p className="text-sm text-gray-400">Pilih user untuk melihat detail akun.</p>
      </aside>
    );
  }

  return (
    <aside className="bg-white rounded-xl border p-5 h-fit space-y-5">
      <div>
        <p className="text-xs text-gray-400 uppercase font-semibold">Detail Akun</p>
        <h2 className="text-xl font-bold text-[#1a3a2e] mt-1">{user.name}</h2>
        <p className="text-sm text-gray-500">{user.email}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Info label="ID User" value={String(user.id)} />
        <Info label="Role" value={getRoleLabel(user.role?.name)} />
        <Info label="Status Login" value={user.active ? 'Bisa login' : 'Diblokir'} />
        <Info label="Status Akun" value={STATUS_LABEL[user.account_status]} />
        <Info label="NIK" value={user.nik ?? '-'} />
        <Info label="Tempat Lahir" value={user.birth_place ?? '-'} />
        <Info label="Tanggal Lahir" value={formatDateOnly(user.birth_date)} />
        <Info label="Domisili" value={user.domicile ?? '-'} />
        <Info label="Terdaftar" value={formatDate(user.registered_at)} />
        <Info label="Terakhir Login" value={formatDate(user.last_login)} />
      </div>

      <Info label="Alamat KTP" value={user.ktp_address ?? '-'} />

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 uppercase">Ubah Status</label>
        <select
          value={user.account_status}
          disabled={saving}
          onChange={(event) => onStatus(user, event.target.value as AccountStatus)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 uppercase">Ubah Role</label>
        <select
          value={user.role_id ?? ''}
          disabled={saving}
          onChange={(event) => onRole(user, event.target.value ? Number(event.target.value) : undefined)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tanpa role</option>
          {roles.map((item) => <option key={item.id} value={item.id}>{getRoleLabel(item.name)}</option>)}
        </select>
      </div>

      <button
        onClick={() => onDelete(user)}
        disabled={saving || user.account_status === 'deleted'}
        className="w-full bg-red-500 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-40"
      >
        Hapus Akun
      </button>
    </aside>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg px-3 py-2">
      <p className="text-[11px] uppercase font-semibold text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-700 mt-1 break-words">{value}</p>
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

function getRoleLabel(role?: string | null) {
  return role && role in roleLabels ? roleLabels[role as keyof typeof roleLabels] : role ?? '-';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
