// Mesin domain demo: rute, trip, aksi driver/guide, audit, simulasi gerak kendaraan.
import { adjacency, dijkstra, haversineKm, lineFeature, nearestNode } from './geo';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
export const bad = (m: string) => new HttpError(400, m);
export const notFound = (m = 'Data tidak ditemukan') => new HttpError(404, m);

export type Db = any;
export const iso = (d: Date | number) => new Date(d).toISOString();
export const nextId = (db: Db, k: string) => (db.seq[k] = (db.seq[k] ?? 0) + 1);
export const bookingCode = (id: number) => `BK-${String(id).padStart(3, '0')}`;
export const AVG_KMH = 22;

export function audit(db: Db, a: { actor?: any; action: string; entity_type: string; entity_id?: any; booking_code?: string | null; scope: string; metadata?: any; at?: Date }) {
  db.audit.push({
    id: nextId(db, 'audit'), actor_user_id: a.actor?.id ?? null, actor_role: a.actor?.role?.name ?? a.actor?.role ?? 'system',
    action: a.action, entity_type: a.entity_type, entity_id: a.entity_id != null ? String(a.entity_id) : null,
    booking_code: a.booking_code ?? null, scope: a.scope, metadata: a.metadata ?? null, created_at: iso(a.at ?? new Date()),
  });
}

const pt = (p: any) => ({ lat: Number(p.latitude), lng: Number(p.longitude) });

/** Rute mengikuti graph jalan (Dijkstra) antar titik berurutan. */
export function buildRoute(db: Db, pts: Array<{ id?: number | string; name: string; latitude: number; longitude: number }>) {
  const { nodes, edges } = db.graph;
  const adj = db.graph.adj ?? (db.graph.adj = adjacency(nodes, edges));
  const nodeIds = new Set<number>(), edgeIds = new Set<number>();
  const segments: any[] = [];
  const features: any[] = [];
  let totalKm = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const na = nearestNode(nodes, pt(a)), nb = nearestNode(nodes, pt(b));
    const sp = dijkstra(adj, na.node.id, nb.node.id);
    const coords: number[][] = [[a.longitude, a.latitude]];
    let km = na.km + nb.km;
    if (sp) {
      km += sp.km;
      sp.nodeIds.forEach((id) => { nodeIds.add(id); const n = nodes[id - 1]; coords.push([n.longitude, n.latitude]); });
      sp.edgeIds.forEach((id) => edgeIds.add(id));
    }
    coords.push([b.longitude, b.latitude]);
    const hv = haversineKm(pt(a), pt(b));
    km = Math.max(km, hv);
    totalKm += km;
    const geo = lineFeature(coords, { source: 'GRAPH_DIJKSTRA', segmentIndex: i });
    features.push(geo);
    const slim = (p: any) => ({ id: p.id ?? i, name: p.name, latitude: p.latitude, longitude: p.longitude });
    segments.push({
      from: slim(a), to: slim(b), distanceKm: Number(km.toFixed(3)), haversineDistanceKm: Number(hv.toFixed(3)),
      durationMinutes: Math.max(1, Math.round((km / AVG_KMH) * 60)), path_geojson: geo, pathGeojson: geo, geojson: geo,
    });
  }
  return {
    segments, geojson: { type: 'FeatureCollection' as const, features }, totalKm: Number(totalKm.toFixed(3)),
    totalMin: Math.round((totalKm / AVG_KMH) * 60), nodeIds: [...nodeIds], edgeIds: [...edgeIds],
  };
}

export const orderByNearest = (start: { latitude: number; longitude: number } | null, sites: any[]) => {
  const left = [...sites]; const out: any[] = [];
  let cur: any = start ?? left.shift();
  if (!start && cur) out.push(cur);
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((s, i) => { const d = haversineKm(pt(cur), pt(s)); if (d < bd) { bd = d; bi = i; } });
    cur = left.splice(bi, 1)[0]; out.push(cur);
  }
  return out;
};

export function bookingDestinations(db: Db, b: any): any[] {
  if (b.tour_package_id) {
    return db.routes.filter((r: any) => r.tour_package_id === b.tour_package_id).sort((x: any, y: any) => x.sequence - y.sequence).map((r: any) => db.heritage.find((h: any) => h.id === r.heritage_site_id)).filter(Boolean);
  }
  const sites = (b.private_destination_ids ?? []).map((id: number) => db.heritage.find((h: any) => h.id === id)).filter(Boolean);
  const start = b.pickup_latitude != null ? { latitude: b.pickup_latitude, longitude: b.pickup_longitude } : null;
  return orderByNearest(start, sites);
}

/** Buat trip (penugasan) untuk sebuah booking. */
export function createTrip(db: Db, b: any, o: { driver_id: number; tour_guide_id?: number | null; sakoci_id: number; assigned_at?: Date; admin_id?: number; lead?: number; destination_ids?: number[]; duration?: number; endpoint?: any }) {
  const dests = o.destination_ids?.length ? o.destination_ids.map((id) => db.heritage.find((h: any) => h.id === id)).filter(Boolean) : bookingDestinations(db, b);
  const [hh, mm] = String(b.pickup_time ?? '08:00').split(':').map(Number);
  const pickupAt = new Date(`${b.visit_date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`);
  const lead = o.lead ?? db.settings.driverReadyOffsetMinutes;
  const pickupPoint = { id: 'pickup', name: b.pickup_location ?? 'Titik Jemput', latitude: b.pickup_latitude ?? dests[0]?.latitude ?? -6.8748, longitude: b.pickup_longitude ?? dests[0]?.longitude ?? 107.5383 };
  const end = o.endpoint?.latitude != null ? { id: 'end', name: o.endpoint.name, latitude: o.endpoint.latitude, longitude: o.endpoint.longitude, address: o.endpoint.address } : { id: 'end', name: `Kembali ke ${pickupPoint.name}`, latitude: pickupPoint.latitude, longitude: pickupPoint.longitude, address: b.pickup_location };
  const seq = [pickupPoint, ...dests, end];
  const route = buildRoute(db, seq.map((p: any) => ({ id: p.id, name: p.name, latitude: Number(p.latitude), longitude: Number(p.longitude) })));
  const pkgHours = b.tour_package_id ? db.packages.find((p: any) => p.id === b.tour_package_id)?.duration_hours : null;
  const nDest = Math.max(1, dests.length);
  const stopMin = pkgHours ? Math.max(25, Math.round((pkgHours * 60 - route.totalMin) / nDest)) : 35;
  const tripId = nextId(db, 'trip');
  let t = pickupAt.getTime();
  const items = seq.map((p: any, i: number) => {
    const isDest = i > 0 && i < seq.length - 1;
    if (i > 0) t += route.segments[i - 1].durationMinutes * 60000;
    const arr = t;
    if (isDest) t += stopMin * 60000;
    return {
      id: nextId(db, 'item'), trip_id: tripId, sequence: i + 1, stop_type: i === 0 ? 'PICKUP' : isDest ? 'DESTINATION' : 'ENDPOINT',
      heritage_site_id: isDest ? p.id : null, name: p.name, address: p.address ?? null, latitude: Number(p.latitude), longitude: Number(p.longitude),
      planned_duration_minutes: isDest ? stopMin : i === 0 ? 0 : null, estimated_arrival_at: iso(arr), stop_status: 'PENDING',
      en_route_at: null, arrived_at: null, completed_at: null, skipped_at: null, skip_reason: null,
    };
  });
  const estMin = o.duration ?? Math.max(30, Math.round((t - pickupAt.getTime()) / 60000));
  const at = o.assigned_at ?? new Date();
  const trip: any = {
    id: tripId, booking_id: b.id, driver_id: o.driver_id, tour_guide_id: o.tour_guide_id ?? null, sakoci_id: o.sakoci_id,
    assigned_by_admin_id: o.admin_id ?? 2, booking_reference: bookingCode(b.id), scheduled_user_pickup_at: iso(pickupAt),
    driver_ready_at: iso(pickupAt.getTime() - lead * 60000), driver_lead_time_minutes: lead, estimated_duration_minutes: estMin,
    estimated_end_at: iso(pickupAt.getTime() + estMin * 60000), trip_status: 'ASSIGNED', current_itinerary_item_id: null, current_stop_sequence: null,
    tracking_active: false, tracking_started_at: null, tracking_ended_at: null, assigned_at: iso(at), accepted_at: null, journey_started_at: null, completed_at: null,
    cancellation_reason: null,
    route_snapshot: { route_status: 'final', routing_build_id: 'demo-build-001', finalized_at: iso(at), total_distance_km: route.totalKm, total_duration_minutes: route.totalMin, geojson: route.geojson, segments: route.segments },
    _route: { nodeIds: route.nodeIds, edgeIds: route.edgeIds }, itinerary_items: items,
    guide_sessions: o.tour_guide_id ? items.filter((x: any) => x.stop_type === 'DESTINATION').map((x: any) => ({ id: nextId(db, 'gsession'), trip_id: tripId, itinerary_item_id: x.id, tour_guide_id: o.tour_guide_id, session_status: 'PENDING', started_at: null, completed_at: null, notes: null })) : [],
    status_history: [], incidents: [], created_at: iso(at), updated_at: iso(at), sim: null,
  };
  addHistory(db, trip, null, 'ASSIGN_TASK', 'ASSIGNED', at, `Ditugaskan oleh admin ke driver #${o.driver_id}`);
  db.trips.push(trip);
  Object.assign(b, { status: 'assigned', assigned_driver_id: o.driver_id, assigned_tour_guide_id: o.tour_guide_id ?? null, sakoci_id: o.sakoci_id });
  const sk = db.sakoci.find((s: any) => s.id === o.sakoci_id);
  if (sk) { b.vehicle_name = sk.name; b.vehicle_plate_number = sk.plate_number; sk.status = 'assigned'; }
  return trip;
}

export function addHistory(db: Db, trip: any, prev: string | null, action: string, next: string, at: Date, notes?: string | null) {
  trip.status_history.push({ id: nextId(db, 'history'), previous_status: prev, new_status: next, action, changed_at: iso(at), notes: notes ?? null });
  trip.updated_at = iso(at);
}

const expect = (trip: any, ok: string[]) => { if (!ok.includes(trip.trip_status)) throw bad(`Aksi tidak valid pada status ${trip.trip_status}`); };
const stopByType = (trip: any, t: string) => trip.itinerary_items.find((i: any) => i.stop_type === t);
const curItem = (trip: any) => { const i = trip.itinerary_items.find((x: any) => x.id === trip.current_itinerary_item_id); if (!i) throw bad('Tujuan aktif tidak ditemukan'); return i; };
const nextPending = (trip: any, seq: number) => trip.itinerary_items.filter((i: any) => i.sequence > seq && i.stop_status === 'PENDING').sort((a: any, b: any) => a.sequence - b.sequence)[0];

function ensureGuideDone(trip: any, item: any) {
  if (!trip.tour_guide_id || item.stop_type !== 'DESTINATION') return;
  const s = trip.guide_sessions.find((g: any) => g.itinerary_item_id === item.id);
  if (s && !['COMPLETED', 'SKIPPED'].includes(s.session_status)) throw bad('Tour guide belum menyelesaikan sesi pemanduan di destinasi ini');
}

function setVehicle(db: Db, trip: any, lat: number, lng: number, at: Date) {
  const sk = db.sakoci.find((s: any) => s.id === trip.sakoci_id); const b = db.bookings.find((x: any) => x.id === trip.booking_id);
  if (sk) { sk.latitude = lat; sk.longitude = lng; sk.location_updated_at = iso(at); }
  if (b) { b.vehicle_latitude = lat; b.vehicle_longitude = lng; b.vehicle_location_updated_at = iso(at); }
  db.locLogs.push({ trip_id: trip.id, latitude: lat, longitude: lng, recorded_at: iso(at) });
}

/** Siapkan jalur gerak kendaraan menuju item aktif. */
function startLeg(db: Db, trip: any, at: Date) {
  const sk = db.sakoci.find((s: any) => s.id === trip.sakoci_id);
  const item = trip.itinerary_items.find((i: any) => i.id === trip.current_itinerary_item_id);
  if (!sk || !item) return;
  const from = sk.latitude != null ? { id: 'veh', name: 'Posisi kendaraan', latitude: Number(sk.latitude), longitude: Number(sk.longitude) } : { id: 'veh', name: 'Awal', latitude: item.latitude, longitude: item.longitude };
  const r = buildRoute(db, [from, { id: item.id, name: item.name, latitude: item.latitude, longitude: item.longitude }]);
  const path = r.segments[0]?.path_geojson?.geometry?.coordinates ?? [];
  trip.sim = { path, i: 0, frac: 0 };
  setVehicle(db, trip, from.latitude, from.longitude, at);
}

export function applyTripAction(db: Db, trip: any, body: any, at: Date, actor?: any) {
  if (['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) throw bad('Trip sudah tidak aktif');
  const action = String(body.action ?? '').trim().toUpperCase();
  const prev = trip.trip_status; const b = db.bookings.find((x: any) => x.id === trip.booking_id);
  let item: any;
  const ts = iso(at);
  if (action === 'ACCEPT_TASK') { expect(trip, ['ASSIGNED']); trip.trip_status = 'ACCEPTED'; trip.accepted_at = ts; }
  else if (action === 'START_TO_PICKUP') {
    expect(trip, ['ACCEPTED']); item = stopByType(trip, 'PICKUP'); item.stop_status = 'EN_ROUTE'; item.en_route_at = ts;
    trip.trip_status = 'EN_ROUTE_TO_PICKUP'; trip.current_itinerary_item_id = item.id; trip.current_stop_sequence = item.sequence;
    trip.tracking_active = true; trip.tracking_started_at ??= ts; trip.tracking_ended_at = null;
    const sk = db.sakoci.find((s: any) => s.id === trip.sakoci_id);
    if (sk) { const far = { latitude: item.latitude - 0.011, longitude: item.longitude - 0.008 }; sk.latitude = far.latitude; sk.longitude = far.longitude; }
    startLeg(db, trip, at);
  } else if (action === 'CONFIRM_ARRIVAL_PICKUP') {
    expect(trip, ['EN_ROUTE_TO_PICKUP']); item = curItem(trip); if (item.stop_type !== 'PICKUP') throw bad('Tujuan aktif bukan titik penjemputan');
    item.stop_status = 'ARRIVED'; item.arrived_at = ts; trip.trip_status = 'AT_PICKUP'; trip.sim = null; setVehicle(db, trip, item.latitude, item.longitude, at);
  } else if (action === 'START_TOUR') {
    expect(trip, ['AT_PICKUP']); const p = stopByType(trip, 'PICKUP'); p.stop_status = 'COMPLETED'; p.completed_at = ts;
    item = nextPending(trip, p.sequence); if (!item) throw bad('Itinerary tidak memiliki tujuan berikutnya');
    item.stop_status = 'EN_ROUTE'; item.en_route_at = ts; trip.trip_status = item.stop_type === 'ENDPOINT' ? 'EN_ROUTE_TO_ENDPOINT' : 'EN_ROUTE_TO_DESTINATION';
    trip.current_itinerary_item_id = item.id; trip.current_stop_sequence = item.sequence; trip.journey_started_at = ts; if (b) b.status = 'in_progress'; startLeg(db, trip, at);
  } else if (action === 'CONFIRM_ARRIVAL_STOP') {
    expect(trip, ['EN_ROUTE_TO_DESTINATION', 'EN_ROUTE_TO_ENDPOINT']); item = curItem(trip);
    if (body.itineraryItemId && Number(body.itineraryItemId) !== item.id) throw bad('Destinasi bukan tujuan aktif');
    item.stop_status = item.stop_type === 'ENDPOINT' ? 'ARRIVED' : 'VISITING'; item.arrived_at = ts;
    trip.trip_status = item.stop_type === 'ENDPOINT' ? 'EN_ROUTE_TO_ENDPOINT' : 'AT_DESTINATION'; trip.sim = null; setVehicle(db, trip, item.latitude, item.longitude, at);
    if (trip.tour_guide_id && item.stop_type === 'DESTINATION') trip.guide_sessions.filter((g: any) => g.itinerary_item_id === item.id && g.session_status === 'PENDING').forEach((g: any) => (g.session_status = 'READY'));
  } else if (action === 'START_NEXT_STOP') {
    expect(trip, ['AT_DESTINATION']); const c = curItem(trip); ensureGuideDone(trip, c); c.stop_status = 'COMPLETED'; c.completed_at = ts;
    item = nextPending(trip, c.sequence); if (!item) throw bad('Tidak ada tujuan berikutnya; selesaikan perjalanan');
    item.stop_status = 'EN_ROUTE'; item.en_route_at = ts; trip.trip_status = item.stop_type === 'ENDPOINT' ? 'EN_ROUTE_TO_ENDPOINT' : 'EN_ROUTE_TO_DESTINATION';
    trip.current_itinerary_item_id = item.id; trip.current_stop_sequence = item.sequence; startLeg(db, trip, at);
  } else if (action === 'SKIP_STOP') {
    expect(trip, ['EN_ROUTE_TO_DESTINATION', 'AT_DESTINATION']); const reason = String(body.reason ?? '').trim(); if (!reason) throw bad('Alasan melewati destinasi wajib diisi');
    const c = curItem(trip); if (c.stop_type !== 'DESTINATION') throw bad('Titik ini tidak dapat dilewati');
    c.stop_status = 'SKIPPED'; c.skipped_at = ts; c.skip_reason = reason;
    trip.guide_sessions.filter((g: any) => g.itinerary_item_id === c.id).forEach((g: any) => (g.session_status = 'SKIPPED'));
    if (trip.route_snapshot) trip.route_snapshot.route_status = 'stale';
    item = nextPending(trip, c.sequence);
    if (!item) { trip.trip_status = 'AT_DESTINATION'; trip.current_itinerary_item_id = c.id; }
    else { item.stop_status = 'EN_ROUTE'; item.en_route_at = ts; trip.trip_status = item.stop_type === 'ENDPOINT' ? 'EN_ROUTE_TO_ENDPOINT' : 'EN_ROUTE_TO_DESTINATION'; trip.current_itinerary_item_id = item.id; trip.current_stop_sequence = item.sequence; startLeg(db, trip, at); }
  } else if (action === 'COMPLETE_TRIP') {
    const c = curItem(trip); const hasPending = trip.itinerary_items.some((i: any) => i.stop_status === 'PENDING');
    const lastDest = trip.trip_status === 'AT_DESTINATION' && c.stop_type === 'DESTINATION' && !hasPending;
    const endOk = trip.trip_status === 'EN_ROUTE_TO_ENDPOINT' && c.stop_type === 'ENDPOINT' && c.stop_status === 'ARRIVED';
    if (!lastDest && !endOk) throw bad('Perjalanan belum dapat diselesaikan');
    if (lastDest) ensureGuideDone(trip, c);
    c.stop_status = 'COMPLETED'; c.completed_at = ts; trip.trip_status = 'COMPLETED'; trip.completed_at = ts; trip.tracking_active = false; trip.tracking_ended_at = ts; trip.sim = null;
    if (b) b.status = 'completed';
    const sk = db.sakoci.find((s: any) => s.id === trip.sakoci_id); if (sk && sk.status === 'assigned') sk.status = 'available';
  } else throw bad('Aksi perjalanan tidak dikenali');
  addHistory(db, trip, prev, action, trip.trip_status, at, body.reason ?? null);
  audit(db, { actor, action: `trip.${action.toLowerCase()}`, entity_type: 'driver_trip', entity_id: trip.id, booking_code: trip.booking_reference, scope: 'trip', metadata: { from: prev, to: trip.trip_status, itemId: item?.id ?? trip.current_itinerary_item_id }, at });
  return trip;
}

export function applyGuideAction(db: Db, trip: any, body: any, at: Date, actor?: any) {
  if (['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) throw bad('Trip sudah tidak aktif');
  const s = trip.guide_sessions.find((g: any) => g.itinerary_item_id === Number(body.itineraryItemId));
  if (!s) throw notFound('Sesi pemanduan tidak ditemukan');
  const ts = iso(at);
  if (body.action === 'START_GUIDE_SESSION') {
    if (!['READY', 'IN_PROGRESS'].includes(s.session_status)) throw bad('Sesi belum siap dimulai; driver harus konfirmasi tiba di destinasi');
    s.session_status = 'IN_PROGRESS'; s.started_at ??= ts;
  } else if (body.action === 'COMPLETE_GUIDE_SESSION') {
    if (!['READY', 'IN_PROGRESS'].includes(s.session_status)) throw bad('Sesi belum dapat diselesaikan');
    s.session_status = 'COMPLETED'; s.completed_at = ts; s.started_at ??= ts; if (body.notes != null) s.notes = String(body.notes);
  } else if (body.action === 'SAVE_GUIDE_NOTE') { s.notes = String(body.notes ?? ''); }
  else throw bad('Aksi guide tidak dikenali');
  trip.updated_at = ts;
  audit(db, { actor, action: `guide.${String(body.action).toLowerCase()}`, entity_type: 'trip_guide_session', entity_id: s.id, booking_code: trip.booking_reference, scope: 'trip', metadata: { itineraryItemId: s.itinerary_item_id }, at });
  return trip;
}

/** Gerakkan kendaraan pada trip aktif sesuai waktu berjalan (simulasi GPS). */
export function tick(db: Db) {
  const now = Date.now(); const dt = Math.min(60, (now - (db.tickLast ?? now)) / 1000); db.tickLast = now;
  if (dt <= 0) return;
  for (const trip of db.trips) {
    if (!trip.tracking_active || !trip.sim?.path?.length) continue;
    if (!['EN_ROUTE_TO_PICKUP', 'EN_ROUTE_TO_DESTINATION', 'EN_ROUTE_TO_ENDPOINT'].includes(trip.trip_status)) continue;
    let dist = 12 * dt * (db.speedFactor ?? 1); // meter
    const sim = trip.sim; const sk = db.sakoci.find((s: any) => s.id === trip.sakoci_id); if (!sk) continue;
    let lat = Number(sk.latitude), lng = Number(sk.longitude);
    while (dist > 0 && sim.i < sim.path.length) {
      const [tx, ty] = sim.path[sim.i];
      const d = haversineKm({ lat, lng }, { lat: ty, lng: tx }) * 1000;
      if (d <= dist) { lat = ty; lng = tx; dist -= d; sim.i++; } else { const f = dist / d; lat += (ty - lat) * f; lng += (tx - lng) * f; dist = 0; }
    }
    // berhenti ±25 m sebelum tujuan agar driver menekan tombol "tiba"
    setVehicle(db, trip, Number(lat.toFixed(6)), Number(lng.toFixed(6)), new Date());
  }
}
