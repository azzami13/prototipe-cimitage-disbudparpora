// Router REST tiruan: meniru kontrak API backend NestJS asli (tanpa database).
import { createDb } from './seed';
import { HttpError, bad, notFound, Db, audit, applyGuideAction, applyTripAction, bookingCode, bookingDestinations, buildRoute, createTrip, iso, nextId, orderByNearest, tick, addHistory } from './engine';
import { haversineKm, nearestNode, dijkstra, lineFeature } from './geo';

const g: any = globalThis;
export const getDb = (): Db => (g.__cimDemoDb ??= createDb());
export const resetDb = () => { g.__cimDemoDb = createDb(); return g.__cimDemoDb as Db; };

type Ctx = { db: Db; user: any | null; params: Record<string, string>; query: URLSearchParams; body: any; form: FormData | null; method: string };
type Handler = (c: Ctx) => any;
const routes: Array<{ method: string; re: RegExp; keys: string[]; h: Handler }> = [];
function on(method: string, pattern: string, h: Handler) {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, h });
}

// ── helpers ──
const STAFF_ADMIN = ['super_admin', 'admin_operasional'];
const roleName = (u: any) => u?.role?.name;
function need(c: Ctx, ...roles: string[]) {
  if (!c.user) throw new HttpError(401, 'Sesi login tidak ditemukan. Silakan login kembali.');
  if (roles.length && !roles.includes(roleName(c.user))) throw new HttpError(403, 'Anda tidak memiliki akses ke fitur ini.');
  return c.user;
}
const num = (v: any) => (v === '' || v == null ? undefined : Number(v));
const pageOf = <T,>(rows: T[], q: URLSearchParams, def = 10) => {
  const page = Math.max(1, Number(q.get('page') ?? 1)), limit = Math.min(500, Math.max(1, Number(q.get('limit') ?? def)));
  return { data: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit, totalPages: Math.max(1, Math.ceil(rows.length / limit)) };
};
const byId = (arr: any[], id: any) => arr.find((x) => x.id === Number(id));
const must = (x: any, m?: string) => { if (!x) throw notFound(m); return x; };
const strip = (o: any, ...ks: string[]) => { const c = { ...o }; ks.forEach((k) => delete c[k]); return c; };

export const userView = (u: any) => (u ? strip(u, 'password') : null);
const slimUser = (u: any) => (u ? { id: u.id, name: u.name, email: u.email, avatar_url: u.avatar_url, role: { name: u.role.name } } : undefined);
const siteView = (db: Db, id: number) => byId(db.heritage, id);
export function packageView(db: Db, p: any) {
  return { ...p, routes: db.routes.filter((r: any) => r.tour_package_id === p.id).sort((a: any, b: any) => a.sequence - b.sequence).map((r: any) => ({ ...r, heritage_site: siteView(db, r.heritage_site_id) })) };
}
export function bookingView(db: Db, b: any) {
  const v: any = strip(b, 'user_id');
  v.tour_package = b.tour_package_id ? packageView(db, byId(db.packages, b.tour_package_id)) : undefined;
  v.rental_option = b.rental_option_id ? byId(db.rentals, b.rental_option_id) : undefined;
  v.tour_guide = slimUser(byId(db.users, b.assigned_tour_guide_id)); v.driver = slimUser(byId(db.users, b.assigned_driver_id));
  v.sakoci = b.sakoci_id ? byId(db.sakoci, b.sakoci_id) : undefined;
  v.private_destinations = (b.private_destination_ids ?? []).map((id: number) => siteView(db, id)).filter(Boolean);
  return v;
}
export function tripView(db: Db, t: any) {
  const v: any = strip(t, 'sim', '_route');
  v.booking = bookingView(db, byId(db.bookings, t.booking_id));
  v.driver = userView(byId(db.users, t.driver_id)); v.tour_guide = t.tour_guide_id ? userView(byId(db.users, t.tour_guide_id)) : null;
  v.sakoci = byId(db.sakoci, t.sakoci_id);
  v.itinerary_items = t.itinerary_items.map((i: any) => { const h = i.heritage_site_id ? siteView(db, i.heritage_site_id) : null; return { ...i, heritage_site: h, guide_content_snapshot: h }; });
  return v;
}
const ACTIVE = ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'AT_PICKUP', 'EN_ROUTE_TO_DESTINATION', 'AT_DESTINATION', 'EN_ROUTE_TO_ENDPOINT', 'ISSUE_REPORTED'];
const RUNNING = ACTIVE.filter((s) => s !== 'ASSIGNED' && s !== 'ACCEPTED');
const dayOf = (iso_: string) => new Date(new Date(iso_).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

// ── health & auth ──
on('GET', '/health', () => ({ status: 'ok', mode: 'demo' }));
export const tokenFor = (u: any) => `demo.${u.id}`;
on('POST', '/auth/login', ({ db, body }) => {
  const u = db.users.find((x: any) => x.email.toLowerCase() === String(body.email ?? '').toLowerCase() && x.password === body.password);
  if (!u) throw new HttpError(401, 'Email atau password salah');
  if (!u.active) throw new HttpError(403, 'Akun dinonaktifkan');
  u.last_login = iso(new Date());
  audit(db, { actor: u, action: 'auth.login', entity_type: 'user', entity_id: u.id, scope: 'auth', metadata: { method: 'password' } });
  return { access_token: tokenFor(u), user: { sub: u.id, ...userView(u), role: u.role.name, role_id: u.role_id } };
});
on('POST', '/auth/register', ({ db, body }) => {
  if (db.users.some((x: any) => x.email.toLowerCase() === String(body.email).toLowerCase())) throw new HttpError(409, 'Email sudah terdaftar');
  const id = db.users.length + 1;
  const u = { id, name: body.name, email: body.email, password: body.password, avatar_url: null, nik: null, birth_place: null, birth_date: null, domicile: null, ktp_address: null, role_id: 1, role: { id: 1, name: 'customer' }, active: true, account_status: 'normal', registered_at: iso(new Date()), last_login: null, phone: null };
  db.users.push(u);
  audit(db, { actor: u, action: 'auth.register', entity_type: 'user', entity_id: id, scope: 'auth' });
  return { id, name: u.name, email: u.email, active: true, account_status: 'normal', registered_at: u.registered_at };
});
on('GET', '/auth/me', (c) => userView(need(c)));
on('PUT', '/auth/profile', (c) => { const u = need(c); Object.assign(u, ['name', 'nik', 'birth_place', 'birth_date', 'domicile', 'ktp_address', 'avatar_url'].reduce((a: any, k) => (c.body[k] !== undefined ? { ...a, [k]: c.body[k] } : a), {})); audit(c.db, { actor: u, action: 'profile.update', entity_type: 'user', entity_id: u.id, scope: 'auth' }); return userView(u); });
const fileToDataUrl = async (f: any) => { const buf = Buffer.from(await f.arrayBuffer()); return `data:${f.type || 'application/octet-stream'};base64,${buf.toString('base64')}`; };
on('POST', '/auth/profile/avatar', async (c) => { const u = need(c); const f = c.form?.get('file') as any; if (!f) throw bad('File wajib diunggah'); u.avatar_url = await fileToDataUrl(f); return userView(u); });

// ── heritage ──
function heritageList(c: Ctx) {
  const q = c.query; const s = (q.get('search') ?? q.get('q') ?? '').toLowerCase();
  let rows = c.db.heritage.filter((h: any) => (!q.get('category') || h.category === q.get('category')) && (!q.get('kecamatan') || h.kecamatan === q.get('kecamatan')) && (!q.get('status') || h.status === q.get('status')) && (!s || `${h.name} ${h.address} ${h.kelurahan}`.toLowerCase().includes(s)));
  if (q.get('sort') === 'nearest' && q.get('latitude')) {
    const p = { lat: Number(q.get('latitude')), lng: Number(q.get('longitude')) };
    rows = rows.map((h: any) => ({ ...h, distance_km: Number(haversineKm(p, { lat: h.latitude, lng: h.longitude }).toFixed(2)) })).sort((a: any, b: any) => a.distance_km - b.distance_km);
  } else rows = [...rows].sort((a: any, b: any) => a.name.localeCompare(b.name));
  return pageOf(rows, q, 12);
}
on('GET', '/heritage', heritageList);
on('GET', '/heritage/geojson', ({ db }) => ({ type: 'FeatureCollection', features: db.heritage.filter((h: any) => h.status !== 'tidak aktif').map((h: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [h.longitude, h.latitude] }, properties: { id: h.id, name: h.name, category: h.category, address: h.address, kecamatan: h.kecamatan, status: h.status, image_url: h.image_url } })) }));
const countBy = (rows: any[], k: string, label: string) => Object.entries(rows.reduce((a: any, r) => ((a[r[k]] = (a[r[k]] ?? 0) + 1), a), {})).map(([key, v]) => ({ [label]: key, count: String(v) }));
on('GET', '/heritage/stats/category', ({ db }) => countBy(db.heritage, 'category', 'category'));
on('GET', '/heritage/stats/kecamatan', ({ db }) => countBy(db.heritage, 'kecamatan', 'kecamatan'));
on('GET', '/heritage/stats/summary', ({ db }) => ({ total: db.heritage.length, aktif: db.heritage.filter((h: any) => h.status === 'aktif').length, byCategory: countBy(db.heritage, 'category', 'category'), byKecamatan: countBy(db.heritage, 'kecamatan', 'kecamatan') }));
on('POST', '/heritage/upload', async (c) => { need(c, ...STAFF_ADMIN); const f = c.form?.get('file') as any; if (!f) throw bad('File wajib diunggah'); return { url: await fileToDataUrl(f), filename: f.name, mimetype: f.type }; });
on('GET', '/heritage/:id', (c) => must(byId(c.db.heritage, c.params.id), 'Situs tidak ditemukan'));
on('POST', '/heritage', (c) => { const u = need(c, ...STAFF_ADMIN); const h = { id: nextId(c.db, 'heritage_x') + 1000, status: 'aktif', category: 'BG', images: [], youtube_links: [], pdf_files: [], created_at: iso(new Date()), ...c.body, latitude: num(c.body.latitude), longitude: num(c.body.longitude) }; h.id = Math.max(...c.db.heritage.map((x: any) => x.id)) + 1; if (!h.image_url && h.images?.[0]) h.image_url = h.images[0].url; c.db.heritage.push(h); audit(c.db, { actor: u, action: 'heritage.create', entity_type: 'heritage', entity_id: h.id, scope: 'master', metadata: { name: h.name } }); return h; });
on('PUT', '/heritage/:id', (c) => { const u = need(c, ...STAFF_ADMIN); const h = must(byId(c.db.heritage, c.params.id)); Object.assign(h, c.body, { id: h.id }); audit(c.db, { actor: u, action: 'heritage.update', entity_type: 'heritage', entity_id: h.id, scope: 'master', metadata: { name: h.name } }); return h; });
on('DELETE', '/heritage/:id', (c) => { const u = need(c, ...STAFF_ADMIN); const h = must(byId(c.db.heritage, c.params.id)); if (c.db.routes.some((r: any) => r.heritage_site_id === h.id)) throw new HttpError(409, 'Situs masih dipakai pada paket wisata'); c.db.heritage = c.db.heritage.filter((x: any) => x.id !== h.id); audit(c.db, { actor: u, action: 'heritage.delete', entity_type: 'heritage', entity_id: h.id, scope: 'master' }); return { message: 'Situs dihapus' }; });

// ── paket ──
on('GET', '/tour-packages', ({ db, query }) => { let rows = db.packages.filter((p: any) => (query.get('active') == null || String(p.active) === query.get('active')) && (!query.get('search') || p.name.toLowerCase().includes(String(query.get('search')).toLowerCase()))); return pageOf(rows.map((p: any) => packageView(db, p)), query, 10); });
on('GET', '/tour-packages/:id', (c) => packageView(c.db, must(byId(c.db.packages, c.params.id), 'Paket tidak ditemukan')));
const setPkgRoutes = (db: Db, pid: number, ids?: number[]) => { if (!ids) return; db.routes = db.routes.filter((r: any) => r.tour_package_id !== pid); ids.forEach((hid, i) => db.routes.push({ id: nextId(db, 'route_x') + 5000, tour_package_id: pid, heritage_site_id: hid, sequence: i + 1, notes: null })); };
on('POST', '/tour-packages', (c) => { const u = need(c, ...STAFF_ADMIN); const { heritageIds, ...rest } = c.body; const p = { id: Math.max(...c.db.packages.map((x: any) => x.id)) + 1, active: true, price_per_person: 0, created_at: iso(new Date()), ...rest }; c.db.packages.push(p); setPkgRoutes(c.db, p.id, heritageIds); audit(c.db, { actor: u, action: 'package.create', entity_type: 'tour_package', entity_id: p.id, scope: 'master', metadata: { name: p.name } }); return packageView(c.db, p); });
on('PUT', '/tour-packages/:id/toggle-active', (c) => { const u = need(c, ...STAFF_ADMIN); const p = must(byId(c.db.packages, c.params.id)); p.active = !p.active; audit(c.db, { actor: u, action: 'package.toggle_active', entity_type: 'tour_package', entity_id: p.id, scope: 'master', metadata: { active: p.active } }); return packageView(c.db, p); });
on('PUT', '/tour-packages/:id/reorder', (c) => { need(c, ...STAFF_ADMIN); const p = must(byId(c.db.packages, c.params.id)); (c.body.sequences ?? []).forEach((s: any) => { const r = byId(c.db.routes, s.routeId); if (r) r.sequence = s.sequence; }); return packageView(c.db, p); });
on('PUT', '/tour-packages/:id', (c) => { const u = need(c, ...STAFF_ADMIN); const p = must(byId(c.db.packages, c.params.id)); const { heritageIds, ...rest } = c.body; Object.assign(p, rest, { id: p.id }); setPkgRoutes(c.db, p.id, heritageIds); audit(c.db, { actor: u, action: 'package.update', entity_type: 'tour_package', entity_id: p.id, scope: 'master' }); return packageView(c.db, p); });
on('DELETE', '/tour-packages/:id', (c) => { const u = need(c, ...STAFF_ADMIN); const p = must(byId(c.db.packages, c.params.id)); if (c.db.bookings.some((b: any) => b.tour_package_id === p.id)) throw new HttpError(409, 'Paket sudah memiliki booking; nonaktifkan saja'); c.db.packages = c.db.packages.filter((x: any) => x !== p); c.db.routes = c.db.routes.filter((r: any) => r.tour_package_id !== p.id); audit(c.db, { actor: u, action: 'package.delete', entity_type: 'tour_package', entity_id: p.id, scope: 'master' }); return { message: 'Paket dihapus' }; });

// ── package routes ──
const prView = (db: Db, r: any) => ({ ...r, heritage_site: siteView(db, r.heritage_site_id), tour_package: byId(db.packages, r.tour_package_id) });
on('GET', '/package-routes', ({ db, query }) => db.routes.filter((r: any) => !query.get('tour_package_id') || r.tour_package_id === Number(query.get('tour_package_id'))).sort((a: any, b: any) => a.sequence - b.sequence).map((r: any) => prView(db, r)));
on('PUT', '/package-routes/by-package/:pid/reorder', (c) => { need(c, ...STAFF_ADMIN); (c.body.items ?? []).forEach((i: any) => { const r = byId(c.db.routes, i.id); if (r) r.sequence = i.sequence; }); return c.db.routes.filter((r: any) => r.tour_package_id === Number(c.params.pid)).map((r: any) => prView(c.db, r)); });
on('DELETE', '/package-routes/by-package/:pid', (c) => { need(c, ...STAFF_ADMIN); c.db.routes = c.db.routes.filter((r: any) => r.tour_package_id !== Number(c.params.pid)); return { message: 'Semua rute paket dihapus' }; });
on('GET', '/package-routes/:id', (c) => prView(c.db, must(byId(c.db.routes, c.params.id))));
on('POST', '/package-routes', (c) => { need(c, ...STAFF_ADMIN); const r = { id: nextId(c.db, 'route_x') + 5000, notes: null, ...c.body }; c.db.routes.push(r); return prView(c.db, r); });
on('PUT', '/package-routes/:id', (c) => { need(c, ...STAFF_ADMIN); const r = must(byId(c.db.routes, c.params.id)); Object.assign(r, c.body, { id: r.id }); return prView(c.db, r); });
on('DELETE', '/package-routes/:id', (c) => { need(c, ...STAFF_ADMIN); c.db.routes = c.db.routes.filter((r: any) => r.id !== Number(c.params.id)); return { message: 'Rute dihapus' }; });

// ── rental ──
on('GET', '/rental-options', ({ db, query }) => db.rentals.filter((r: any) => query.get('active') == null || String(r.active) === query.get('active')));
on('POST', '/rental-options', (c) => { need(c, ...STAFF_ADMIN); const r = { id: Math.max(...c.db.rentals.map((x: any) => x.id)) + 1, active: true, base_price: 0, price_per_person: 0, created_at: iso(new Date()), ...c.body }; c.db.rentals.push(r); return r; });
on('PUT', '/rental-options/:id', (c) => { need(c, ...STAFF_ADMIN); const r = must(byId(c.db.rentals, c.params.id)); Object.assign(r, c.body, { id: r.id }); return r; });
on('DELETE', '/rental-options/:id', (c) => { need(c, ...STAFF_ADMIN); c.db.rentals = c.db.rentals.filter((r: any) => r.id !== Number(c.params.id)); return { message: 'Opsi sewa dihapus' }; });

// ── sakoci ──
on('GET', '/sakoci/public', ({ db }) => db.sakoci.filter((s: any) => s.active && s.tracking_enabled && s.tracking_visibility === 'public' && s.latitude != null).map((s: any) => { const t = db.trips.find((x: any) => x.sakoci_id === s.id && x.tracking_active); return { ...strip(s, 'notes'), activeTripId: t?.id ?? null, showPublicCurrentRoute: db.settings.showPublicCurrentRoute, showSakociGraphRadius: db.settings.showSakociGraphRadius }; }));
on('GET', '/sakoci', ({ db, query }) => db.sakoci.filter((s: any) => (query.get('active') == null || String(s.active) === query.get('active')) && (!query.get('status') || s.status === query.get('status'))));
on('GET', '/sakoci/:id', (c) => must(byId(c.db.sakoci, c.params.id)));
on('POST', '/sakoci', (c) => { const u = need(c, ...STAFF_ADMIN); const s = { id: Math.max(...c.db.sakoci.map((x: any) => x.id)) + 1, status: 'available', active: true, tracking_enabled: true, tracking_visibility: 'public', latitude: null, longitude: null, location_updated_at: null, image_url: null, created_at: iso(new Date()), ...c.body }; c.db.sakoci.push(s); audit(c.db, { actor: u, action: 'sakoci.create', entity_type: 'sakoci', entity_id: s.id, scope: 'master' }); return s; });
on('PUT', '/sakoci/:id/location', (c) => { need(c, ...STAFF_ADMIN, 'driver'); const s = must(byId(c.db.sakoci, c.params.id)); Object.assign(s, { latitude: num(c.body.latitude), longitude: num(c.body.longitude), location_updated_at: iso(new Date()) }); return s; });
on('POST', '/sakoci/:id/image', async (c) => { const u = need(c, ...STAFF_ADMIN); const s = must(byId(c.db.sakoci, c.params.id)); const f = c.form?.get('file') as any; if (!f) throw bad('File wajib diunggah'); s.image_url = await fileToDataUrl(f); audit(c.db, { actor: u, action: 'sakoci.image_upload', entity_type: 'sakoci', entity_id: s.id, scope: 'master' }); return s; });
on('PUT', '/sakoci/:id', (c) => { const u = need(c, ...STAFF_ADMIN); const s = must(byId(c.db.sakoci, c.params.id)); Object.assign(s, c.body, { id: s.id }); audit(c.db, { actor: u, action: 'sakoci.update', entity_type: 'sakoci', entity_id: s.id, scope: 'master' }); return s; });
on('DELETE', '/sakoci/:id', (c) => { need(c, ...STAFF_ADMIN); const s = must(byId(c.db.sakoci, c.params.id)); if (c.db.trips.some((t: any) => t.sakoci_id === s.id && ACTIVE.includes(t.trip_status))) throw new HttpError(409, 'Sakoci sedang dipakai pada trip aktif'); c.db.sakoci = c.db.sakoci.filter((x: any) => x !== s); return { message: 'Sakoci dihapus' }; });

// ── admin users ──
on('GET', '/admin/users/roles', ({ db }) => db.roles);
on('GET', '/admin/users', (c) => { need(c, 'super_admin'); const q = c.query; const s = (q.get('search') ?? '').toLowerCase(); const rows = c.db.users.filter((u: any) => (!s || `${u.name} ${u.email}`.toLowerCase().includes(s)) && (!q.get('status') || u.account_status === q.get('status')) && (!q.get('role') || String(u.role_id) === q.get('role') || u.role.name === q.get('role'))).map(userView); return pageOf(rows, q, 15); });
on('GET', '/admin/users/:id', (c) => { need(c, 'super_admin'); return userView(must(byId(c.db.users, c.params.id))); });
on('POST', '/admin/users', (c) => { const a = need(c, 'super_admin'); if (c.db.users.some((x: any) => x.email === c.body.email)) throw new HttpError(409, 'Email sudah terdaftar'); const role = byId(c.db.roles, c.body.role_id ?? 1); const u = { ...c.body, id: c.db.users.length + 1, avatar_url: null, role_id: role.id, role, active: true, account_status: c.body.account_status ?? 'normal', registered_at: iso(new Date()), last_login: null }; c.db.users.push(u); audit(c.db, { actor: a, action: 'user.create', entity_type: 'user', entity_id: u.id, scope: 'system', metadata: { email: u.email, role: role.name } }); return userView(u); });
on('PUT', '/admin/users/:id/status', (c) => { const a = need(c, 'super_admin'); const u = must(byId(c.db.users, c.params.id)); u.account_status = c.body.status; u.active = c.body.status === 'normal'; audit(c.db, { actor: a, action: 'user.update_status', entity_type: 'user', entity_id: u.id, scope: 'system', metadata: { status: c.body.status } }); return userView(u); });
on('PUT', '/admin/users/:id/role', (c) => { const a = need(c, 'super_admin'); const u = must(byId(c.db.users, c.params.id)); const role = byId(c.db.roles, c.body.role_id ?? 1); u.role_id = role.id; u.role = role; audit(c.db, { actor: a, action: 'user.update_role', entity_type: 'user', entity_id: u.id, scope: 'system', metadata: { role: role.name } }); return userView(u); });
on('DELETE', '/admin/users/:id', (c) => { const a = need(c, 'super_admin'); const u = must(byId(c.db.users, c.params.id)); if (u.id === a.id) throw bad('Tidak dapat menghapus akun sendiri'); u.account_status = 'deleted'; u.active = false; audit(c.db, { actor: a, action: 'user.delete', entity_type: 'user', entity_id: u.id, scope: 'system' }); return { message: 'Akun dinonaktifkan (soft delete)', user: userView(u) }; });

// ── bookings ──
const adminOrGuide = (c: Ctx) => need(c, ...STAFF_ADMIN, 'tour_guide');
function bookingList(c: Ctx) {
  const u = adminOrGuide(c); const q = c.query; const s = (q.get('search') ?? '').toLowerCase();
  let rows = c.db.bookings.filter((b: any) => (roleName(u) !== 'tour_guide' || b.assigned_tour_guide_id === u.id) && (!q.get('status') || b.status === q.get('status')) && (!q.get('payment_status') || b.payment_status === q.get('payment_status')) && (!q.get('booking_type') || b.booking_type === q.get('booking_type')) && (!q.get('date') || b.visit_date === q.get('date')) && (!s || `${b.group_name} ${bookingCode(b.id)} ${b.contact_email ?? ''}`.toLowerCase().includes(s)));
  rows = rows.sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
  const p = pageOf(rows, q, 30); return { ...p, data: p.data.map((b: any) => bookingView(c.db, b)) };
}
on('GET', '/bookings', bookingList);
on('GET', '/bookings/stats', (c) => {
  adminOrGuide(c); const bs = c.db.bookings; const cnt = (st: string) => bs.filter((b: any) => b.status === st).length;
  const months: Record<string, { count: number; visitors: number }> = {};
  bs.filter((b: any) => b.status !== 'cancelled').forEach((b: any) => { const m = b.visit_date.slice(0, 7); months[m] ??= { count: 0, visitors: 0 }; months[m].count++; months[m].visitors += b.participants; });
  return { total: bs.length, pending: cnt('pending'), confirmed: cnt('confirmed') + cnt('assigned') + cnt('in_progress'), completed: cnt('completed'), cancelled: cnt('cancelled'), revenue: bs.filter((b: any) => b.payment_status === 'paid').reduce((a: number, b: any) => a + (b.paid_amount ?? b.total_price), 0), monthly: Object.entries(months).sort().map(([month, v]) => ({ month, count: String(v.count), visitors: String(v.visitors) })) };
});
on('GET', '/bookings/availability', ({ db, query }) => {
  const date = query.get('visit_date'); const time = query.get('pickup_time') ?? '08:00'; const n = Number(query.get('participants') ?? 1);
  const pkg = query.get('tour_package_id') ? byId(db.packages, query.get('tour_package_id')) : null;
  const mins = Number(query.get('duration_minutes') ?? (pkg ? pkg.duration_hours * 60 : 180)); const start = new Date(`${date}T${time}:00+07:00`); const end = new Date(start.getTime() + mins * 60000);
  const capacity = db.settings.defaultCapacityLimit;
  const booked = db.bookings.filter((b: any) => b.visit_date === date && !['cancelled'].includes(b.status) && ['confirmed', 'assigned', 'in_progress', 'pending'].includes(b.status) && b.payment_status !== 'expired').length;
  return { available: booked < capacity && n <= 24, capacity, booked, remaining: Math.max(0, capacity - booked), maxParticipantsPerBooking: 24, participantCapacity: 24, start: iso(start), end: iso(end) };
});
on('GET', '/bookings/staff', (c) => { need(c, ...STAFF_ADMIN); const role = c.query.get('role'); return c.db.users.filter((u: any) => ['tour_guide', 'driver'].includes(u.role.name) && u.active && (!role || u.role.name === role)).map(userView); });
on('GET', '/bookings/me', (c) => { const u = need(c); return c.db.bookings.filter((b: any) => b.user_id === u.id).sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1)).map((b: any) => bookingView(c.db, b)); });
function createBooking(c: Ctx, owner: any) {
  const body = c.body; const db = c.db; const type = body.booking_type ?? (body.tour_package_id ? 'package' : body.rental_option_id ? 'rental' : 'private');
  const pkg = body.tour_package_id ? must(byId(db.packages, body.tour_package_id), 'Paket tidak ditemukan') : null; const rent = body.rental_option_id ? byId(db.rentals, body.rental_option_id) : null;
  const n = Number(body.participants ?? 1); const nd = (body.private_destination_ids ?? []).length;
  const price = type === 'package' ? pkg.price_per_person * n : type === 'rental' ? (rent?.base_price ?? 0) + (rent?.price_per_person ?? 0) * n : 60000 * n + 80000 * nd;
  const id = nextId(db, 'booking');
  const b: any = { id, booking_type: type, group_name: body.group_name ?? body.groupName ?? body.name ?? body.nama_rombongan ?? `Rombongan ${owner.name}`, tour_package_id: pkg?.id, rental_option_id: rent?.id, visit_date: body.visit_date, pickup_time: body.pickup_time, pickup_location: body.pickup_location, pickup_maps_url: body.pickup_maps_url, pickup_latitude: num(body.pickup_latitude), pickup_longitude: num(body.pickup_longitude), private_destination_ids: body.private_destination_ids, participants: n, status: 'pending', payment_status: 'unpaid', payment_method: null, paid_amount: null, payment_proof_url: null, admin_payment_proof_url: null, payment_notes: null, payment_rejection_reason: null, payment_verified_at: null, payment_rejected_at: null, cancelled_at: null, cancelled_by_role: null, cancellation_reason: null, assigned_tour_guide_id: null, assigned_driver_id: null, sakoci_id: null, vehicle_name: null, vehicle_plate_number: null, vehicle_latitude: null, vehicle_longitude: null, vehicle_location_updated_at: null, contact_phone: body.contact_phone ?? owner.phone, contact_email: body.contact_email ?? owner.email, notes: body.notes ?? null, total_price: price, created_at: iso(new Date()), user_id: owner.id };
  db.bookings.push(b);
  for (const k of ['nik', 'birth_place', 'birth_date', 'domicile', 'ktp_address']) if (body[k] && !owner[k]) owner[k] = body[k];
  audit(db, { actor: owner, action: 'booking.create', entity_type: 'booking', entity_id: id, booking_code: bookingCode(id), scope: 'booking', metadata: { type, participants: n, total: price } });
  return bookingView(db, b);
}
on('POST', '/bookings/me', (c) => createBooking(c, need(c)));
on('POST', '/bookings', (c) => createBooking(c, c.user ?? c.db.users.find((u: any) => u.email === 'customer@cimahiheritage.id')));
function canSee(c: Ctx, b: any) {
  const u = need(c); const r = roleName(u);
  if (STAFF_ADMIN.includes(r)) return true; if (r === 'tour_guide') return b.assigned_tour_guide_id === u.id; if (r === 'driver') return b.assigned_driver_id === u.id; return b.user_id === u.id;
}
const getBooking = (c: Ctx) => { const b = must(byId(c.db.bookings, c.params.id), 'Booking tidak ditemukan'); if (!canSee(c, b)) throw new HttpError(403, 'Anda tidak memiliki akses ke booking ini'); return b; };
on('GET', '/bookings/:id', (c) => bookingView(c.db, getBooking(c)));
function routeSnapshotOf(c: Ctx, b: any) {
  const t = c.db.trips.filter((x: any) => x.booking_id === b.id).pop();
  if (t?.route_snapshot) { const s = t.route_snapshot; return { status: 'success', routeStatus: s.route_status, orderedDestinationIds: t.itinerary_items.filter((i: any) => i.stop_type === 'DESTINATION').map((i: any) => i.heritage_site_id), totalDistanceKm: s.total_distance_km, totalDurationMinutes: s.total_duration_minutes, segments: s.segments, geojson: s.geojson, routeSource: 'GRAPH_DIJKSTRA', routingBuildId: s.routing_build_id, finalizedAt: s.finalized_at, staleReason: s.route_status === 'stale' ? 'Destinasi dilewati / rute berubah' : null, errorMessage: null }; }
  const d = bookingDestinations(c.db, b); const pts = [{ id: 'pickup', name: b.pickup_location ?? 'Titik jemput', latitude: b.pickup_latitude ?? d[0]?.latitude, longitude: b.pickup_longitude ?? d[0]?.longitude }, ...d];
  const r = buildRoute(c.db, pts);
  return { status: 'success', routeStatus: 'pending', orderedDestinationIds: d.map((x: any) => x.id), totalDistanceKm: r.totalKm, totalDurationMinutes: r.totalMin, segments: r.segments, geojson: r.geojson, routeSource: 'GRAPH_DIJKSTRA', routingBuildId: null, finalizedAt: null, staleReason: null, errorMessage: null };
}
on('GET', '/bookings/:id/route', (c) => routeSnapshotOf(c, getBooking(c)));
on('POST', '/bookings/:id/finalize-route', (c) => { const u = need(c, ...STAFF_ADMIN); const b = getBooking(c); const t = c.db.trips.filter((x: any) => x.booking_id === b.id).pop(); if (t?.route_snapshot) { t.route_snapshot.route_status = 'final'; t.route_snapshot.finalized_at = iso(new Date()); } audit(c.db, { actor: u, action: 'route.finalize', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'booking' }); return { ...routeSnapshotOf(c, b), routeStatus: 'final', finalizedAt: iso(new Date()) }; });
on('POST', '/bookings/:id/reoptimize-route', (c) => { const u = need(c, ...STAFF_ADMIN); const b = getBooking(c); const t = c.db.trips.filter((x: any) => x.booking_id === b.id).pop(); if (t) { const items = t.itinerary_items; const r = buildRoute(c.db, items.map((i: any) => ({ id: i.id, name: i.name, latitude: i.latitude, longitude: i.longitude }))); t.route_snapshot = { route_status: 'final', routing_build_id: 'demo-build-' + Date.now().toString(36), finalized_at: iso(new Date()), total_distance_km: r.totalKm, total_duration_minutes: r.totalMin, geojson: r.geojson, segments: r.segments }; t._route = { nodeIds: r.nodeIds, edgeIds: r.edgeIds }; } audit(c.db, { actor: u, action: 'route.reoptimize', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'booking', metadata: { reason: c.body.reason } }); return routeSnapshotOf(c, b); });
on('PUT', '/bookings/:id/travel', (c) => { const b = getBooking(c); if (!['pending', 'confirmed'].includes(b.status)) throw bad('Jadwal hanya dapat diubah sebelum penugasan'); for (const k of ['group_name', 'visit_date', 'pickup_time', 'participants', 'pickup_location', 'pickup_maps_url', 'pickup_latitude', 'pickup_longitude', 'private_destination_ids', 'contact_phone', 'notes']) if (c.body[k] !== undefined) b[k] = c.body[k]; audit(c.db, { actor: c.user, action: 'booking.update_travel', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'booking' }); return bookingView(c.db, b); });
on('PUT', '/bookings/:id/status', (c) => { const u = need(c, ...STAFF_ADMIN); const b = getBooking(c); const prev = b.status; b.status = c.body.status; if (c.body.notes) b.notes = c.body.notes; audit(c.db, { actor: u, action: 'booking.update_status', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'booking', metadata: { from: prev, to: b.status } }); return bookingView(c.db, b); });
on('PUT', '/bookings/:id/assignment', (c) => { const u = need(c, ...STAFF_ADMIN); const b = getBooking(c); for (const k of ['assigned_tour_guide_id', 'assigned_driver_id', 'sakoci_id', 'vehicle_name', 'vehicle_plate_number']) if (c.body[k] !== undefined) b[k] = c.body[k]; audit(c.db, { actor: u, action: 'booking.update_assignment', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'booking', metadata: c.body }); return bookingView(c.db, b); });
on('PUT', '/bookings/:id/payment', (c) => { const u = need(c, ...STAFF_ADMIN); const b = getBooking(c); Object.assign(b, strip(c.body, 'id')); audit(c.db, { actor: u, action: 'payment.update', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'payment', metadata: c.body }); return bookingView(c.db, b); });
on('POST', '/bookings/:id/payment/verify', (c) => { const u = need(c, ...STAFF_ADMIN); const b = getBooking(c); if (b.payment_status !== 'waiting_verification') throw bad('Hanya pembayaran menunggu verifikasi yang dapat diproses'); Object.assign(b, { payment_status: 'paid', status: 'confirmed', paid_amount: c.body.paid_amount ?? b.total_price, payment_method: c.body.payment_method ?? b.payment_method, payment_verified_at: iso(new Date()), admin_payment_proof_url: '/uploads/payments/proof-admin.svg', payment_rejection_reason: null }); audit(c.db, { actor: u, action: 'payment.verify', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'payment', metadata: { paid_amount: b.paid_amount } }); return bookingView(c.db, b); });
on('POST', '/bookings/:id/payment/reject', (c) => { const u = need(c, ...STAFF_ADMIN); const b = getBooking(c); if (b.payment_status !== 'waiting_verification') throw bad('Hanya pembayaran menunggu verifikasi yang dapat diproses'); if (!c.body.reason) throw bad('Alasan penolakan wajib diisi'); Object.assign(b, { payment_status: 'rejected', status: 'pending', payment_rejection_reason: c.body.reason, payment_rejected_at: iso(new Date()) }); audit(c.db, { actor: u, action: 'payment.reject', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'payment', metadata: { reason: c.body.reason } }); return bookingView(c.db, b); });
on('POST', '/bookings/:id/payment/upload', async (c) => { const b = getBooking(c); if (!['unpaid', 'waiting_verification', 'rejected'].includes(b.payment_status)) throw bad('Status pembayaran tidak dapat diunggah ulang'); const f = c.form?.get('file') as any; if (!f) throw bad('File bukti pembayaran wajib diunggah'); b.payment_proof_url = await fileToDataUrl(f); b.payment_status = 'waiting_verification'; b.payment_method ??= 'Transfer Bank'; b.payment_rejection_reason = null; audit(c.db, { actor: c.user, action: 'payment.proof_upload', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'payment' }); return bookingView(c.db, b); });
on('GET', '/bookings/:id/payment/proof/:kind', (c) => { const b = getBooking(c); const url = c.params.kind === 'admin' ? b.admin_payment_proof_url : b.payment_proof_url; if (!url) throw notFound('Bukti pembayaran belum tersedia'); return { __file: url }; });
on('POST', '/bookings/:id/cancel', (c) => { const u = need(c); const b = getBooking(c); const admin = STAFF_ADMIN.includes(roleName(u)); if (['cancelled', 'completed', 'in_progress'].includes(b.status) || (b.status === 'assigned' && !admin) || (!admin && b.payment_status === 'paid')) throw bad('Booking tidak dapat dibatalkan dari status ini'); if (!c.body.reason) throw bad('Alasan pembatalan wajib diisi'); Object.assign(b, { status: 'cancelled', cancelled_at: iso(new Date()), cancelled_by_role: roleName(u), cancellation_reason: c.body.reason }); c.db.trips.filter((t: any) => t.booking_id === b.id && ACTIVE.includes(t.trip_status)).forEach((t: any) => { addHistory(c.db, t, t.trip_status, 'CANCEL_TRIP', 'CANCELLED', new Date(), c.body.reason); t.trip_status = 'CANCELLED'; t.cancellation_reason = c.body.reason; t.tracking_active = false; const sk = byId(c.db.sakoci, t.sakoci_id); if (sk?.status === 'assigned') sk.status = 'available'; }); audit(c.db, { actor: u, action: 'booking.cancel', entity_type: 'booking', entity_id: b.id, booking_code: bookingCode(b.id), scope: 'booking', metadata: { reason: c.body.reason } }); return bookingView(c.db, b); });
on('PUT', '/bookings/:id/location', (c) => { need(c, ...STAFF_ADMIN, 'driver'); const b = getBooking(c); Object.assign(b, { vehicle_latitude: num(c.body.latitude), vehicle_longitude: num(c.body.longitude), vehicle_location_updated_at: iso(new Date()) }); return bookingView(c.db, b); });
on('GET', '/bookings/:id/receipt', (c) => {
  const b = getBooking(c); const s = c.db.settings; const svc = b.tour_package_id ? byId(c.db.packages, b.tour_package_id)?.name : b.rental_option_id ? byId(c.db.rentals, b.rental_option_id)?.name : 'Perjalanan Privat';
  const sk = b.sakoci_id ? byId(c.db.sakoci, b.sakoci_id) : null; const d = b.assigned_driver_id ? byId(c.db.users, b.assigned_driver_id) : null; const gd = b.assigned_tour_guide_id ? byId(c.db.users, b.assigned_tour_guide_id) : null;
  const snap = b.assigned_driver_id ? routeSnapshotOf(c, b) : null;
  return { issuer: { appName: s.appName, agencyName: s.agencyName, support: s.customerSupportContact, hotline: s.operationalHotline, hours: s.operationalHours }, booking: { id: b.id, code: bookingCode(b.id), customer: b.group_name, bookingType: b.booking_type, serviceName: svc, visitDate: b.visit_date, pickupTime: b.pickup_time, pickupLocation: b.pickup_location, participants: b.participants, status: b.status, paymentStatus: b.payment_status, amount: b.total_price, paidAmount: b.paid_amount, createdAt: b.created_at, notes: b.notes }, assignment: sk || d || gd ? { sakoci: sk ? { name: sk.name, code: sk.code, plateNumber: sk.plate_number } : null, driver: d ? { name: d.name } : null, guide: gd ? { name: gd.name } : null } : null, route: snap ? { totalDistanceKm: snap.totalDistanceKm, totalDurationMinutes: snap.totalDurationMinutes, orderedDestinationIds: snap.orderedDestinationIds } : null };
});

// ── penugasan trip (admin) ──
const lastTrip = (db: Db, bid: number) => db.trips.filter((t: any) => t.booking_id === bid && t.trip_status !== 'CANCELLED').pop();
on('GET', '/admin/trips/active', (c) => { need(c, ...STAFF_ADMIN, 'tour_guide'); return c.db.trips.filter((t: any) => ACTIVE.includes(t.trip_status) && (t.tracking_active || RUNNING.includes(t.trip_status))).map((t: any) => tripView(c.db, t)); });
on('GET', '/admin/trips/:id/incidents', (c) => { need(c, ...STAFF_ADMIN, 'tour_guide'); return must(byId(c.db.trips, c.params.id)).incidents; });
const incUpdate = (c: Ctx, status?: string) => { const u = need(c, ...STAFF_ADMIN); const t = must(byId(c.db.trips, c.params.id)); const i = must(byId(t.incidents, c.params.iid)); i.status = status ?? c.body.status; if (i.status === 'RESOLVED') { i.resolved_at = iso(new Date()); } if (c.body.resolution_note !== undefined) i.resolution_note = c.body.resolution_note; audit(c.db, { actor: u, action: `incident.${String(i.status).toLowerCase()}`, entity_type: 'trip_incident', entity_id: i.id, booking_code: t.booking_reference, scope: 'trip' }); return i; };
on('PATCH', '/admin/trips/:id/incidents/:iid/resolve', (c) => incUpdate(c, 'RESOLVED'));
on('PATCH', '/admin/trips/:id/incidents/:iid/status', (c) => incUpdate(c));
on('GET', '/admin/bookings/:id/assignment', (c) => { need(c, ...STAFF_ADMIN, 'tour_guide'); const t = lastTrip(c.db, Number(c.params.id)); return t ? tripView(c.db, t) : null; });
function assign(c: Ctx, update: boolean) {
  const u = need(c, ...STAFF_ADMIN); const b = must(byId(c.db.bookings, c.params.id), 'Booking tidak ditemukan'); const body = c.body;
  if (b.payment_status !== 'paid') throw bad('Booking belum lunas');
  if (['cancelled', 'completed', 'in_progress'].includes(b.status)) throw bad('Booking tidak dapat di-assign dari status saat ini');
  const driver = byId(c.db.users, body.driver_id); if (!driver || driver.role.name !== 'driver') throw bad('Driver tidak valid'); if (!driver.active) throw bad('Driver nonaktif');
  const sk = must(byId(c.db.sakoci, body.sakoci_id), 'Sakoci tidak ditemukan'); if (!sk.active || sk.status === 'maintenance') throw bad('Sakoci tidak tersedia (nonaktif/perawatan)');
  const exist = lastTrip(c.db, b.id);
  if (exist && !update) throw new HttpError(409, 'Booking sudah memiliki penugasan aktif', 'ASSIGNMENT_EXISTS');
  if (exist) { if (!['ASSIGNED', 'ACCEPTED'].includes(exist.trip_status)) throw bad('Penugasan sudah berjalan, tidak dapat diubah'); const old = byId(c.db.sakoci, exist.sakoci_id); if (old && old.status === 'assigned') old.status = 'available'; c.db.trips = c.db.trips.filter((t: any) => t !== exist); }
  const trip = createTrip(c.db, b, { driver_id: driver.id, tour_guide_id: body.tour_guide_id ?? null, sakoci_id: sk.id, admin_id: u.id, lead: body.driver_lead_time_minutes, destination_ids: body.destination_ids, duration: body.estimated_duration_minutes, endpoint: body.endpoint });
  audit(c.db, { actor: u, action: update ? 'trip.reassign' : 'trip.assign', entity_type: 'driver_trip', entity_id: trip.id, booking_code: bookingCode(b.id), scope: 'trip', metadata: { driver_id: driver.id, guide_id: body.tour_guide_id ?? null, sakoci_id: sk.id } });
  return tripView(c.db, trip);
}
on('POST', '/admin/bookings/:id/assignment', (c) => assign(c, false));
on('PATCH', '/admin/bookings/:id/assignment', (c) => assign(c, true));
on('POST', '/admin/bookings/:id/assignment/cancel', (c) => { const u = need(c, ...STAFF_ADMIN); const b = must(byId(c.db.bookings, c.params.id)); const t = must(lastTrip(c.db, b.id), 'Penugasan tidak ditemukan'); if (!['ASSIGNED', 'ACCEPTED'].includes(t.trip_status)) throw bad('Penugasan sudah berjalan'); addHistory(c.db, t, t.trip_status, 'CANCEL_ASSIGNMENT', 'CANCELLED', new Date(), c.body.reason); t.trip_status = 'CANCELLED'; t.cancellation_reason = c.body.reason ?? null; b.status = 'confirmed'; Object.assign(b, { assigned_driver_id: null, assigned_tour_guide_id: null, sakoci_id: null, vehicle_name: null, vehicle_plate_number: null }); const sk = byId(c.db.sakoci, t.sakoci_id); if (sk?.status === 'assigned') sk.status = 'available'; audit(c.db, { actor: u, action: 'trip.cancel_assignment', entity_type: 'driver_trip', entity_id: t.id, booking_code: bookingCode(b.id), scope: 'trip', metadata: { reason: c.body.reason } }); return tripView(c.db, t); });

// ── playback ──
function playback(c: Ctx, pub: boolean) {
  const t = must(byId(c.db.trips, c.params.id), 'Trip tidak ditemukan'); if (!pub) need(c); else if (!c.db.settings.publicTrackingEnabled) throw notFound();
  const s = t.route_snapshot; const g = c.db.graph;
  return { tripId: t.id, bookingId: t.booking_id, routeStatus: s?.route_status ?? null, totalDistanceKm: s?.total_distance_km ?? 0, totalDurationMinutes: s?.total_duration_minutes ?? null, orderedDestinationIds: t.itinerary_items.filter((i: any) => i.stop_type === 'DESTINATION').map((i: any) => i.heritage_site_id), geometry: s?.geojson ?? null, nodeIds: t._route?.nodeIds ?? [], edgeIds: t._route?.edgeIds ?? [], graph: null as any, _g: g };
}
on('GET', '/trips/:id/route', (c) => strip(playback(c, false), '_g'));
on('GET', '/trips/:id/public-route', (c) => strip(playback(c, true), '_g'));

// ── dashboard / operasi ──
const alertsOf = (db: Db) => {
  const out: any[] = [];
  db.bookings.filter((b: any) => b.payment_status === 'waiting_verification' && b.status !== 'cancelled').forEach((b: any) => out.push({ id: `pay-${b.id}`, type: 'payment_pending', priority: 'medium', timestamp: b.created_at, summary: `${bookingCode(b.id)} menunggu verifikasi pembayaran (${b.group_name})`, href: `/admin/booking/${b.id}` }));
  db.bookings.filter((b: any) => b.payment_status === 'paid' && b.status === 'confirmed' && !b.assigned_driver_id).forEach((b: any) => out.push({ id: `asg-${b.id}`, type: 'assignment_needed', priority: new Date(`${b.visit_date}T00:00:00+07:00`).getTime() - Date.now() < 3 * 86400e3 ? 'high' : 'low', timestamp: b.created_at, summary: `${bookingCode(b.id)} sudah lunas, belum ada driver/Sakoci (kunjungan ${b.visit_date})`, href: `/admin/booking/${b.id}` }));
  db.trips.forEach((t: any) => { t.incidents.filter((i: any) => i.status !== 'RESOLVED').forEach((i: any) => out.push({ id: `inc-${i.id}`, type: 'incident', priority: 'high', timestamp: i.reported_at, summary: `Insiden ${t.booking_reference}: ${i.issue_type} (${i.status})`, href: '/admin/monitoring' })); if (t.route_snapshot?.route_status === 'stale' && ACTIVE.includes(t.trip_status)) out.push({ id: `rt-${t.id}`, type: 'route_stale', priority: 'medium', timestamp: t.updated_at, summary: `Rute ${t.booking_reference} perlu dioptimasi ulang`, href: `/admin/booking/${t.booking_id}` }); });
  return out.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
};
on('GET', '/admin/notifications', (c) => { need(c, ...STAFF_ADMIN); const a = alertsOf(c.db); return { data: a.slice(0, Number(c.query.get('limit') ?? 50)), total: a.length }; });
on('GET', '/admin/dashboard/summary', (c) => {
  need(c, ...STAFF_ADMIN, 'tour_guide'); const db = c.db; const period = (c.query.get('period') ?? '7d') as '7d' | '30d' | 'month'; const today = todayWib();
  const bs = db.bookings; const it = (b: any, extra: any = {}) => ({ id: b.id, code: bookingCode(b.id), group_name: b.group_name, status: b.status, href: `/admin/booking/${b.id}`, ...extra });
  const pending = bs.filter((b: any) => b.payment_status === 'waiting_verification' && b.status !== 'cancelled');
  const ready = bs.filter((b: any) => b.payment_status === 'paid' && b.status === 'confirmed' && !b.assigned_driver_id);
  const up = db.trips.filter((t: any) => ['ASSIGNED', 'ACCEPTED'].includes(t.trip_status)).sort((a: any, b: any) => (a.scheduled_user_pickup_at < b.scheduled_user_pickup_at ? -1 : 1)).slice(0, 8);
  const inc = db.trips.flatMap((t: any) => t.incidents.filter((i: any) => i.status !== 'RESOLVED').map((i: any) => ({ id: i.id, issue_type: i.issue_type, status: i.status, group_name: t.booking_reference, href: '/admin/monitoring', code: undefined })));
  const days = period === '7d' ? 7 : period === '30d' ? 30 : new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const dates = period === 'month' ? Array.from({ length: days }, (_, i) => `${today.slice(0, 8)}${String(i + 1).padStart(2, '0')}`) : Array.from({ length: days }, (_, i) => new Date(new Date(`${today}T12:00:00+07:00`).getTime() - (days - 1 - i) * 86400e3).toISOString().slice(0, 10));
  const inRange = bs.filter((b: any) => b.visit_date >= dates[0] && b.visit_date <= dates[dates.length - 1]);
  const dist: Record<string, number> = {}; inRange.forEach((b: any) => (dist[b.status] = (dist[b.status] ?? 0) + 1));
  const pop: Record<string, number> = {}; inRange.filter((b: any) => b.status !== 'cancelled').forEach((b: any) => { const n = b.tour_package_id ? byId(db.packages, b.tour_package_id).name : b.rental_option_id ? byId(db.rentals, b.rental_option_id).name : 'Perjalanan Privat'; pop[n] = (pop[n] ?? 0) + 1; });
  return {
    period, cards: { bookingsToday: bs.filter((b: any) => b.visit_date === today && b.status !== 'cancelled').length, pendingPayments: pending.length, readyAssignment: ready.length, activeTrips: db.trips.filter((t: any) => RUNNING.includes(t.trip_status)).length, completedToday: db.trips.filter((t: any) => t.trip_status === 'COMPLETED' && dayOf(t.completed_at) === today).length, openIncidents: inc.length },
    queues: { pendingPayments: pending.slice(0, 8).map((b: any) => it(b, { payment_status: b.payment_status })), readyAssignment: ready.slice(0, 8).map((b: any) => it(b, { visit_date: b.visit_date })), upcomingDepartures: up.map((t: any) => ({ id: t.booking_id, code: t.booking_reference, group_name: byId(db.bookings, t.booking_id).group_name, status: t.trip_status, href: `/admin/booking/${t.booking_id}`, scheduled_user_pickup_at: t.scheduled_user_pickup_at })), activeIncidents: inc.slice(0, 8) },
    charts: { bookingTrend: dates.map((d) => ({ date: d, count: bs.filter((b: any) => b.visit_date === d && b.status !== 'cancelled').length })), statusDistribution: Object.entries(dist).map(([status, count]) => ({ status, count })), popularPackages: Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })) },
    alerts: [{ type: 'payment_pending', count: pending.length, href: '/admin/payments' }, { type: 'assignment_needed', count: ready.length, href: '/admin/booking' }, { type: 'incident', count: inc.length, href: '/admin/monitoring' }].filter((a) => a.count > 0),
  };
});
on('GET', '/admin/settings', (c) => { need(c, ...STAFF_ADMIN); return c.db.settings; });
on('POST', '/admin/settings', (c) => { const u = need(c, 'super_admin'); Object.assign(c.db.settings, c.body); audit(c.db, { actor: u, action: 'settings.update', entity_type: 'settings', scope: 'system', metadata: c.body }); return c.db.settings; });
on('GET', '/admin/audit', (c) => { need(c, ...STAFF_ADMIN); const q = c.query; const rows = c.db.audit.filter((a: any) => (!q.get('action') || a.action.includes(q.get('action'))) && (!q.get('entity_type') || a.entity_type === q.get('entity_type')) && (!q.get('booking_code') || (a.booking_code ?? '').toLowerCase().includes(String(q.get('booking_code')).toLowerCase())) && (!q.get('scope') || a.scope === q.get('scope'))).sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1)); return pageOf(rows, q, 30); });
function report(c: Ctx) {
  need(c, ...STAFF_ADMIN); const q = c.query; const db = c.db; const end = q.get('end') ?? todayWib(); const start = q.get('start') ?? new Date(new Date(`${end}T12:00:00+07:00`).getTime() - 29 * 86400e3).toISOString().slice(0, 10);
  const bs = db.bookings.filter((b: any) => b.visit_date >= start && b.visit_date <= end && (!q.get('status') || b.status === q.get('status')) && (!q.get('booking_type') || b.booking_type === q.get('booking_type')));
  const ids = new Set(bs.map((b: any) => b.id)); const trips = db.trips.filter((t: any) => ids.has(t.booking_id));
  const cnt = (rows: any[], f: (x: any) => string) => rows.reduce((a: any, r) => { const k = f(r); a[k] = (a[k] ?? 0) + 1; return a; }, {});
  const perf = (role: 'driver_id' | 'tour_guide_id') => Object.values(trips.filter((t: any) => t[role]).reduce((a: any, t: any) => { const u = byId(db.users, t[role]); a[u.id] ??= { name: u.name, total: 0, completed: 0 }; a[u.id].total++; if (t.trip_status === 'COMPLETED') a[u.id].completed++; return a; }, {})).sort((a: any, b: any) => b.total - a.total);
  const svc = (b: any) => (b.tour_package_id ? byId(db.packages, b.tour_package_id).name : b.rental_option_id ? byId(db.rentals, b.rental_option_id).name : 'Perjalanan Privat');
  const pop: any = {}; bs.filter((b: any) => b.status !== 'cancelled').forEach((b: any) => { const n = svc(b); pop[n] ??= { name: n, count: 0, participants: 0 }; pop[n].count++; pop[n].participants += b.participants; });
  const allInc = trips.flatMap((t: any) => t.incidents);
  return { filter: { start, end, status: q.get('status'), booking_type: q.get('booking_type') }, summary: { bookingTotal: bs.length, paymentStatus: cnt(bs, (b) => b.payment_status), bookingStatus: cnt(bs, (b) => b.status), completed: bs.filter((b: any) => b.status === 'completed').length, cancelled: bs.filter((b: any) => b.status === 'cancelled').length, activeTrips: trips.filter((t: any) => RUNNING.includes(t.trip_status)).length, completedTrips: trips.filter((t: any) => t.trip_status === 'COMPLETED').length, incidentTotal: allInc.length }, sakociUsage: cnt(trips, (t) => byId(db.sakoci, t.sakoci_id)?.name ?? '-'), driverPerformance: perf('driver_id'), guidePerformance: perf('tour_guide_id'), popularServices: Object.values(pop).sort((a: any, b: any) => b.count - a.count), incidentsByType: cnt(allInc, (i) => i.issue_type), rows: bs.map((b: any) => ({ code: bookingCode(b.id), group_name: b.group_name, booking_type: b.booking_type, service: svc(b), visit_date: b.visit_date, participants: b.participants, status: b.status, payment_status: b.payment_status, total_price: b.total_price, paid_amount: b.paid_amount ?? 0, driver: byId(db.users, b.assigned_driver_id)?.name ?? '', guide: byId(db.users, b.assigned_tour_guide_id)?.name ?? '', sakoci: byId(db.sakoci, b.sakoci_id)?.name ?? '' })) };
}
on('GET', '/admin/reports/operational', (c) => report(c));
on('GET', '/admin/reports/operational.csv', (c) => { const r = report(c); const cols = Object.keys(r.rows[0] ?? { code: '' }); const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`; return { __csv: [cols.join(','), ...r.rows.map((row: any) => cols.map((k) => esc(row[k])).join(','))].join('\n') }; });

// ── driver ──
const mine = (c: Ctx, role: 'driver' | 'tour_guide') => { const u = need(c, role); return { u, trips: c.db.trips.filter((t: any) => t[role === 'driver' ? 'driver_id' : 'tour_guide_id'] === u.id) }; };
const bucket = (t: any, s: string) => s === 'active' ? RUNNING.includes(t.trip_status) : s === 'upcoming' ? ['ASSIGNED', 'ACCEPTED'].includes(t.trip_status) : ['COMPLETED', 'CANCELLED'].includes(t.trip_status);
function dash(c: Ctx, role: 'driver' | 'tour_guide') {
  const { u, trips } = mine(c, role); const today = todayWib();
  const primary = trips.find((t: any) => RUNNING.includes(t.trip_status)) ?? trips.filter((t: any) => ['ASSIGNED', 'ACCEPTED'].includes(t.trip_status)).sort((a: any, b: any) => (a.scheduled_user_pickup_at < b.scheduled_user_pickup_at ? -1 : 1))[0] ?? null;
  return { [role === 'driver' ? 'driver' : 'guide']: userView(u), primary_trip: primary ? tripView(c.db, primary) : null, summary: { today: trips.filter((t: any) => dayOf(t.scheduled_user_pickup_at) === today && t.trip_status !== 'CANCELLED').length, active: trips.filter((t: any) => bucket(t, 'active')).length, upcoming: trips.filter((t: any) => bucket(t, 'upcoming')).length, completed: trips.filter((t: any) => t.trip_status === 'COMPLETED').length } };
}
const tasks = (c: Ctx, role: 'driver' | 'tour_guide') => { const { trips } = mine(c, role); const s = c.query.get('status'); return trips.filter((t: any) => !s || bucket(t, s)).sort((a: any, b: any) => (s === 'completed' ? (a.scheduled_user_pickup_at < b.scheduled_user_pickup_at ? 1 : -1) : a.scheduled_user_pickup_at < b.scheduled_user_pickup_at ? -1 : 1)).map((t: any) => tripView(c.db, t)); };
const ownTrip = (c: Ctx, role: 'driver' | 'tour_guide') => { const { u, trips } = mine(c, role); return must(trips.find((t: any) => t.id === Number(c.params.id)), 'Tugas tidak ditemukan'); };
const history = (c: Ctx, role: 'driver' | 'tour_guide') => mine(c, role).trips.filter((t: any) => bucket(t, 'completed')).sort((a: any, b: any) => (a.scheduled_user_pickup_at < b.scheduled_user_pickup_at ? 1 : -1)).map((t: any) => tripView(c.db, t));
const report_incident = (c: Ctx, role: 'driver' | 'tour_guide') => { const t = ownTrip(c, role); const u = c.user; if (!c.body.issue_type || !String(c.body.description ?? '').trim()) throw bad('Jenis dan deskripsi kendala wajib diisi'); const inc = { id: nextId(c.db, 'incident'), trip_id: t.id, driver_id: t.driver_id, reported_by_user_id: u.id, reporter_role: role, issue_type: c.body.issue_type, description: c.body.description, status: 'OPEN', reported_at: iso(new Date()), resolved_at: null, resolution_note: null }; t.incidents.push(inc); audit(c.db, { actor: u, action: 'incident.report', entity_type: 'trip_incident', entity_id: inc.id, booking_code: t.booking_reference, scope: 'trip', metadata: { issue_type: inc.issue_type } }); return inc; };
on('GET', '/driver/dashboard', (c) => dash(c, 'driver'));
on('GET', '/driver/tasks', (c) => tasks(c, 'driver'));
on('GET', '/driver/tasks/:id', (c) => tripView(c.db, ownTrip(c, 'driver')));
on('POST', '/driver/tasks/:id/actions', (c) => { const t = ownTrip(c, 'driver'); applyTripAction(c.db, t, c.body, new Date(), c.user); return tripView(c.db, t); });
on('POST', '/driver/tasks/:id/location', (c) => { const t = ownTrip(c, 'driver'); if (!t.tracking_active) throw bad('Tracking belum aktif'); const lat = Number(c.body.latitude), lng = Number(c.body.longitude); const sk = byId(c.db.sakoci, t.sakoci_id); const b = byId(c.db.bookings, t.booking_id); const now = iso(new Date()); Object.assign(sk, { latitude: lat, longitude: lng, location_updated_at: now }); Object.assign(b, { vehicle_latitude: lat, vehicle_longitude: lng, vehicle_location_updated_at: now }); t.sim = null; return { tripId: t.id, bookingId: t.booking_id, sakociId: t.sakoci_id, latitude: lat, longitude: lng, updated_at: now }; });
on('POST', '/driver/tasks/:id/incidents', (c) => report_incident(c, 'driver'));
on('GET', '/driver/destinations', (c) => { need(c, 'driver'); return c.db.heritage.filter((h: any) => h.status === 'aktif'); });
on('GET', '/driver/destinations/:id', (c) => { need(c, 'driver'); return must(byId(c.db.heritage, c.params.id)); });
on('GET', '/driver/history', (c) => history(c, 'driver'));
// ── guide ──
on('GET', '/guide/dashboard', (c) => dash(c, 'tour_guide'));
on('GET', '/guide/tasks', (c) => tasks(c, 'tour_guide'));
on('GET', '/guide/tasks/:id', (c) => tripView(c.db, ownTrip(c, 'tour_guide')));
on('POST', '/guide/tasks/:id/actions', (c) => { const t = ownTrip(c, 'tour_guide'); applyGuideAction(c.db, t, c.body, new Date(), c.user); return tripView(c.db, t); });
on('POST', '/guide/tasks/:id/incidents', (c) => report_incident(c, 'tour_guide'));
on('GET', '/guide/destinations', (c) => { const { trips } = mine(c, 'tour_guide'); const task_destinations = trips.filter((t: any) => !['CANCELLED'].includes(t.trip_status) && (bucket(t, 'active') || bucket(t, 'upcoming'))).flatMap((t: any) => t.itinerary_items.filter((i: any) => i.stop_type === 'DESTINATION').map((i: any) => ({ ...i, heritage_site: siteView(c.db, i.heritage_site_id), guide_content_snapshot: siteView(c.db, i.heritage_site_id), booking_reference: t.booking_reference, scheduled_user_pickup_at: t.scheduled_user_pickup_at, guide_session: t.guide_sessions.find((s: any) => s.itinerary_item_id === i.id) ?? null }))); return { task_destinations, all_destinations: c.db.heritage.filter((h: any) => h.status === 'aktif') }; });
on('GET', '/guide/destinations/:id', (c) => { need(c, 'tour_guide'); return must(byId(c.db.heritage, c.params.id)); });
on('GET', '/guide/history', (c) => history(c, 'tour_guide'));

// ── graph & routing ──
const nodeView = (n: any) => ({ id: n.id, code: n.code, latitude: n.latitude, longitude: n.longitude, type: n.type, name: n.name });
on('GET', '/graph/road-nodes', (c) => { need(c, ...STAFF_ADMIN); const p = pageOf(c.db.graph.nodes, c.query, 1000); return { data: p.data.map(nodeView), total: p.total, page: p.page, limit: p.limit }; });
on('GET', '/graph/road-edges', (c) => { need(c, ...STAFF_ADMIN); const nodes = c.db.graph.nodes; const p = pageOf(c.db.graph.edges, c.query, 1000); return { data: p.data.map((e: any) => ({ ...e, from_node: nodeView(nodes[e.from_node_id - 1]), to_node: nodeView(nodes[e.to_node_id - 1]) })), total: p.total, page: p.page, limit: p.limit }; });
const edgeGeom = (db: Db, e: any) => { const a = db.graph.nodes[e.from_node_id - 1], b = db.graph.nodes[e.to_node_id - 1]; return { type: 'LineString', coordinates: [[a.longitude, a.latitude], [b.longitude, b.latitude]] }; };
const gView = (db: Db, nodeIds: number[], edgeIds: number[]) => ({ nodes: nodeIds.map((id) => nodeView(db.graph.nodes[id - 1])).filter((n) => n.id), edges: edgeIds.map((id) => db.graph.edges[id - 1]).filter(Boolean).map((e: any) => ({ id: e.id, fromNodeId: e.from_node_id, toNodeId: e.to_node_id, distanceKm: e.distance_km, roadName: e.road_name, oneway: e.oneway, geometry: edgeGeom(db, e) })) });
on('GET', '/graph/playback', (c) => { const ids = (k: string) => String(c.query.get(k) ?? '').split(',').filter(Boolean).map(Number); const eids = ids('edgeIds'); const nids = Array.from(new Set([...ids('nodeIds'), ...eids.flatMap((id) => { const e = c.db.graph.edges[id - 1]; return e ? [e.from_node_id, e.to_node_id] : []; })])); return gView(c.db, nids, eids); });
on('GET', '/graph/radius', (c) => { const p = { lat: Number(c.query.get('latitude')), lng: Number(c.query.get('longitude')) }; const r = Number(c.query.get('radiusMeters') ?? 2000) / 1000; const nodes = c.db.graph.nodes.filter((n: any) => haversineKm(p, { lat: n.latitude, lng: n.longitude }) <= r).map((n: any) => n.id); const set = new Set(nodes); const edges = c.db.graph.edges.filter((e: any) => set.has(e.from_node_id) && set.has(e.to_node_id)).map((e: any) => e.id); return { enabled: c.db.settings.showSakociGraphRadius, radiusMeters: r * 1000, ...gView(c.db, nodes, edges) }; });
function sssp(db: Db, src: number) { const adj = db.graph.adj; const dist = new Map<number, number>([[src, 0]]); const q: Array<[number, number]> = [[0, src]]; const done = new Set<number>(); while (q.length) { q.sort((a, b) => a[0] - b[0]); const [d, u] = q.shift()!; if (done.has(u)) continue; done.add(u); for (const [v, w] of adj.get(u) ?? []) { if (d + w < (dist.get(v) ?? Infinity)) { dist.set(v, d + w); q.push([d + w, v]); } } } return dist; }
on('GET', '/graph/destination-matrix', (c) => { need(c, ...STAFF_ADMIN); const sites = c.db.heritage.filter((h: any) => h.status !== 'tidak aktif'); const sn = c.db.graph.siteNode; const rows = sites.map((h: any) => sssp(c.db, sn.get(h.id).id)); return { destinations: sites.map((h: any) => ({ id: h.id, name: h.name, latitude: h.latitude, longitude: h.longitude })), matrix: rows.map((d: Map<number, number>, i: number) => sites.map((h: any, j: number) => (i === j ? 0 : d.has(sn.get(h.id).id) ? Number(d.get(sn.get(h.id).id)!.toFixed(3)) : null))) }; });
on('GET', '/graph/destination-distances', (c) => { need(c, ...STAFF_ADMIN); const sites = c.db.heritage; const sn = c.db.graph.siteNode; const out: any[] = []; const stamp = iso(new Date()); sites.forEach((a: any, i: number) => { const d = sssp(c.db, sn.get(a.id).id); sites.forEach((b: any, j: number) => { if (j <= i) return; const km = d.get(sn.get(b.id).id); if (km == null || km > 4) return; out.push({ id: out.length + 1, from_heritage_site_id: a.id, to_heritage_site_id: b.id, distance_km: Number(km.toFixed(3)), duration_minutes: Math.round((km / 22) * 60), path_node_ids: [], calculation_method: 'DIJKSTRA_GRAPH', created_at: stamp, updated_at: stamp, from_heritage_site: { id: a.id, name: a.name }, to_heritage_site: { id: b.id, name: b.name } }); }); }); return out; });
on('POST', '/graph/rebuild', (c) => { const u = need(c, 'super_admin'); const g = c.db.graph; audit(c.db, { actor: u, action: 'graph.rebuild', entity_type: 'graph', scope: 'system', metadata: { nodes: g.nodes.length, edges: g.edges.length } }); const n = c.db.heritage.length; return { message: 'Graph berhasil dibangun ulang (demo)', heritageSites: n, roadNodes: g.nodes.length, roadEdges: g.edges.length, destinationNodes: n, destinationDistances: n * (n - 1) / 2, unreachablePairs: 0, calculationMethod: 'DIJKSTRA_GRAPH' }; });
function optimizeV2(c: Ctx) {
  const db = c.db; const b = c.body; const sites = (b.destinationIds ?? []).map((id: number) => byId(db.heritage, id)).filter(Boolean); if (!sites.length) throw bad('Pilih minimal satu destinasi');
  const start = b.pickup ? { latitude: b.pickup.latitude, longitude: b.pickup.longitude } : null; const fixed = b.fixedEndId ? byId(db.heritage, b.fixedEndId) : null;
  const free = fixed ? sites.filter((s: any) => s.id !== fixed.id) : sites; const ordered = [...orderByNearest(start, free), ...(fixed ? [fixed] : [])];
  const pts = [...(start ? [{ id: 'pickup', name: 'Titik jemput', ...start }] : []), ...ordered.map((s: any) => ({ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude }))]; const r = buildRoute(db, pts);
  return { orderedDestinationIds: ordered.map((s: any) => s.id), orderedDestinations: ordered.map((s: any) => ({ id: s.id, name: s.name, category: s.category, address: s.address, latitude: s.latitude, longitude: s.longitude })), totalDistanceKm: r.totalKm, totalHaversineDistanceKm: Number(r.segments.reduce((a: number, s: any) => a + s.haversineDistanceKm, 0).toFixed(3)), totalDurationMinutes: r.totalMin, segments: r.segments, geojson: r.geojson, routeGeojson: r.geojson, warnings: [] };
}
on('POST', '/routing/optimize-v2', optimizeV2);
on('POST', '/routing/preview', optimizeV2);
on('POST', '/routing/optimize', (c) => { const pts = c.body.destinations ?? []; const ord = orderByNearest(c.body.userLocation ? { latitude: c.body.userLocation.lat, longitude: c.body.userLocation.lng } : null, pts.map((p: any) => ({ ...p, latitude: p.lat, longitude: p.lng }))); const segs = ord.slice(1).map((p: any, i: number) => { const a = ord[i]; const km = haversineKm({ lat: a.lat, lng: a.lng }, { lat: p.lat, lng: p.lng }) * 1.27; return { from: strip(a, 'latitude', 'longitude'), to: strip(p, 'latitude', 'longitude'), distance: Number(km.toFixed(3)), duration: Math.round((km / 22) * 3600), geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [p.lng, p.lat]] } }; }); return { orderedDestinations: ord.map((p: any) => strip(p, 'latitude', 'longitude')), totalDistance: Number(segs.reduce((a: number, s: any) => a + s.distance, 0).toFixed(3)), totalDuration: segs.reduce((a: number, s: any) => a + s.duration, 0), segments: segs }; });
on('POST', '/routing/dijkstra', (c) => { const pts = c.body.points ?? []; const src = pts[c.body.sourceIndex ?? 0]; return { source: src, distances: pts.map((p: any) => ({ id: p.id, name: p.name, distanceKm: Number((haversineKm({ lat: src.lat, lng: src.lng }, { lat: p.lat, lng: p.lng }) * 1.27).toFixed(3)) })) }; });
on('POST', '/demo/reset', () => { resetDb(); return { message: 'Data demo direset ke kondisi awal' }; });
on('POST', '/demo/speed', (c) => { c.db.speedFactor = Math.min(20, Math.max(1, Number(c.body.factor ?? 1))); return { speedFactor: c.db.speedFactor }; });

// ── dispatcher ──
export async function dispatch(method: string, pathname: string, query: URLSearchParams, auth: string | null, rawReq: Request) {
  const db = getDb(); tick(db);
  const m = routes.find((r) => r.method === method && r.re.test(pathname));
  if (!m) throw new HttpError(404, `Endpoint tidak ditemukan: ${method} ${pathname}`);
  const match = pathname.match(m.re)!; const params: Record<string, string> = {}; m.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));
  let body: any = {}; let form: FormData | null = null;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const ct = rawReq.headers.get('content-type') ?? '';
    if (ct.includes('multipart/form-data')) form = await rawReq.formData(); else { const t = await rawReq.text(); try { body = t ? JSON.parse(t) : {}; } catch { body = {}; } }
  }
  const idm = /^Bearer demo\.(\d+)$/.exec(auth ?? ''); const user = idm ? db.users.find((u: any) => u.id === Number(idm[1])) ?? null : null;
  return m.h({ db, user, params, query, body, form, method });
}
