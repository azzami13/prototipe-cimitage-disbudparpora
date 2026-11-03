# CimahiHeritage WebGIS / Cimitage Tourism

<div align="center">

**Sistem Informasi WebGIS Aset Cagar Budaya dan Optimasi Rute Kendaraan Wisata Sakoci di Kota Cimahi**

Aplikasi berbasis web untuk mendukung digitalisasi informasi situs cagar budaya, pemesanan wisata, optimasi rute perjalanan, dan monitoring kendaraan wisata Sakoci secara real-time.

</div>

---

## Daftar Isi

- [Tentang Project](#tentang-project)
- [Latar Belakang](#latar-belakang)
- [Tujuan Pengembangan](#tujuan-pengembangan)
- [Mitra dan Pengguna Sistem](#mitra-dan-pengguna-sistem)
- [Fitur Utama](#fitur-utama)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Struktur Project](#struktur-project)
- [Prasyarat Instalasi](#prasyarat-instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Cara Menjalankan Project](#cara-menjalankan-project)
- [Akun Default](#akun-default)
- [Endpoint API Utama](#endpoint-api-utama)
- [Database dan Seed Data](#database-dan-seed-data)
- [Routing dan Optimasi Rute](#routing-dan-optimasi-rute)
- [Real-Time Monitoring Sakoci](#real-time-monitoring-sakoci)
- [Deployment](#deployment)
- [Keamanan](#keamanan)
- [Batasan Sistem](#batasan-sistem)
- [Troubleshooting](#troubleshooting)
- [Pengembang](#pengembang)
- [Lisensi dan Catatan Penggunaan](#lisensi-dan-catatan-penggunaan)

---

## Tentang Project

**CimHeritage WebGIS** atau **Sistem WebGIS Cimitage Tourism** adalah aplikasi web yang dikembangkan untuk mendukung program **Cimahi Military Heritage Tourism** di Kota Cimahi. Sistem ini mengintegrasikan penyajian informasi cagar budaya dalam bentuk peta digital, pemesanan wisata, pengelolaan paket perjalanan, optimasi rute kendaraan Sakoci, dan monitoring posisi kendaraan secara real-time.

Project ini dikembangkan sebagai bagian dari Tugas Akhir kelompok **KoTA 208** Program Studi D3 Teknik Informatika, Jurusan Teknik Komputer dan Informatika, Politeknik Negeri Bandung.

Nama project yang digunakan pada source code:

```text
cimahiheritage-monitoring
```

Nama produk/aplikasi:

```text
CimHeritage WebGIS / Sistem WebGIS Cimitage Tourism
```

---

## Latar Belakang

Kota Cimahi memiliki berbagai situs cagar budaya dan objek diduga cagar budaya yang berkaitan dengan sejarah militer dan perkembangan kota. Program **Cimitage Tourism** menggunakan kendaraan wisata **Sakoci** untuk membawa wisatawan mengunjungi beberapa destinasi heritage dalam satu perjalanan.

Sebelum sistem ini dikembangkan, proses informasi dan operasional masih banyak dilakukan secara manual, antara lain:

- Data cagar budaya masih tersebar pada dokumen dan spreadsheet.
- Informasi lokasi belum sepenuhnya tersaji dalam bentuk peta digital interaktif.
- Pemesanan wisata masih dilakukan melalui komunikasi manual.
- Penentuan rute dan urutan kunjungan masih bergantung pada pengalaman driver atau admin.
- Monitoring posisi kendaraan Sakoci belum tersedia secara real-time.
- Rekapitulasi data kunjungan dan operasional belum terpusat.

Sistem ini dibuat untuk membantu mengintegrasikan kebutuhan tersebut ke dalam satu platform berbasis web yang dapat digunakan oleh wisatawan, admin, driver, tour guide, HPI, dan Dinas.

---

## Tujuan Pengembangan

Tujuan utama project ini adalah:

1. Menyediakan WebGIS untuk menampilkan data situs cagar budaya Kota Cimahi secara interaktif.
2. Menyediakan fitur pencarian, filter, dan detail informasi destinasi wisata heritage.
3. Menyediakan fitur pemesanan kunjungan atau paket wisata secara digital.
4. Mendukung pengelolaan data paket wisata, data pemesanan, data kendaraan, dan data pengguna.
5. Menyediakan optimasi rute multi-destinasi menggunakan algoritma Dijkstra.
6. Menyediakan monitoring posisi kendaraan Sakoci secara real-time.
7. Menyediakan dashboard admin dan role-based access control untuk pengelolaan operasional.

---

## Mitra dan Pengguna Sistem

### Mitra Sasaran

- **Dinas Kebudayaan, Pariwisata, Kepemudaan, dan Olahraga Kota Cimahi**
- **Himpunan Pramuwisata Indonesia (HPI) Kota Cimahi**
- Pengelola program wisata **Cimitage Tourism**

### Karakteristik Operasional

- Jumlah kendaraan Sakoci aktif: sekitar **2 unit**.
- Jumlah pegawai/operator terkait: sekitar **30 orang**.
- Estimasi pengguna aktif tahunan: sekitar **7.000 pengguna/tahun**.
- Jam operasional utama aplikasi: **07.00–18.00 WIB**.
- Di luar jam operasional, aplikasi tetap berjalan tetapi trafik diperkirakan rendah.

### Role Pengguna

| Role | Deskripsi Singkat |
|---|---|
| Wisatawan | Melihat informasi wisata, peta, paket, dan melakukan pemesanan. |
| Driver | Melihat penugasan, navigasi, dan mengirim posisi GPS Sakoci. |
| Tour Guide | Melihat informasi situs dan data perjalanan untuk kegiatan pemanduan. |
| HPI | Mengelola operasional, pemesanan, jadwal, driver, dan monitoring perjalanan. |
| Dinas | Mengelola data destinasi, paket wisata, konten, dan laporan. |
| Kepala Dinas | Melihat dashboard statistik dan laporan secara read-only. |
| Admin Super | Mengelola seluruh sistem, pengguna, konfigurasi, dan data master. |
| Sales/Admin Konten | Mengelola konten promosi, artikel, dan informasi publik. |

---

## Fitur Utama

### 1. Landing Page

- Menampilkan informasi program Cimitage Tourism.
- Menampilkan ringkasan paket wisata.
- Menampilkan preview peta destinasi.
- Menampilkan berita, artikel, galeri, dan kontak.

### 2. WebGIS dan Peta Interaktif

- Peta berbasis **Leaflet.js** dan **OpenStreetMap**.
- Marker lokasi situs cagar budaya.
- Popup informasi situs.
- Pencarian destinasi.
- Filter kategori/status situs.
- Tampilan jalur paket wisata.
- Fitur lokasi pengguna.

### 3. Detail Destinasi / Situs Cagar Budaya

- Nama situs.
- Deskripsi sejarah.
- Alamat dan koordinat.
- Kategori/status situs.
- Foto atau galeri situs.
- Tombol tampilkan lokasi di peta.

### 4. Manajemen Aset Cagar Budaya

- CRUD data destinasi.
- Pengelolaan status aset seperti terduga, dalam verifikasi, terverifikasi, atau ditolak.
- Upload foto situs.
- Preview lokasi pada peta.
- Ekspor data aset.

### 5. Paket Wisata

- Menampilkan daftar paket wisata.
- Mengatur destinasi dalam paket.
- Mengatur urutan kunjungan.
- Mengatur status paket aktif/tidak aktif.
- Menampilkan jalur paket pada peta.

### 6. Pemesanan Wisata

- Form pemesanan paket wisata.
- Input data rombongan.
- Input tanggal, waktu, dan titik penjemputan.
- Status pemesanan.
- Dashboard cek pesanan untuk admin/HPI.
- Statistik pemesanan.

### 7. Optimasi Rute

- Optimasi rute multi-destinasi.
- Algoritma utama: **Dijkstra**.
- Perhitungan jarak fallback menggunakan **Haversine Formula**.
- Mendukung urutan destinasi berdasarkan jarak/rute terpendek.
- Endpoint khusus untuk perhitungan rute.

### 8. Monitoring Sakoci Real-Time

- Update posisi kendaraan Sakoci.
- Monitoring kendaraan pada peta admin/publik sesuai pengaturan visibility.
- Dukungan WebSocket/Socket.IO.
- Data kendaraan meliputi nama, kode, plat nomor, status, tracking enabled, latitude, longitude, dan waktu update terakhir.

### 9. Dashboard Admin

- Statistik ringkas.
- Manajemen user dan RBAC.
- Manajemen paket.
- Manajemen destinasi.
- Manajemen pemesanan.
- Monitoring kendaraan.
- Laporan dan audit.

### 10. Autentikasi dan RBAC

- Login user.
- JWT authentication.
- Password hashing.
- Pembatasan akses berdasarkan role.
- Halaman unauthorized untuk akses yang tidak sesuai.

---

## Teknologi yang Digunakan

### Backend

| Teknologi | Keterangan |
|---|---|
| Node.js | Runtime server-side JavaScript. |
| NestJS | Framework backend modular berbasis TypeScript. |
| TypeScript | Bahasa utama backend. |
| TypeORM | ORM untuk PostgreSQL. |
| PostgreSQL | Database relasional utama. |
| PostGIS | Ekstensi PostgreSQL untuk data spasial. |
| Socket.IO | Komunikasi real-time untuk tracking dan notifikasi. |
| JWT | Autentikasi token. |
| bcrypt/bcryptjs | Hashing password. |

### Frontend

| Teknologi | Keterangan |
|---|---|
| Next.js 14 | Framework React untuk frontend. |
| React 18 | Library UI berbasis komponen. |
| TypeScript | Bahasa utama frontend. |
| Leaflet.js | Visualisasi peta interaktif. |
| OpenStreetMap | Basemap peta. |
| Socket.IO Client | Client real-time tracking. |
| Tailwind CSS | Styling UI. |

### Tools Pendukung

| Tools | Fungsi |
|---|---|
| Git & GitHub | Version control dan kolaborasi. |
| Postman | Pengujian API. |
| pgAdmin / psql | Manajemen PostgreSQL. |
| QGIS | Validasi dan pengolahan data spasial. |
| Docker | Containerization untuk deployment. |
| Nginx | Reverse proxy untuk production. |

---

## Arsitektur Sistem

Sistem menggunakan pendekatan **client-server architecture**.

```text
Browser / Mobile Web
        |
        | HTTP / HTTPS / WebSocket
        v
Frontend Next.js
        |
        | REST API + Socket.IO Client
        v
Backend NestJS
        |
        | TypeORM
        v
PostgreSQL + PostGIS
```

### Komponen Utama

1. **Frontend Client**
   - Menyediakan antarmuka publik, halaman peta, dashboard admin, halaman pemesanan, dan halaman driver.

2. **Backend API Server**
   - Menangani logika bisnis, autentikasi, pengelolaan data, routing, pemesanan, dan WebSocket.

3. **Spatial Database**
   - Menyimpan data atribut dan spasial seperti destinasi, koordinat, kendaraan, paket, dan pemesanan.

4. **Real-Time Module**
   - Mengirim dan menerima update posisi kendaraan Sakoci secara real-time.

5. **Basemap Provider**
   - Menggunakan OpenStreetMap untuk tampilan peta dasar.

---

## Struktur Project

Struktur utama project:

```text
cimahiheritage-monitoring/
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   ├── entities/
│   │   │   └── enums/
│   │   ├── database/
│   │   │   └── seed.ts
│   │   ├── modules/
│   │   │   ├── admin-users/
│   │   │   ├── auth/
│   │   │   ├── booking/
│   │   │   ├── heritage/
│   │   │   ├── package-route/
│   │   │   ├── rental-option/
│   │   │   ├── routing/
│   │   │   ├── sakoci/
│   │   │   ├── tour-package/
│   │   │   └── user/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── uploads/
│   │   ├── beranda/
│   │   ├── heritage/
│   │   └── logo/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── audit/
│   │   │   ├── booking/
│   │   │   ├── help/
│   │   │   ├── heritage/
│   │   │   ├── monitoring/
│   │   │   ├── notifications/
│   │   │   ├── paket/
│   │   │   ├── payments/
│   │   │   ├── rbac/
│   │   │   ├── reports/
│   │   │   ├── routes/
│   │   │   ├── settings/
│   │   │   ├── sewa/
│   │   │   └── users/
│   │   ├── booking/
│   │   ├── heritage/
│   │   ├── login/
│   │   ├── paket/
│   │   ├── peta/
│   │   ├── profile/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── middleware.ts
│   ├── next.config.js
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── dummy-sakoci-tracker/
│   └── ...
│
├── setup.sh
├── package.json
└── README.md
```

### Catatan Folder `dummy-sakoci-tracker`

Folder `dummy-sakoci-tracker` digunakan untuk simulasi GPS kendaraan Sakoci selama development/testing. Folder ini **tidak digunakan pada production deployment** karena pada implementasi asli posisi kendaraan dikirim dari perangkat driver melalui fitur GPS/browser.

---

## Prasyarat Instalasi

Pastikan perangkat sudah memiliki:

| Dependency | Versi Minimum | Keterangan |
|---|---:|---|
| Node.js | 18+ | Disarankan Node.js LTS. |
| npm | Sesuai Node.js | Package manager. |
| PostgreSQL | 15+ / 16 | Database utama. |
| PostGIS | 3.x | Ekstensi spasial PostgreSQL. |
| Git | Terbaru | Clone dan version control. |

Cek versi:

```bash
node --version
npm --version
psql --version
```

---

## Konfigurasi Environment

### Backend Environment

Buat file `.env` pada folder `backend/`.

```bash
cd backend
cp .env.example .env
```

Contoh konfigurasi aman:

```env
# Application
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cimahiheritage

# JWT
JWT_SECRET=change_this_secret_in_production
JWT_EXPIRES_IN=8h

# CORS
FRONTEND_URL=http://localhost:3000
```

> Jangan commit file `.env` ke repository. Gunakan `.env.example` untuk template tanpa credential asli.

### Frontend Environment

Buat file `.env.local` pada folder `frontend/`.

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

Untuk production, ubah URL sesuai domain backend/API production.

---

## Cara Menjalankan Project

### Opsi 1 — Setup Otomatis Menggunakan `setup.sh`

Script `setup.sh` akan membantu memeriksa dependency, install backend, install frontend, membuat database, dan menjalankan seed data.

```bash
chmod +x setup.sh
./setup.sh
```

Script akan melakukan proses berikut:

1. Memeriksa dependency `node`, `npm`, dan `psql`.
2. Menyiapkan backend NestJS.
3. Menyiapkan frontend Next.js.
4. Membuat database PostgreSQL jika belum ada.
5. Menjalankan seed data awal, termasuk data situs cagar budaya.

Setelah setup selesai, jalankan aplikasi pada dua terminal.

Terminal 1 — Backend:

```bash
cd backend
npm run start:dev
```

Terminal 2 — Frontend:

```bash
cd frontend
npm run dev
```

Akses aplikasi:

| Layanan | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001/api |
| Peta GIS | http://localhost:3000/peta |
| Admin Dashboard | http://localhost:3000/admin |

---

### Opsi 2 — Setup Manual

#### 1. Clone Repository

```bash
git clone <URL_REPOSITORY>
cd cimahiheritage-monitoring
```

#### 2. Install Dependency Backend

```bash
cd backend
npm install --legacy-peer-deps
```

#### 3. Konfigurasi Backend `.env`

```bash
cp .env.example .env
```

Edit `DATABASE_URL` sesuai database lokal atau cloud.

#### 4. Buat Database PostgreSQL

```bash
createdb cimahiheritage
```

Masuk ke database dan aktifkan PostGIS:

```bash
psql -d cimahiheritage
```

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

Keluar dari psql:

```sql
\q
```

#### 5. Jalankan Seed Backend

```bash
npm run seed
```

#### 6. Jalankan Backend

```bash
npm run start:dev
```

#### 7. Install Dependency Frontend

Buka terminal baru:

```bash
cd frontend
npm install --legacy-peer-deps
```

#### 8. Konfigurasi Frontend `.env.local`

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local
```

#### 9. Jalankan Frontend

```bash
npm run dev
```

---

## Script NPM yang Tersedia

### Root Project

```bash
npm run seed
npm run backend:seed
npm run backend:build
npm run frontend:build
```

### Backend

```bash
npm run start
npm run start:dev
npm run start:prod
npm run build
npm run seed
npm run lint
npm run test
npm run test:e2e
```

### Frontend

```bash
npm run dev
npm run build
npm run start
```

---

## Akun Default

Akun default setelah proses seed:

```text
Email    : admin@cimahiheritage.id
Password : admin123
Role     : Admin Super
```

> Untuk production, segera ubah password default dan jangan gunakan credential default pada server publik.

---

## Endpoint API Utama

Base URL lokal:

```text
http://localhost:3001/api
```

Endpoint utama:

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/heritage/geojson` | Mengambil data GeoJSON untuk peta. |
| GET | `/api/heritage?search=...` | Mengambil daftar situs cagar budaya dengan pencarian. |
| POST | `/api/routing/optimize` | Optimasi rute multi-destinasi menggunakan Dijkstra. |
| POST | `/api/bookings` | Membuat pemesanan wisata. |
| GET | `/api/bookings/stats` | Mengambil statistik pemesanan. |
| POST | `/api/auth/login` | Login pengguna. |
| POST | `/api/auth/register` | Registrasi pengguna. |
| GET | `/api/sakoci?public=true` | Mengambil data kendaraan Sakoci yang dapat ditampilkan publik. |

Contoh request optimasi rute:

```bash
curl -X POST http://localhost:3001/api/routing/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "start": { "lat": -6.873432, "lng": 107.541933 },
    "destinations": [
      { "id": 1, "name": "Alun-Alun Cimahi", "lat": -6.8722, "lng": 107.5420 },
      { "id": 2, "name": "Stasiun Cimahi", "lat": -6.8850, "lng": 107.5350 }
    ]
  }'
```

---

## Database dan Seed Data

Database menggunakan PostgreSQL dengan ekstensi PostGIS.

### Entitas Utama

Beberapa entitas utama pada backend:

| Entity | Fungsi |
|---|---|
| `User` | Data pengguna sistem dan role. |
| `Role` | Hak akses pengguna. |
| `HeritageSite` | Data situs cagar budaya. |
| `TourPackage` | Data paket wisata. |
| `PackageRoute` | Data rute pada paket wisata. |
| `Booking` | Data pemesanan kunjungan. |
| `Sakoci` | Data kendaraan Sakoci dan posisi tracking. |
| `RentalOption` | Data opsi sewa/layanan tambahan. |

### Seed Data

Jalankan seed:

```bash
cd backend
npm run seed
```

Seed digunakan untuk mengisi data awal seperti:

- Akun admin default.
- Data role.
- Data situs cagar budaya.
- Data paket wisata.
- Data kendaraan Sakoci.
- Data konfigurasi awal yang dibutuhkan aplikasi.

---

## Routing dan Optimasi Rute

Sistem menyediakan modul routing pada:

```text
backend/src/modules/routing/
```

Konsep utama:

1. Lokasi awal dan daftar destinasi diterima dari frontend.
2. Sistem menghitung jarak antar titik.
3. Sistem membentuk urutan kunjungan yang lebih efisien.
4. Algoritma Dijkstra digunakan untuk mencari jalur/rute terpendek pada graf berbobot.
5. Haversine Formula digunakan sebagai perhitungan jarak geografis, terutama sebagai fallback atau bobot antar node.

Catatan:

- Sistem tidak memperhitungkan kondisi lalu lintas real-time.
- Sistem tidak menghitung biaya perjalanan.
- Sistem difokuskan pada wilayah Kota Cimahi dan rute yang relevan untuk kendaraan Sakoci.

---

## Real-Time Monitoring Sakoci

Modul Sakoci berada pada:

```text
backend/src/modules/sakoci/
```

Fitur monitoring mendukung:

- Update latitude dan longitude kendaraan.
- Status kendaraan: tersedia, digunakan, atau nonaktif.
- Tracking enabled/disabled.
- Tracking visibility publik/admin.
- Waktu update lokasi terakhir.

Contoh endpoint publik:

```bash
curl "http://localhost:3001/api/sakoci?public=true"
```

Contoh response:

```json
{
  "id": 1,
  "name": "Sakochi",
  "code": "SKC CH1",
  "plate_number": "D1234CE",
  "status": "available",
  "active": true,
  "tracking_enabled": true,
  "tracking_visibility": "public",
  "latitude": -6.873432,
  "longitude": 107.541933,
  "location_updated_at": "2026-06-05T01:36:09.000Z"
}
```

### Dummy Tracker

Folder:

```text
dummy-sakoci-tracker/
```

Status:

```text
Development/testing only. Tidak digunakan pada production.
```

Dummy tracker hanya digunakan untuk simulasi pergerakan kendaraan ketika perangkat driver/GPS asli belum digunakan.

---

## Deployment

### Target Deployment Ringan

Karena pengguna aktif belum besar, deployment production awal dapat menggunakan spesifikasi ringan-menengah.

Estimasi kebutuhan:

| Komponen | Rekomendasi Awal |
|---|---|
| Server App | 1 VM/VPS 2 vCPU, 2–4 GB RAM |
| OS | Ubuntu Server 22.04 LTS / 24.04 LTS |
| Database | PostgreSQL + PostGIS pada VM yang sama atau managed database kecil |
| Storage | 40–80 GB SSD |
| Reverse Proxy | Nginx |
| SSL | Let's Encrypt |
| Runtime | Node.js LTS atau Docker |

Untuk skala saat ini, penggunaan satu VM masih cukup karena:

- Kendaraan Sakoci hanya sekitar 2 unit.
- Pengguna aktif tahunan sekitar 7.000.
- Trafik tinggi hanya pada jam 07.00–18.00 WIB.
- Di luar jam tersebut trafik relatif rendah.

### Skema Deployment Sederhana

```text
Internet
   |
   v
Nginx Reverse Proxy + SSL
   |
   +-- Frontend Next.js : port 3000
   |
   +-- Backend NestJS   : port 3001
   |
   +-- PostgreSQL/PostGIS : port 5432 internal only
```

### Build Production Manual

Backend:

```bash
cd backend
npm install --legacy-peer-deps
npm run build
npm run start:prod
```

Frontend:

```bash
cd frontend
npm install --legacy-peer-deps
npm run build
npm run start
```

### Rekomendasi Production dengan PM2

Install PM2:

```bash
npm install -g pm2
```

Jalankan backend:

```bash
cd backend
npm run build
pm2 start dist/main.js --name cimheritage-backend
```

Jalankan frontend:

```bash
cd frontend
npm run build
pm2 start npm --name cimheritage-frontend -- start
```

Simpan konfigurasi PM2:

```bash
pm2 save
pm2 startup
```

### Contoh Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Docker Deployment

Jika menggunakan Docker, buat container terpisah untuk:

- `frontend`
- `backend`
- `postgres-postgis`
- `nginx`

Level deployment yang disarankan untuk project final cloud minimal adalah:

- **Level 3 — Containerized App**: aplikasi berjalan pada container dan memiliki Dockerfile.
- Dapat ditingkatkan ke **Level 4 — Cloud Native/DevOps** jika repository sudah memiliki CI/CD otomatis.

---

## Keamanan

Rekomendasi keamanan untuk development dan production:

1. Gunakan HTTPS pada production.
2. Jangan commit file `.env` dan credential asli.
3. Ganti password admin default setelah deployment.
4. Gunakan `JWT_SECRET` yang kuat dan berbeda untuk production.
5. Batasi akses database hanya dari server aplikasi.
6. Jangan membuka port PostgreSQL ke publik.
7. Aktifkan firewall/security group:
   - `80` dan `443` untuk publik.
   - `22` hanya untuk IP admin/developer.
   - `5432` hanya internal/private.
8. Validasi seluruh input user pada backend.
9. Terapkan RBAC pada endpoint admin.
10. Backup database secara berkala.

---

## Batasan Sistem

Batasan pada versi ini:

- Sistem berbasis web responsif, bukan aplikasi mobile native.
- Belum mencakup payment gateway atau pembayaran digital.
- Optimasi rute tidak memperhitungkan kondisi lalu lintas real-time.
- Fitur tracking bergantung pada GPS perangkat driver dan koneksi internet.
- Fokus wilayah operasional adalah Kota Cimahi.
- Folder `dummy-sakoci-tracker` tidak digunakan pada production.
- Data peta dasar bergantung pada OpenStreetMap.

---

## Troubleshooting

### 1. `node` atau `npm` tidak ditemukan

Install Node.js LTS dari website resmi Node.js, lalu cek kembali:

```bash
node --version
npm --version
```

### 2. `psql` tidak ditemukan

Install PostgreSQL dan pastikan command `psql` sudah masuk ke PATH.

### 3. Database gagal dibuat

Pastikan PostgreSQL berjalan dan user memiliki hak membuat database.

```bash
createdb cimahiheritage
```

Jika gagal karena permission, gunakan user postgres:

```bash
sudo -u postgres createdb cimahiheritage
```

### 4. Error koneksi database

Periksa `DATABASE_URL` pada `backend/.env`.

Format yang benar:

```env
DATABASE_URL=postgresql://username:password@host:port/database_name
```

### 5. Error dependency React/Next/Nest

Gunakan opsi legacy peer deps:

```bash
npm install --legacy-peer-deps
```

### 6. Frontend tidak dapat memanggil backend

Pastikan backend berjalan pada port `3001` dan konfigurasi frontend benar:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 7. Peta tidak muncul

Periksa:

- Koneksi internet tersedia.
- Leaflet CSS ter-load dengan benar.
- OpenStreetMap tile tidak diblokir.
- Data GeoJSON dari backend tersedia.

Cek endpoint:

```bash
curl http://localhost:3001/api/heritage/geojson
```

### 8. Tracking tidak muncul

Periksa:

- Data kendaraan aktif.
- `tracking_enabled = true`.
- `tracking_visibility = public` jika ingin tampil di publik.
- WebSocket backend berjalan.
- Browser mengizinkan akses lokasi.

---

## Roadmap Pengembangan

Beberapa pengembangan lanjutan yang dapat dilakukan:

- Integrasi notifikasi WhatsApp/email.
- Export laporan PDF/Excel yang lebih lengkap.
- Integrasi object storage untuk foto dan dokumen.
- CI/CD pipeline otomatis.
- Docker Compose production-ready.
- Monitoring server dan log terpusat.
- Integrasi OSRM atau routing engine internal dari data OSM.
- Optimasi urutan multi-destinasi dengan pendekatan TSP + Dijkstra/A*.
- Mode offline terbatas untuk driver.
- Audit log lebih detail untuk aktivitas admin.

---

## Pengembang

Project ini dikembangkan oleh **Kelompok KoTA 208**.

| Nama | NIM | Peran Utama |
|---|---|---|
| Muhammad Azzam Izzuddin | 231511054 | Backend, Frontend, Deployment, Analisis, Use Case, ERD, BPMN |
| R. Muhammad Farrel Walid Imtiyaaz | 231511060 | Frontend, Desain UI, Dokumentasi, Activity Diagram, Prototype |
| Zidan Tri Satria Mukti | 231511064 | Backend, Frontend, Dokumentasi, Class Diagram, Sequence Diagram, Arsitektur |

Program Studi:

```text
D3 Teknik Informatika
Jurusan Teknik Komputer dan Informatika
Politeknik Negeri Bandung
2026
```

---

## Repository

Isi link repository setelah project dipublikasikan:

```text
https://github.com/<username>/<repository-name>
```

Contoh:

```text
https://github.com/azzami13/cimahiheritage
```

---

## Lisensi dan Catatan Penggunaan

Project ini dikembangkan untuk kebutuhan akademik Tugas Akhir dan mendukung digitalisasi program wisata heritage Kota Cimahi.

Catatan:

- Data cagar budaya dan operasional digunakan sesuai kebutuhan pengembangan sistem.
- Credential asli, API key, password database, dan file `.env` tidak boleh dipublikasikan.
- Untuk production, lakukan hardening keamanan, backup berkala, dan pengujian UAT bersama mitra.

---

## Ringkasan Quick Start

```bash
# 1. Clone repository
git clone <URL_REPOSITORY>
cd cimahiheritage-monitoring

# 2. Jalankan setup otomatis
chmod +x setup.sh
./setup.sh

# 3. Jalankan backend
cd backend
npm run start:dev

# 4. Jalankan frontend pada terminal lain
cd frontend
npm run dev
```

Akses:

```text
Frontend : http://localhost:3000
Backend  : http://localhost:3001/api
Peta GIS : http://localhost:3000/peta
Admin    : http://localhost:3000/admin
```

