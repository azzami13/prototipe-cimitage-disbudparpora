// Utilitas geografi + graph jalan + Dijkstra untuk mode demo.
export type LL = { lat: number; lng: number };

export function haversineKm(a: LL, b: LL) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export interface GNode { id: number; code: string; latitude: number; longitude: number; type: string; name: string }
export interface GEdge { id: number; code: string; from_node_id: number; to_node_id: number; distance_km: number; road_name: string; oneway: boolean; vehicle_accessible: boolean }

const ROADS = ['Jl. Jenderal Amir Machmud', 'Jl. Gatot Subroto', 'Jl. Baros', 'Jl. Kartini', 'Jl. Dustira', 'Jl. Mahar Martanegara', 'Jl. Sangkuriang', 'Jl. Raya Cibabat', 'Jl. Pasar Atas', 'Jl. Industri', 'Jl. Cihanjuang', 'Jl. Kolonel Masturi', 'Jl. Encep Kartawiria', 'Jl. Jati', 'Jl. Citeureup', 'Jl. Leuwigajah', 'Jl. Pesantren', 'Jl. Cimindi'];

export function buildGraph(sites: Array<{ id: number; name: string; latitude: number; longitude: number }>, seed: any) {
  const nodes: GNode[] = [];
  const byCode = new Map<string, GNode>();
  for (const n of seed.nodes) {
    const node = { id: nodes.length + 1, code: n.code, latitude: n.latitude, longitude: n.longitude, type: n.type, name: n.name };
    nodes.push(node); byCode.set(n.code, node);
  }
  const siteNode = new Map<number, GNode>();
  for (const s of sites) {
    const node = { id: nodes.length + 1, code: `DN-${String(s.id).padStart(3, '0')}`, latitude: s.latitude, longitude: s.longitude, type: 'destination', name: s.name };
    nodes.push(node); siteNode.set(s.id, node);
  }
  const edges: GEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (a: GNode, b: GNode, road: string, km?: number, oneway = false) => {
    const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
    if (a.id === b.id || seen.has(key)) return;
    seen.add(key);
    edges.push({
      id: edges.length + 1, code: `RE-${String(edges.length + 1).padStart(4, '0')}`, from_node_id: a.id, to_node_id: b.id,
      distance_km: Number((km ?? haversineKm({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude }) * 1.27).toFixed(3)),
      road_name: road, oneway, vehicle_accessible: true,
    });
  };
  for (const e of seed.edges) {
    const a = byCode.get(e.fromCode), b = byCode.get(e.toCode);
    if (a && b) addEdge(a, b, e.roadName, e.distanceKm, e.oneway);
  }
  // sambungkan tiap node ke 4 tetangga terdekat
  nodes.forEach((n, i) => {
    nodes
      .filter((m) => m.id !== n.id)
      .map((m) => ({ m, d: haversineKm({ lat: n.latitude, lng: n.longitude }, { lat: m.latitude, lng: m.longitude }) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, 4)
      .forEach(({ m }, k) => addEdge(n, m, ROADS[(i + k * 3) % ROADS.length]));
  });
  // pastikan graph terhubung: gabungkan komponen terpisah lewat pasangan terdekat
  const comp = new Map<number, number>();
  const adj = adjacency(nodes, edges);
  let c = 0;
  for (const n of nodes) {
    if (comp.has(n.id)) continue;
    const st = [n.id]; comp.set(n.id, c);
    while (st.length) { const u = st.pop()!; for (const [v] of adj.get(u) ?? []) if (!comp.has(v)) { comp.set(v, c); st.push(v); } }
    c++;
  }
  for (let k = 1; k < c; k++) {
    const A = nodes.filter((n) => comp.get(n.id) === 0), B = nodes.filter((n) => comp.get(n.id) === k);
    let best: [GNode, GNode, number] | null = null;
    for (const a of A) for (const b of B) {
      const d = haversineKm({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude });
      if (!best || d < best[2]) best = [a, b, d];
    }
    if (best) { addEdge(best[0], best[1], ROADS[k % ROADS.length]); nodes.filter((n) => comp.get(n.id) === k).forEach((n) => comp.set(n.id, 0)); }
  }
  return { nodes, edges, siteNode };
}

export function adjacency(nodes: GNode[], edges: GEdge[]) {
  const adj = new Map<number, Array<[number, number, number]>>();
  nodes.forEach((n) => adj.set(n.id, []));
  for (const e of edges) {
    adj.get(e.from_node_id)!.push([e.to_node_id, e.distance_km, e.id]);
    if (!e.oneway) adj.get(e.to_node_id)!.push([e.from_node_id, e.distance_km, e.id]);
  }
  return adj;
}

export function nearestNode(nodes: GNode[], p: LL) {
  let best = nodes[0], bd = Infinity;
  for (const n of nodes) {
    const d = haversineKm(p, { lat: n.latitude, lng: n.longitude });
    if (d < bd) { bd = d; best = n; }
  }
  return { node: best, km: bd };
}

export function dijkstra(adj: Map<number, Array<[number, number, number]>>, src: number, dst: number) {
  const dist = new Map<number, number>([[src, 0]]);
  const prev = new Map<number, [number, number]>();
  const done = new Set<number>();
  const heap: Array<[number, number]> = [[0, src]];
  while (heap.length) {
    heap.sort((a, b) => a[0] - b[0]);
    const [d, u] = heap.shift()!;
    if (done.has(u)) continue;
    done.add(u);
    if (u === dst) break;
    for (const [v, w, eid] of adj.get(u) ?? []) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, [u, eid]); heap.push([nd, v]); }
    }
  }
  if (!dist.has(dst)) return null;
  const nodeIds = [dst], edgeIds: number[] = [];
  let cur = dst;
  while (cur !== src) { const [p, eid] = prev.get(cur)!; nodeIds.unshift(p); edgeIds.unshift(eid); cur = p; }
  return { km: dist.get(dst)!, nodeIds, edgeIds };
}

export const lineFeature = (coords: number[][], props: Record<string, any> = {}) => ({ type: 'Feature' as const, properties: props, geometry: { type: 'LineString' as const, coordinates: coords } });
