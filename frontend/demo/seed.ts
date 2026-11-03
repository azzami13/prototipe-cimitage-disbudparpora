// Generator data demo CimHeritage: dibuat deterministik, relatif terhadap tanggal hari ini.
import base from './heritage-base.json';
import imgs from './heritage-images.json';
import roadSeed from './road-graph.seed.json';
import { buildGraph, adjacency } from './geo';
import { applyGuideAction, applyTripAction, audit, bookingCode, createTrip, iso, nextId, bookingDestinations, Db } from './engine';

const WIB = 7 * 3600e3;
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const FIRST = ['Adi', 'Agus', 'Ahmad', 'Aisyah', 'Andi', 'Anita', 'Asep', 'Bagus', 'Bambang', 'Budi', 'Citra', 'Dedi', 'Dewi', 'Dian', 'Dimas', 'Eka', 'Fajar', 'Fitri', 'Gita', 'Hendra', 'Indah', 'Irfan', 'Joko', 'Kartika', 'Lestari', 'Maya', 'Nanda', 'Nurul', 'Putri', 'Rani', 'Rizky', 'Sari', 'Siti', 'Tono', 'Wahyu', 'Yani', 'Yudi', 'Zaki'];
const LAST = ['Pratama', 'Santoso', 'Wijaya', 'Hidayat', 'Kusuma', 'Saputra', 'Nugraha', 'Permana', 'Rahayu', 'Setiawan', 'Maulana', 'Gunawan', 'Firmansyah', 'Anggraini', 'Lestari', 'Suryana', 'Sudrajat', 'Hermawan'];
const GROUPS = ['Rombongan SMAN 2 Cimahi', 'Keluarga Besar Hartono', 'Komunitas Sepeda Cimahi', 'Kantor Kelurahan Baros', 'Mahasiswa UNJANI', 'Wisata Keluarga Santoso', 'PKK RW 05 Citeureup', 'SMPN 1 Padalarang', 'Alumni SMA 1991', 'Komunitas Fotografi Bandung', 'Karang Taruna Setiamanah', 'Pengajian Ibu-ibu Cibabat', 'Study Tour SDN Pasir Kaliki', 'Arisan Keluarga Wiradinata', 'Rombongan Kantor Kecamatan', 'Gathering PT Nusantara Jaya', 'Pramuka Saka Wisata', 'Komunitas Sejarah Bandung', 'Wisatawan Mancanegara', 'Rombongan TK Harapan Bunda'];
const PICKUPS = [['Pendopo Kota Cimahi', 'PENDOPO CIMAHI'], ['Stasiun Cimahi', 'STASIUN CIMAHI'], ['Taman Kartini', 'TAMAN KARTINI'], ['Hotel Tjimahi', 'HOTEL TJIMAHI'], ['Masjid Agung Cimahi', 'MASJID AGUNG CIMAHI'], ['Alun-alun Cimahi', null], ['Gedung Rio X.nter', 'GEDUNG RIO X.NTER']] as const;
const ISSUE_D = ['Kendaraan Bermasalah', 'Macet Berat', 'Jalan Ditutup', 'Wisatawan Belum Hadir', 'Lokasi Penjemputan Berubah', 'GPS Bermasalah', 'Lainnya'];
const ISSUE_G = ['Wisatawan Belum Hadir', 'Peserta Terpisah', 'Lokasi Ditutup', 'Perubahan Rute', 'Cuaca Buruk', 'Kendala Kesehatan Peserta'];
const NOTES = ['Peserta antusias dan banyak bertanya soal arsitektur kolonial.', 'Materi sejarah tersampaikan lengkap, sesi foto 10 menit.', 'Cuaca cerah, peserta mengikuti seluruh narasi.', 'Ada peserta lansia, tempo penjelasan diperlambat.', 'Peserta meminta tambahan cerita tentang era Hindia Belanda.', 'Sesi berjalan lancar, tidak ada kendala.', 'Pengunjung anak-anak, narasi disederhanakan.'];
const SKIP_REASONS = ['Lokasi sedang ditutup untuk renovasi', 'Waktu tidak mencukupi karena macet', 'Peserta meminta melewati destinasi ini', 'Akses jalan menuju lokasi ditutup'];

const catLabel: Record<string, string> = { BG: 'bangunan', SI: 'situs', BD: 'benda', KA: 'kawasan' };
const title = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bRs\b/, 'RS').replace(/\bSdn\b/, 'SDN').replace(/\bSmpn\b/, 'SMPN').replace(/\bKodim\b/, 'Kodim');
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function createDb(): Db {
  const r = rng(20261102);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const now = new Date();
  const todayStr = new Date(now.getTime() + WIB).toISOString().slice(0, 10);
  const dayStr = (off: number) => new Date(new Date(`${todayStr}T12:00:00+07:00`).getTime() + off * 86400e3).toISOString().slice(0, 10);
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
  const hhmm = (h: number, m = 0) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const db: Db = { seq: {}, audit: [], trips: [], locLogs: [], bookings: [], tickLast: Date.now(), speedFactor: 1, createdAt: iso(now) };

  // ── Roles & users ──
  db.roles = [{ id: 1, name: 'customer' }, { id: 2, name: 'super_admin' }, { id: 3, name: 'admin_operasional' }, { id: 4, name: 'tour_guide' }, { id: 5, name: 'driver' }];
  const roleOf = (n: string) => db.roles.find((x: any) => x.name === n);
  db.users = [];
  let av = 0;
  const addUser = (name: string, email: string, role: string, extra: any = {}) => {
    const id = db.users.length + 1;
    const regDays = extra.regDays ?? ri(20, 200);
    db.users.push({
      id, name, email, password: 'admin123', avatar_url: `/uploads/avatars/avatar-${(av++ % 10) + 1}.svg`,
      nik: `3277${String(ri(10, 99))}${String(ri(100000, 999999))}${String(ri(1000, 9999))}`.slice(0, 16), birth_place: pick(['Cimahi', 'Bandung', 'Bandung Barat', 'Garut', 'Sumedang']),
      birth_date: `${ri(1970, 2002)}-${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`, domicile: pick(['Cimahi Tengah', 'Cimahi Selatan', 'Cimahi Utara', 'Bandung', 'Padalarang']),
      ktp_address: `Jl. ${pick(['Melati', 'Kenanga', 'Mawar', 'Cihanjuang', 'Baros', 'Pasar Atas'])} No. ${ri(1, 120)} RT 0${ri(1, 9)}/RW 0${ri(1, 9)}`,
      role_id: roleOf(role).id, role: { id: roleOf(role).id, name: role }, active: true, account_status: 'normal',
      registered_at: iso(now.getTime() - regDays * 86400e3), last_login: iso(now.getTime() - ri(1, 72) * 3600e3), phone: `08${ri(11, 99)}${ri(1000000, 9999999)}`,
    });
    return id;
  };
  addUser('Super Admin', 'admin@cimahiheritage.id', 'super_admin', { regDays: 300 });          // 1
  addUser('Admin Operasional', 'operasional@cimahiheritage.id', 'admin_operasional', { regDays: 280 }); // 2
  addUser('Rina Kusumawati', 'guide@cimahiheritage.id', 'tour_guide', { regDays: 250 });       // 3
  addUser('Asep Sunandar', 'driver@cimahiheritage.id', 'driver', { regDays: 250 });            // 4
  addUser('Dewi Anggraini', 'customer@cimahiheritage.id', 'customer', { regDays: 120 });       // 5
  addUser('Budi Hartono', 'operasional2@cimahiheritage.id', 'admin_operasional', { regDays: 200 }); // 6
  const guideNames = ['Nanda Permata', 'Yudi Prakoso', 'Siti Nurhaliza', 'Fajar Ramadhan', 'Lestari Dewanti'];
  guideNames.forEach((n, i) => addUser(n, `guide${i + 2}@cimahiheritage.id`, 'tour_guide'));     // 7-11
  const driverNames = ['Dedi Suryana', 'Agus Firmansyah', 'Tono Hermawan', 'Wahyu Nugraha', 'Irfan Maulana', 'Joko Saputra'];
  driverNames.forEach((n, i) => addUser(n, `driver${i + 2}@cimahiheritage.id`, 'driver'));       // 12-17
  for (let i = 0; i < 32; i++) addUser(`${pick(FIRST)} ${pick(LAST)}`, `pelanggan${i + 1}@contoh.id`, 'customer'); // 18-49
  db.users[16].account_status = 'suspended'; db.users[16].active = false; // driver Joko: nonaktif (demo status akun)
  db.users[33].account_status = 'review'; db.users[40].account_status = 'suspended'; db.users[40].active = false;
  const guideIds = [3, 7, 8, 9, 10, 11], driverIds = [4, 12, 13, 14, 15, 16];
  const customerIds = db.users.filter((u: any) => u.role.name === 'customer').map((u: any) => u.id);

  // ── Heritage ──
  db.heritage = base.map((h: any, i: number) => {
    const s = slug(h.name) || `situs-${i}`;
    const im: string[] = (imgs as any)[s] ?? [];
    let gallery = im.slice();
    const up = h.name.toUpperCase();
    if (up.includes('RIO X')) gallery = ['/uploads/heritage/rio2.jpg', '/uploads/heritage/rio3.jpg', im[2]];
    if (up === 'GEDUNG THE HISTORICH') gallery = ['/uploads/beranda/gedungsudirman.jpg', im[1], im[2]];
    if (up.includes('TUGU KARTINI') || up.includes('TAMAN KARTINI')) gallery = ['/uploads/beranda/bundaran.jpg', im[1], im[2]];
    const yr = /^PO(\d{4})/.exec(h.no_register ?? '')?.[1] ?? /\.(20\d{2})\d{4}\./.exec(h.no_register ?? '')?.[1] ?? null;
    const sk = (h.sk_penetapan ?? '').split('\n')[0];
    const nm = title(h.name);
    const status = [17, 44, 61].includes(i) ? 'dalam kajian' : i === 70 ? 'tidak aktif' : 'aktif';
    return {
      id: i + 1, name: h.name, category: h.category, address: h.address, kelurahan: h.kelurahan, kecamatan: h.kecamatan, latitude: h.lat, longitude: h.lng,
      no_register: h.no_register ?? null, sk_penetapan: h.sk_penetapan ?? null, status, tahun_register: yr,
      description: `${nm} merupakan ${catLabel[h.category] ?? 'objek'} cagar budaya Kota Cimahi yang berlokasi di ${h.address}, Kelurahan ${h.kelurahan}, Kecamatan ${h.kecamatan}. ${h.no_register ? `Terdaftar dengan nomor register ${h.no_register}${yr ? ` (tahun ${yr})` : ''}. ` : ''}${sk ? `Penetapan: ${sk}. ` : ''}Lokasi ini menjadi salah satu titik kunjungan dalam rute wisata heritage Sakoci, lengkap dengan pemanduan tour guide lokal. (Teks demo — silakan ganti dengan narasi resmi.)`,
      image_url: gallery[0], images: gallery.map((u, k) => ({ url: u, title: ['Tampak depan', 'Suasana sore', 'Suasana malam'][k] ?? `Foto ${k + 1}`, is_visible: true })),
      youtube_links: [], pdf_files: up.includes('RIO X') ? [{ url: '/uploads/docs/naskah-kajian-rio-2023.pdf', title: 'Naskah Kajian RIO 2023', is_visible: true }] : [],
      created_at: iso(now.getTime() - (300 - i) * 86400e3),
    };
  });
  const siteId = (frag: string) => (db.heritage.find((h: any) => h.name.toUpperCase() === frag) ?? db.heritage.find((h: any) => h.name.toUpperCase().includes(frag)))?.id as number;

  // ── Graph ──
  const g = buildGraph(db.heritage, roadSeed);
  db.graph = { nodes: g.nodes, edges: g.edges, siteNode: g.siteNode, adj: adjacency(g.nodes, g.edges) };

  // ── Packages & rentals ──
  const PK: Array<[string, string, string, number, number, boolean, string[]]> = [
    ['PKG-MILITER', 'Wisata Heritage Militer', 'Jelajahi jejak sejarah militer kolonial Kota Cimahi: dari Rumah Sakit Dustira, Stasiun Cimahi, hingga Gedung The Historich', 150000, 4, true, ['RUMAH SAKIT DUSTIRA', 'STASIUN CIMAHI', 'PENJARA PONCOL', 'GEDUNG THE HISTORICH', 'PESAWAT DAKOTA']],
    ['PKG-RELIGI', 'Wisata Heritage Religi', 'Kunjungi tempat ibadah bersejarah Kota Cimahi yang memiliki nilai arsitektur dan budaya tinggi', 100000, 3, true, ['GEREJA IMMANUEL', 'GEREJA SANTO IGNATIUS', 'MASJID AGUNG CIMAHI']],
    ['PKG-FULLDAY', 'Paket Full Day Heritage Cimahi', 'Paket lengkap seharian mengunjungi 7 situs cagar budaya terpilih dengan panduan lokal', 250000, 8, true, ['LOJI', 'MASJID AGUNG CIMAHI', 'PENDOPO CIMAHI', 'STASIUN CIMAHI', 'RUMAH SAKIT DUSTIRA', 'GEREJA IMMANUEL', 'MAKAM KEHORMATAN BELANDA']],
    ['PKG-KOLONIAL', 'Arsitektur Kolonial Cimahi', 'Menelusuri rumah, hotel, dan gedung bergaya Hindia Belanda yang masih berdiri di pusat kota.', 125000, 4, true, ['RUMAH PETINGGI BELANDA', 'RUMAH VAN BLOMMEISTEIN', 'HOTEL TJIMAHI', 'GEDUNG RIO X.NTER', 'LOJI']],
    ['PKG-MAKAM', 'Napak Tilas Makam & Tokoh', 'Ziarah sejarah ke makam tokoh dan makam kehormatan yang menjadi bagian sejarah Cimahi.', 90000, 3, true, ['MAKAM EMBAH NURKARIM', 'MAKAM EMBAH TUMPANG', 'MAKAM KEHORMATAN BELANDA', 'MAKAM MBAH DALEM WIRASUTA WIDJAYA', 'GERBANG KERKHOF LEUWIGAJAH']],
    ['PKG-BUDAYA', 'Cireundeu & Tugu Kartini', 'Perpaduan budaya adat Kampung Cireundeu dengan taman dan tugu bersejarah di pusat kota.', 110000, 4, true, ['KAMPUNG CIREUNDEU', 'TUGU KARTINI', 'TAMAN KARTINI', 'PENDOPO CIMAHI']],
    ['PKG-PUSDIK', 'Jejak Pusdik & Alutsista', 'Mengunjungi koleksi alutsista dan bangunan pendidikan militer bersejarah.', 140000, 5, true, ['PANSER STUART PUSDIKPAL', 'MERIAM QF 2 POUNDER', 'TANK SHERMAN RECOVERY', 'PESAWAT DAKOTA', 'TUGU KECAP PUSDIKPAL', 'LONCENG PUSDIK BEKANG']],
    ['PKG-NIGHT', 'Heritage Night Tour (segera hadir)', 'Wisata malam bernuansa lampu kota. Masih dalam penyusunan, belum dibuka untuk umum.', 175000, 3, false, ['STASIUN CIMAHI', 'GEDUNG RIO X.NTER', 'PENDOPO CIMAHI']],
  ];
  db.packages = []; db.routes = [];
  PK.forEach(([code, name, desc, price, hrs, active, sites], i) => {
    const id = i + 1;
    db.packages.push({ id, code, name, description: desc, price_per_person: price, duration_hours: hrs, active, image_url: `/uploads/paket/paket-${i + 1}.svg`, created_at: iso(now.getTime() - (200 - i * 10) * 86400e3) });
    sites.forEach((s, k) => db.routes.push({ id: db.routes.length + 1, tour_package_id: id, heritage_site_id: siteId(s), sequence: k + 1, notes: k === 0 ? 'Titik awal kunjungan' : null }));
  });
  db.rentals = [
    { id: 1, name: 'Sewa Sakoci 2 Jam', description: 'Sewa kendaraan Sakoci dengan driver selama 2 jam untuk rute pilihan sendiri.', base_price: 350000, price_per_person: 15000, active: true },
    { id: 2, name: 'Sewa Sakoci 4 Jam', description: 'Sewa setengah hari dengan driver dan opsi tour guide.', base_price: 600000, price_per_person: 20000, active: true },
    { id: 3, name: 'Sewa Sakoci Full Day', description: 'Sewa seharian penuh (8 jam) untuk rombongan besar.', base_price: 1100000, price_per_person: 25000, active: true },
    { id: 4, name: 'Charter Akhir Pekan', description: 'Paket charter khusus Sabtu–Minggu untuk acara komunitas.', base_price: 1500000, price_per_person: 30000, active: false },
  ].map((x) => ({ ...x, created_at: iso(now.getTime() - 150 * 86400e3) }));

  // ── Sakoci ──
  const skStatus = ['available', 'available', 'available', 'available', 'available', 'available', 'maintenance', 'inactive'];
  db.sakoci = skStatus.map((st, i) => ({
    id: i + 1, name: `Sakoci Heritage ${i + 1}`, code: `SKC-${String(i + 1).padStart(2, '0')}`, plate_number: `D ${1200 + i * 37} CMH`, image_url: `/uploads/sakoci/sakoci-${String(i + 1).padStart(2, '0')}.svg`,
    status: st, active: st !== 'inactive', tracking_enabled: st !== 'inactive', tracking_visibility: (['public', 'public', 'user', 'public', 'admin', 'public', 'hidden', 'hidden'] as const)[i],
    latitude: -6.8748 + (r() - 0.5) * 0.02, longitude: 107.5383 + (r() - 0.5) * 0.02, location_updated_at: iso(now.getTime() - ri(1, 40) * 60000),
    notes: ['Armada utama, kapasitas 24 penumpang.', 'Armada utama, AC aktif.', 'Kapasitas 20 penumpang.', 'Cadangan untuk acara besar.', 'Dilengkapi sound system pemandu.', 'Armada baru 2026.', 'Servis rutin: penggantian kampas rem.', 'Dinonaktifkan sementara (menunggu perpanjangan STNK).'][i],
    created_at: iso(now.getTime() - (240 - i * 5) * 86400e3),
  }));

  db.settings = {
    appName: 'Cimitage Tourism', agencyName: 'Disbudparpora Kota Cimahi', operationalHotline: '0812-3456-7890', customerSupportContact: 'cs@cimahiheritage.id', operationalHours: '07:00 - 17:00 WIB',
    paymentTimeoutHours: 24, driverReadyOffsetMinutes: 30, defaultCapacityLimit: 4, trackingEnabled: true, publicTrackingEnabled: true, showPublicCurrentRoute: true, showSakociGraphRadius: true, pickupMaxSnapMeters: 150,
  };

  // ── Bookings ──
  const priceOf = (type: string, pkg: any, rent: any, n: number, nd: number) => type === 'package' ? pkg.price_per_person * n : type === 'rental' ? rent.base_price + rent.price_per_person * n : 60000 * n + 80000 * nd;
  const activePk = db.packages.filter((p: any) => p.active);
  const mk = (o: { date: string; time: string; status: string; pay: string; user?: number; type?: string; createdAgo?: number; n?: number; }) => {
    const id = nextId(db, 'booking');
    const type = o.type ?? pick(['package', 'package', 'package', 'rental', 'private', 'private']);
    const pkg: any = type === 'package' ? pick(activePk as any[]) : null;
    const rent: any = type === 'rental' ? pick(db.rentals.filter((x: any) => x.active) as any[]) : null;
    const nd = type === 'package' ? 0 : ri(2, 4);
    let privIds: number[] | undefined = type === 'package' ? undefined : Array.from(new Set(Array.from({ length: nd }, () => ri(1, 75)))).filter((x) => db.heritage[x - 1].status === 'aktif');
    if (privIds && privIds.length < 2) privIds = [siteId('STASIUN CIMAHI'), siteId('PENDOPO CIMAHI'), ...(privIds ?? [])];
    const n = o.n ?? ri(4, 22);
    const [pl, ps] = pick(PICKUPS);
    const site = ps ? db.heritage[siteId(ps) - 1] : null;
    const lat = site ? site.latitude : -6.8748, lng = site ? site.longitude : 107.5383;
    const user: number = o.user ?? (pick(customerIds as number[]) as number); const u = db.users[user - 1];
    const created = at(o.date, '09:00').getTime() - (o.createdAgo ?? ri(2, 9)) * 86400e3 - ri(0, 600) * 60000;
    const price = priceOf(type, pkg, rent, n, privIds?.length ?? 0);
    const b: any = {
      id, booking_type: type, group_name: `${pick(GROUPS)} #${id}`, tour_package_id: pkg?.id, rental_option_id: rent?.id, visit_date: o.date, pickup_time: o.time, pickup_location: pl,
      pickup_maps_url: `https://www.google.com/maps?q=${lat},${lng}`, pickup_latitude: lat, pickup_longitude: lng, private_destination_ids: privIds, participants: n,
      status: o.status, payment_status: o.pay, payment_method: null, paid_amount: null, payment_proof_url: null, admin_payment_proof_url: null, payment_notes: null, payment_rejection_reason: null,
      payment_verified_at: null, payment_rejected_at: null, cancelled_at: null, cancelled_by_role: null, cancellation_reason: null, assigned_tour_guide_id: null, assigned_driver_id: null, sakoci_id: null,
      vehicle_name: null, vehicle_plate_number: null, vehicle_latitude: null, vehicle_longitude: null, vehicle_location_updated_at: null,
      contact_phone: u.phone, contact_email: u.email, notes: pick([null, null, 'Ada 2 peserta lansia', 'Mohon tour guide berbahasa Sunda', 'Peserta anak-anak, narasi singkat', 'Butuh dokumentasi foto', 'Membawa kursi roda 1 unit']),
      total_price: price, created_at: iso(created), user_id: user,
    };
    db.bookings.push(b);
    audit(db, { actor: { id: user, role: 'customer' }, action: 'booking.create', entity_type: 'booking', entity_id: id, booking_code: bookingCode(id), scope: 'booking', metadata: { type, participants: n, total: price }, at: new Date(created) });
    if (['waiting_verification', 'paid', 'rejected'].includes(o.pay) || (o.pay === 'refunded')) {
      b.payment_method = pick(['Transfer Bank BCA', 'Transfer Bank BRI', 'QRIS', 'Transfer Bank Mandiri']); b.payment_proof_url = '/uploads/payments/proof-customer.svg';
      audit(db, { actor: { id: user, role: 'customer' }, action: 'payment.proof_upload', entity_type: 'booking', entity_id: id, booking_code: bookingCode(id), scope: 'payment', at: new Date(created + 3600e3 * 2) });
    }
    if (o.pay === 'paid' || o.pay === 'refunded') {
      b.paid_amount = price; b.payment_verified_at = iso(created + 3600e3 * 5); b.admin_payment_proof_url = '/uploads/payments/proof-admin.svg';
      audit(db, { actor: { id: pick([2, 6]), role: 'admin_operasional' }, action: 'payment.verify', entity_type: 'booking', entity_id: id, booking_code: bookingCode(id), scope: 'payment', metadata: { paid_amount: price }, at: new Date(created + 3600e3 * 5) });
    }
    if (o.pay === 'rejected') {
      b.payment_rejection_reason = pick(['Nominal transfer tidak sesuai', 'Bukti transfer tidak terbaca', 'Rekening tujuan salah']); b.payment_rejected_at = iso(created + 3600e3 * 6);
      audit(db, { actor: { id: 2, role: 'admin_operasional' }, action: 'payment.reject', entity_type: 'booking', entity_id: id, booking_code: bookingCode(id), scope: 'payment', metadata: { reason: b.payment_rejection_reason }, at: new Date(created + 3600e3 * 6) });
    }
    return b;
  };
  const cancel = (b: any, by: string, reason: string, atMs: number) => {
    Object.assign(b, { status: 'cancelled', cancelled_at: iso(atMs), cancelled_by_role: by, cancellation_reason: reason });
    audit(db, { actor: { id: by === 'customer' ? b.user_id : 2, role: by }, action: 'booking.cancel', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'booking', metadata: { reason }, at: new Date(atMs) });
  };

  let skRot = 0; const nextSakoci = () => [1, 2, 3, 4, 5, 6][skRot++ % 6];
  const crew = (i: number) => ({ driver: i % 5 < 2 ? 4 : pick(driverIds.slice(1, 5)), guide: i % 6 === 5 ? null : i % 5 < 2 ? 3 : pick(guideIds.slice(1)) });

  /** Jalankan skrip aksi driver/guide pada trip hingga fase tertentu. */
  const drive = (trip: any, stage: string, startAt: Date) => {
    const driver = db.users[trip.driver_id - 1], guide = trip.tour_guide_id ? db.users[trip.tour_guide_id - 1] : null;
    let t = startAt.getTime();
    const step = (body: any, min: number) => { t += min * 60000; applyTripAction(db, trip, body, new Date(t), driver); };
    const gstep = (body: any, min: number) => { t += min * 60000; if (guide) applyGuideAction(db, trip, body, new Date(t), guide); };
    const segMin = (k: number) => trip.route_snapshot.segments[k]?.durationMinutes ?? 8;
    step({ action: 'ACCEPT_TASK' }, 0); if (stage === 'accepted') return;
    step({ action: 'START_TO_PICKUP' }, 30); if (stage === 'to_pickup') return;
    step({ action: 'CONFIRM_ARRIVAL_PICKUP' }, 12); if (stage === 'at_pickup') return;
    step({ action: 'START_TOUR' }, 6);
    const dests = trip.itinerary_items.filter((i: any) => i.stop_type === 'DESTINATION');
    for (let k = 0; k < dests.length; k++) {
      const d = dests[k];
      if (stage === `enroute:${k}`) return;
      const doSkip = stage === 'complete' && r() < 0.06 && k > 0;
      if (doSkip) { step({ action: 'SKIP_STOP', reason: pick(SKIP_REASONS) }, segMin(k) / 2); continue; }
      step({ action: 'CONFIRM_ARRIVAL_STOP', itineraryItemId: d.id }, segMin(k));
      if (stage === `at:${k}`) { gstep({ action: 'START_GUIDE_SESSION', itineraryItemId: d.id }, 2); return; }
      gstep({ action: 'START_GUIDE_SESSION', itineraryItemId: d.id }, 2);
      t += (d.planned_duration_minutes ?? 30) * 60000 - 240000;
      gstep({ action: 'COMPLETE_GUIDE_SESSION', itineraryItemId: d.id, notes: pick(NOTES) }, 0);
      step({ action: 'START_NEXT_STOP' }, 3);
    }
    if (stage === 'enroute:end') return;
    if (trip.trip_status === 'EN_ROUTE_TO_ENDPOINT') {
      step({ action: 'CONFIRM_ARRIVAL_STOP', itineraryItemId: trip.current_itinerary_item_id }, segMin(trip.itinerary_items.length - 2));
      step({ action: 'COMPLETE_TRIP' }, 2);
    } else if (trip.trip_status === 'AT_DESTINATION') step({ action: 'COMPLETE_TRIP' }, 2);
  };
  const addIncident = (trip: any, who: 'driver' | 'tour_guide', status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED', atMs: number) => {
    const uid = who === 'driver' ? trip.driver_id : trip.tour_guide_id; if (!uid) return;
    const type = who === 'driver' ? pick(ISSUE_D) : pick(ISSUE_G);
    const inc: any = { id: nextId(db, 'incident'), trip_id: trip.id, driver_id: trip.driver_id, reported_by_user_id: uid, reporter_role: who, issue_type: type, description: `${type}: ${pick(['kondisi sudah dilaporkan ke admin.', 'butuh arahan operasional.', 'peserta sudah diinformasikan.', 'menunggu konfirmasi lebih lanjut.'])}`, status, reported_at: iso(atMs), resolved_at: null, resolution_note: null };
    if (status === 'RESOLVED') { inc.resolved_at = iso(atMs + 25 * 60000); inc.resolution_note = pick(['Sudah ditangani, perjalanan dilanjutkan.', 'Rute dialihkan, peserta diberi tahu.', 'Kendaraan diperiksa, aman digunakan.']); }
    trip.incidents.push(inc);
    audit(db, { actor: db.users[uid - 1], action: 'incident.report', entity_type: 'trip_incident', entity_id: inc.id, booking_code: trip.booking_reference, scope: 'trip', metadata: { issue_type: type }, at: new Date(atMs) });
  };

  // A. riwayat selesai (±70) + dibatalkan (±10) selama 90 hari terakhir
  for (let i = 0; i < 72; i++) {
    const off = -1 - Math.floor((i / 72) * 89);
    const owner = i % 8 === 0 ? 5 : undefined;
    const b = mk({ date: dayStr(off), time: hhmm(ri(7, 13), pick([0, 15, 30, 45])), status: 'completed', pay: 'paid', user: owner });
    const c = crew(i);
    const trip = createTrip(db, b, { driver_id: c.driver, tour_guide_id: c.guide, sakoci_id: nextSakoci(), assigned_at: new Date(at(b.visit_date, '08:00').getTime() - ri(1, 4) * 86400e3), admin_id: pick([2, 6]) });
    audit(db, { actor: db.users[1], action: 'trip.assign', entity_type: 'driver_trip', entity_id: trip.id, booking_code: bookingCode(b.id), scope: 'trip', metadata: { driver_id: c.driver, guide_id: c.guide, sakoci_id: trip.sakoci_id }, at: new Date(trip.assigned_at) });
    drive(trip, 'complete', new Date(new Date(trip.scheduled_user_pickup_at).getTime() - 70 * 60000));
    if (r() < 0.22) addIncident(trip, r() < 0.6 ? 'driver' : 'tour_guide', 'RESOLVED', new Date(trip.scheduled_user_pickup_at).getTime() + ri(20, 120) * 60000);
  }
  for (let i = 0; i < 10; i++) {
    const off = -2 - ri(0, 80);
    const unpaid = i % 3 === 0;
    const b = mk({ date: dayStr(off), time: hhmm(ri(8, 13)), status: 'pending', pay: unpaid ? 'unpaid' : 'paid', user: i < 3 ? 5 : undefined });
    const by = unpaid ? 'system' : pick(['customer', 'admin_operasional']);
    cancel(b, by, unpaid ? 'Pembayaran melewati batas waktu 24 jam' : pick(['Jadwal rombongan berubah', 'Peserta berkurang drastis', 'Cuaca buruk, dijadwalkan ulang']), at(b.visit_date, '06:00').getTime() - 86400e3);
    if (unpaid) b.payment_status = 'expired'; else if (r() < 0.5) b.payment_status = 'refunded';
  }

  // B. hari ini
  const nowWib = new Date(now.getTime() + WIB); const nowMin = nowWib.getUTCHours() * 60 + nowWib.getUTCMinutes();
  const tm = (offMin: number) => { const m = Math.min(23 * 60 + 30, Math.max(0, nowMin + offMin)); return hhmm(Math.floor(m / 60), m % 60 - (m % 60) % 5); };
  const today: Array<{ stage: string; d: number; g: number | null; pkg: number; off: number; user?: number; pk?: number }> = [
    { stage: 'enroute:2', d: 4, g: 3, pkg: 1, off: -110, user: 5 }, { stage: 'at_pickup', d: 12, g: 7, pkg: 2, off: -35 }, { stage: 'at:0', d: 13, g: 8, pkg: 4, off: -85 }, { stage: 'enroute:1', d: 14, g: 9, pkg: 6, off: -95 },
    { stage: 'complete', d: 15, g: 10, pkg: 5, off: -330 }, { stage: 'complete', d: 4, g: 3, pkg: 2, off: -420, user: 5 },
    { stage: 'none', d: 4, g: 3, pkg: 3, off: 150 }, { stage: 'accepted', d: 13, g: 8, pkg: 7, off: 90 },
  ];
  today.forEach((t, k) => {
    const b = mk({ date: dayStr(0), time: tm(t.off), status: 'confirmed', pay: 'paid', type: 'package', user: t.user, n: ri(8, 20) });
    b.tour_package_id = t.pkg; b.total_price = db.packages[t.pkg - 1].price_per_person * b.participants;
    const trip = createTrip(db, b, { driver_id: t.d, tour_guide_id: t.g, sakoci_id: k < 6 ? k + 1 : (k % 4) + 1, assigned_at: new Date(now.getTime() - 86400e3 * 2), admin_id: 2 });
    audit(db, { actor: db.users[1], action: 'trip.assign', entity_type: 'driver_trip', entity_id: trip.id, booking_code: bookingCode(b.id), scope: 'trip', metadata: { driver_id: t.d }, at: new Date(trip.assigned_at) });
    if (t.stage !== 'none') {
      const pickupMs = new Date(trip.scheduled_user_pickup_at).getTime();
      // mundurkan waktu agar aksi terakhir ≈ sekarang
      const startAt = new Date(Math.min(pickupMs - 45 * 60000, now.getTime() - 20 * 60000));
      try { drive(trip, t.stage, startAt); } catch { /* fase tidak valid untuk trip pendek: biarkan */ }
    }
    if (t.stage === 'enroute:1' || t.stage === 'enroute:2') { trip.tracking_active = true; if (!trip.sim) { /* sim dimulai oleh drive */ } }
    if (k === 3) addIncident(trip, 'driver', 'OPEN', now.getTime() - 12 * 60000);
    if (k === 2) addIncident(trip, 'tour_guide', 'IN_REVIEW', now.getTime() - 30 * 60000);
  });

  // C. akan datang (30 hari ke depan)
  const plan = [...Array(18).fill('assigned'), ...Array(8).fill('confirmed'), ...Array(8).fill('waiting'), ...Array(4).fill('unpaid'), ...Array(2).fill('rejected')];
  plan.forEach((kind: string, i: number) => {
    const off = 1 + Math.floor((i / plan.length) * 30) + (i % 3 === 0 ? 0 : 0);
    const user = i % 7 === 0 ? 5 : undefined;
    const date = dayStr(off), time = hhmm(ri(7, 13), pick([0, 30]));
    if (kind === 'assigned') {
      const b = mk({ date, time, status: 'confirmed', pay: 'paid', user });
      const c = crew(i + 3);
      const trip = createTrip(db, b, { driver_id: c.driver, tour_guide_id: c.guide, sakoci_id: nextSakoci(), assigned_at: new Date(now.getTime() - ri(1, 30) * 3600e3), admin_id: pick([2, 6]) });
      audit(db, { actor: db.users[1], action: 'trip.assign', entity_type: 'driver_trip', entity_id: trip.id, booking_code: bookingCode(b.id), scope: 'trip', metadata: { driver_id: c.driver }, at: new Date(trip.assigned_at) });
      if (off <= 3 && i % 2 === 0) { try { drive(trip, 'accepted', new Date(now.getTime() - 3600e3)); } catch { /* ignore */ } }
    } else if (kind === 'confirmed') mk({ date, time, status: 'confirmed', pay: 'paid', user });
    else if (kind === 'waiting') mk({ date, time, status: 'pending', pay: 'waiting_verification', user, createdAgo: ri(0, 2) });
    else if (kind === 'unpaid') mk({ date, time, status: 'pending', pay: 'unpaid', user, createdAgo: 0 });
    else mk({ date, time, status: 'pending', pay: 'rejected', user, createdAgo: 1 });
  });

  // D. log tambahan: login, perubahan master data, pengaturan
  for (let i = 0; i < 160; i++) {
    const u = db.users[ri(0, db.users.length - 1)];
    audit(db, { actor: u, action: 'auth.login', entity_type: 'user', entity_id: u.id, scope: 'auth', metadata: { method: r() < 0.15 ? 'google' : 'password', ua: pick(['Chrome Android', 'Chrome Windows', 'Safari iOS', 'Firefox Linux']) }, at: new Date(now.getTime() - ri(1, 90 * 24 * 60) * 60000) });
  }
  ['heritage.update', 'heritage.create', 'package.update', 'package.toggle_active', 'rental.update', 'sakoci.update', 'sakoci.image_upload', 'graph.rebuild', 'settings.update', 'user.create', 'user.update_role', 'user.update_status'].forEach((a, k) => {
    for (let j = 0; j < 3; j++) audit(db, { actor: db.users[k % 3 === 2 ? 0 : 1], action: a, entity_type: a.split('.')[0], entity_id: ri(1, 8), scope: a.startsWith('settings') || a.startsWith('user') || a.startsWith('graph') ? 'system' : 'master', metadata: { note: 'Perubahan data demo' }, at: new Date(now.getTime() - ri(1, 60 * 24 * 40) * 60000) });
  });
  db.audit.sort((a: any, b: any) => (a.created_at < b.created_at ? -1 : 1)).forEach((x: any, i: number) => (x.id = i + 1));
  db.seq.audit = db.audit.length;
  // posisi awal sakoci non-aktif/standby di sekitar depo
  db.sakoci.forEach((s: any) => { if (s.status === 'available') { s.latitude = -6.8748 + (r() - 0.5) * 0.004; s.longitude = 107.5383 + (r() - 0.5) * 0.004; } });
  return db;
}
