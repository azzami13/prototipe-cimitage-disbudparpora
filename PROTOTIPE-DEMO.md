# CimHeritage — Prototipe Demo (siap jalan)

Prototipe ini menjalankan **seluruh antarmuka aplikasi asli** tanpa backend, database, maupun internet.
Data dibuat otomatis saat server hidup (disimpan di memori; kembali ke awal saat server di-restart).

## Cara menjalankan
Butuh **Node.js 18+**.

    cd frontend
    npm install
    npm run build && npm start        # atau: npm run dev
    # buka http://localhost:3000/login

Windows: klik ganda `jalankan-demo.bat`. Mac/Linux: `./jalankan-demo.sh`.

Saat halaman login terbuka, **popup "Masuk sebagai siapa?"** muncul otomatis. Semua akun demo
memakai password `admin123`.

| Peran | Email | Yang bisa dicoba |
|---|---|---|
| Super Admin | admin@cimahiheritage.id | semua menu, user & RBAC, graph, audit, pengaturan |
| Admin Operasional | operasional@cimahiheritage.id | booking, verifikasi bayar, penugasan, monitoring, laporan |
| Driver | driver@cimahiheritage.id | 1 tugas aktif, 8 akan datang, 30+ riwayat |
| Tour Guide | guide@cimahiheritage.id | sesi pemanduan, materi destinasi, riwayat |
| Customer | customer@cimahiheritage.id | 27 pesanan (selesai, berjalan, mendatang, batal) |

## Isi data demo
- 75 cagar budaya (foto 3 tampilan per situs, koordinat & SK asli dari seed Anda)
- 8 paket wisata (dengan rute berurutan), 4 opsi sewa, 8 armada Sakoci (foto, plat, status)
- 130 booking (Agustus–Desember 2026, relatif terhadap hari ini): selesai, hari ini, mendatang, batal
- ±80 trip lengkap dengan itinerary, riwayat status, sesi pemanduan, insiden, rute graph (Dijkstra)
- 49 pengguna, 89 node & 250+ ruas jalan, ±2.200 entri audit log
- Kendaraan pada trip aktif **bergerak otomatis** di peta (simulasi GPS)

## Catatan penting
- Foto cagar budaya & Sakoci adalah **ilustrasi buatan** (SVG), kecuali foto RIO, Gedung Historich,
  Bundaran/Tugu Kartini yang memakai foto asli dari zip Anda. Ganti file di `frontend/public/uploads/`
  atau unggah lewat menu admin.
- Deskripsi situs adalah teks contoh yang disusun dari data register; ganti dengan narasi resmi.
- Mode demo diatur oleh `frontend/.env.local` (`NEXT_PUBLIC_DEMO_MODE=true`). Kode asli backend NestJS
  tetap ada di folder `backend/`; set mode ke `false` untuk kembali memakai backend sungguhan.
- Login Google & websocket dimatikan di mode demo (monitoring memakai refresh berkala).
- Reset data: `POST /api/demo/demo/reset`.
