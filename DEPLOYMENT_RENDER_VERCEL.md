# Deployment UAT — Render dan Vercel

Konfigurasi ini ditujukan untuk branch `deploy`. Jangan menaruh kredensial atau nilai rahasia di repository.

## Backend di Render

- Root Directory: `backend`
- Build Command: `npm ci --legacy-peer-deps && npm run build`
- Start Command: `npm run start:prod`
- Health Check Path: `/api/health`
- Branch: `deploy`

`npm run start:prod` otomatis menjalankan seluruh migration TypeORM dari
`dist/database/data-source.js` sebelum proses NestJS aktif. Jika migration gagal,
perintah start berhenti dengan status gagal sehingga backend tidak melayani schema
yang belum lengkap. Migration yang telah tercatat di tabel `migrations` tidak
dijalankan ulang.

Environment variables yang wajib diisi:

```env
NODE_ENV=production
PORT=10000
DATABASE_URL=<URL PostgreSQL/PostGIS cloud>
JWT_SECRET=<secret acak yang kuat>
FRONTEND_URL=https://<project-vercel>.vercel.app
TYPEORM_SYNCHRONIZE=false
TYPEORM_LOGGING=false
```

`FRONTEND_URL` dapat memuat beberapa origin yang dipisahkan koma, misalnya URL production dan preview UAT. Jangan menggunakan `*` pada production. Render biasanya menyediakan `PORT`; nilai dashboard dapat mengikuti nilai yang disediakan platform.

Backend dipin ke Node.js 22 LTS melalui `backend/package.json` dan
`backend/.node-version`. Jangan menambahkan seed ke Build Command atau Start
Command Render; `npm run seed` hanya ditujukan untuk development lokal.

### Operasional migration

Build harus sudah selesai sebelum menjalankan perintah berikut karena CLI memakai
file hasil kompilasi di `dist`:

```bash
npm run build
npm run migration:show
```

Output `[ ]` menunjukkan migration yang belum diterapkan dan `[X]` menunjukkan
migration yang sudah tercatat. Migration normal berjalan otomatis pada start.
Jika benar-benar perlu dijalankan manual dari Render Shell:

```bash
npm run migration:run
```

Jangan memakai `migration:revert`, reset schema, `DROP TABLE`, atau `TRUNCATE`
langsung pada production. Untuk koreksi production, buat migration maju
(*forward-fix*) yang non-destruktif dan uji lebih dahulu. Ambil backup/snapshot Neon
sebelum perubahan schema penting, lalu pastikan `/api/health` mengembalikan
`database: "ok"` setelah deploy.

### Seed UAT manual (opsional)

Seed tidak pernah dijalankan otomatis. Jika akun/data UAT memang perlu dibuat di
environment production, set sementara variabel berikut hanya selama eksekusi
manual:

```env
ALLOW_PRODUCTION_SEED=true
UAT_SEED_PASSWORD=<password UAT yang kuat>
```

Kemudian jalankan `npm run seed:uat`. Script menolak eksekusi tanpa kedua nilai
tersebut, tidak mencetak password, dan tidak menimpa akun dengan email yang sudah
ada. Setelah selesai, hapus/nonaktifkan kembali kedua variabel dari dashboard.

### Keamanan API dan rate limit

Semua endpoint backend bersifat privat secara default. Endpoint publik harus
ditandai eksplisit di source code. Pastikan `JWT_SECRET` pada Render berupa secret
acak yang kuat dan tidak sama dengan environment lain. Perubahan role atau status
akun membatalkan token lama karena backend mencocokkan claim JWT dengan database.

Rate limit awal yang diterapkan:

- global: 120 request/menit per IP;
- login: 10 request/15 menit per IP;
- register: 5 request/jam per IP;
- pembuatan booking publik: 10 request/jam per IP;
- upload bukti pembayaran: 10 request/15 menit per IP;
- katalog heritage: 300 request/menit per IP;
- routing internal umum: 120 request/menit per IP;
- optimasi publik `POST /api/routing/optimize-v2`: 30 request/menit per IP karena
  menjalankan validasi heritage, pencarian pickup graph, dan optimasi rute.

Endpoint graph mentah (`destination-matrix`, `destination-distances`,
`nearest-node`, node/edge, status, dan rebuild) hanya untuk `super_admin`.
Endpoint routing lama yang menerima koordinat/titik mentah (`simple`, `optimize`,
`distance-matrix`, dan `dijkstra`) juga hanya untuk `super_admin`. Respons optimasi
publik hanya berisi urutan heritage, ringkasan jarak/waktu, segmen akhir, dan
GeoJSON akhir; matrix, node path, edge step, build ID, serta kandidat TSP tidak
dikirim ke browser.

CORS HTTP dan WebSocket memakai daftar origin dari `FRONTEND_URL`. Pada production,
localhost tidak ditambahkan dan nilai `*` ditolak oleh parser origin; isi variabel
ini hanya dengan origin Vercel/domain frontend resmi, dipisahkan koma bila lebih
dari satu.

Render berada di balik reverse proxy; aplikasi telah mengaktifkan `trust proxy`
agar alamat IP klien dibaca dengan benar. Respons yang melewati batas menggunakan
HTTP 429. Upload lokal dibatasi satu file maksimal 5 MB, memakai nama UUID, dan
hanya menerima JPEG, PNG, WebP; upload heritage dan bukti pembayaran juga menerima
PDF karena UI saat ini memerlukannya. SVG tidak diterima.
Bukti pembayaran disimpan di folder privat dan hanya dikirim melalui endpoint yang
memvalidasi JWT serta ownership booking. Path static lama
`/uploads/booking-payments/*` sengaja mengembalikan 404; file lama tetap dapat
dibaca admin melalui endpoint privat selama file masih ada pada filesystem service.

Sebelum deploy, jalankan `npm audit --omit=dev` dari folder `backend` dan tinjau
advisory dependency production. Jangan menjalankan `npm audit fix --force` langsung
pada branch deploy karena upgrade mayor perlu diuji terpisah.

## Frontend di Vercel

- Root Directory: `frontend`
- Branch: `deploy`

Environment variables yang wajib diisi:

```env
NEXT_PUBLIC_API_URL=https://<service-render>.onrender.com/api
NEXTAUTH_URL=https://<project-vercel>.vercel.app
NEXTAUTH_SECRET=<secret acak yang kuat>
```

Deploy backend Render terlebih dahulu. Setelah endpoint `/api/health` merespons, deploy frontend Vercel, kemudian perbarui `FRONTEND_URL` pada Render dengan origin Vercel yang sebenarnya dan restart service bila diperlukan.

## Batasan layanan gratis

- Backend dapat sleep saat idle; frontend otomatis mengirim health check dan menampilkan proses persiapan layanan.
- File upload pada filesystem service tidak persisten. Migrasikan upload user/admin ke object storage seperti Supabase Storage sebelum production penuh.
- Untuk UAT atau presentasi, buka aplikasi beberapa menit lebih awal agar backend sudah aktif.

## Progressive Web App (PWA)

PWA aktif penuh pada secure context (HTTPS atau `localhost`). Vercel sudah menyediakan HTTPS. App shell publik dan aset statis frontend dapat dibuka dari cache, tetapi login, booking, dashboard, tracking/GPS, Socket.IO, data peta dinamis, dan routing/optimasi tetap membutuhkan internet serta backend Render yang siap.

Cara memasang aplikasi:

- Android Chrome: buka situs, tekan tombol **Install Aplikasi**, lalu konfirmasi **Install**.
- Chrome/Edge desktop: tekan **Install Aplikasi** atau ikon install pada address bar, lalu konfirmasi.
- iPhone/iPad Safari: tekan **Install Aplikasi** untuk melihat panduan, lalu pilih **Share → Add to Home Screen → Add**.

Tombol install hanya muncul jika browser mendukung instalasi, aplikasi belum terpasang, atau perangkat menggunakan Safari iOS. Jika aplikasi sudah berjalan dalam mode standalone, tombol disembunyikan.

### Pengujian lokal

Service worker sengaja hanya didaftarkan pada production build agar cache tidak mengganggu development:

```bash
cd frontend
npm run build
npm run start
```

Buka `http://localhost:3000`, lalu periksa tab **Application** di Chrome DevTools:

1. Manifest terbaca dan ikon 192/512 tampil.
2. Service worker `/sw.js` berstatus aktif.
3. Setelah satu kali membuka aplikasi online, aktifkan **Offline** dan muat ulang halaman untuk memeriksa fallback.
4. Pastikan Cache Storage tidak berisi `/api/*`, halaman booking, admin, driver, guide, token, atau respons Socket.IO.
5. Kembalikan koneksi dan pastikan status backend berubah dari “Menyiapkan layanan Cimitage…” menjadi siap.

### Pembaruan setelah deployment

`/sw.js` dikirim dengan `must-revalidate`, navigasi memakai network-first, dan bundle Next.js memiliki nama ber-hash sehingga deployment baru tidak tertahan oleh HTML lama. Bila daftar precache atau perilaku cache diubah, naikkan nilai `CACHE_VERSION` pada `frontend/public/sw.js`; service worker baru akan menghapus cache versi Cimitage sebelumnya saat aktivasi. Untuk pengujian paksa, gunakan **Application → Service Workers → Update**, lalu reload. Pengguna biasa menerima pembaruan saat aplikasi dibuka kembali dan service worker melakukan pemeriksaan versi.
