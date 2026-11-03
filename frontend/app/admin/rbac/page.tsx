import { permissionLabels, roleLabels, rolePermissions, roles } from '@/lib/rbac';

const roleDescriptions = [
  {
    role: 'super_admin',
    description: 'Akses penuh untuk konfigurasi sistem, user, RBAC, audit, dan seluruh modul operasional.',
  },
  {
    role: 'admin_operasional',
    description: 'Mengelola konten heritage, paket, sewa, booking, pembayaran, monitoring, notifikasi, dan laporan.',
  },
  {
    role: 'tour_guide',
    description: 'Melihat booking yang ditugaskan dan informasi monitoring yang relevan untuk perjalanan.',
  },
  {
    role: 'driver',
    description: 'Melihat tugas perjalanan, memperbarui posisi kendaraan, dan mengakses monitoring dasar.',
  },
] as const;

const permissions = Object.keys(permissionLabels) as Array<keyof typeof permissionLabels>;

export default function RbacPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <a href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block">
          Kembali ke Dashboard
        </a>
        <h1 className="text-2xl font-bold text-[#1a3a2e]">RBAC & Hak Akses</h1>
        <p className="text-gray-500 mt-2">
          Matriks akses aktif yang dipakai sidebar dan guard route frontend.
          Endpoint backend tetap menjadi lapisan otorisasi utama.
        </p>
      </div>

      <section className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Ringkasan Role</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Role</th>
                <th className="text-left px-5 py-3 font-semibold">Cakupan kerja</th>
                <th className="text-left px-5 py-3 font-semibold">Jumlah permission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roleDescriptions.map((role) => (
                <tr key={role.role}>
                  <td className="px-5 py-3 font-medium text-gray-800">
                    {roleLabels[role.role]}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{role.description}</td>
                  <td className="px-5 py-3 font-semibold text-[#1a3a2e]">
                    {rolePermissions[role.role].length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Matriks Permission</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-5 py-3 font-semibold min-w-56">Permission</th>
                {roles.map((role) => (
                  <th key={role} className="px-5 py-3 font-semibold min-w-44">
                    {roleLabels[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {permissions.map((permission) => (
                <tr key={permission}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-800">{permissionLabels[permission]}</div>
                    <div className="font-mono text-xs text-gray-400">{permission}</div>
                  </td>
                  {roles.map((role) => {
                    const allowed = rolePermissions[role].includes(permission);

                    return (
                      <td key={role} className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                            allowed
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-300'
                          }`}
                          aria-label={allowed ? 'Diizinkan' : 'Tidak diizinkan'}
                        >
                          {allowed ? 'Y' : '-'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
