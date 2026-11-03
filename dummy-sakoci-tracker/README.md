# Dummy Sakoci Tracker

Service dummy GPS yang berjalan di luar backend dan frontend Cimahi Heritage.

Fungsinya mensimulasikan bus/Sakoci berjalan dari titik A ke B lalu ke destinasi berikutnya, mengikuti geometry rute dari backend `/api/routing/optimize`, lalu mengirim koordinat terbaru ke backend utama melalui:

```txt
PUT /api/sakoci/:id/location
```

Frontend Anda sudah polling `/api/sakoci?public=true`, sehingga marker Sakoci akan bergerak di Leaflet tanpa perlu GPS asli.

## Cara menjalankan

```bash
cd dummy-sakoci-tracker
npm install
copy .env.example .env
npm start
```

Pastikan backend utama sudah berjalan di:

```txt
http://localhost:3001/api
```

## Contoh request menjalankan trip

```bash
curl -X POST http://localhost:3010/trips \
  -H "Content-Type: application/json" \
  -d '{
    "sakociId": 1,
    "speedKmh": 25,
    "loop": false,
    "destinations": [
      { "id": 1, "name": "Alun-Alun Cimahi", "lat": -6.872205, "lng": 107.542533 },
      { "id": 2, "name": "RS Dustira", "lat": -6.883064, "lng": 107.536460 },
      { "id": 3, "name": "Stasiun Cimahi", "lat": -6.885070, "lng": 107.535150 }
    ]
  }'
```

## Endpoint

### POST `/trips`
Mulai simulasi perjalanan.

Body:

```json
{
  "sakociId": 1,
  "speedKmh": 25,
  "loop": false,
  "userLocation": { "lat": -6.872205, "lng": 107.542533 },
  "destinations": [
    { "id": 1, "name": "Titik A", "lat": -6.872205, "lng": 107.542533 },
    { "id": 2, "name": "Titik B", "lat": -6.883064, "lng": 107.536460 }
  ]
}
```

### POST `/trips/from-geometry`
Mulai simulasi dari geometry LineString / segments yang sudah ada.

### GET `/trips`
Melihat daftar simulasi aktif.

### GET `/trips/:sakociId`
Melihat status simulasi Sakoci tertentu.

### DELETE `/trips/:sakociId`
Menghentikan simulasi.

## Alur integrasi yang disarankan

1. Admin memilih booking / armada Sakoci.
2. Sistem Anda memanggil `/api/routing/optimize` untuk menghasilkan urutan destinasi dan geometry.
3. Sistem Anda memanggil dummy tracker `POST http://localhost:3010/trips` atau `POST /trips/from-geometry`.
4. Dummy tracker mengirim lokasi ke backend utama setiap 1 detik.
5. Frontend peta Anda membaca `/api/sakoci?public=true` setiap 5 detik dan marker bus bergerak.

