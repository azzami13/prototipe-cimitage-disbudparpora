export type TspNodeId = string | number;

export interface DistanceMatrixEntry {
  fromHeritageSiteId?: TspNodeId;
  toHeritageSiteId?: TspNodeId;
  from_heritage_site_id?: TspNodeId;
  to_heritage_site_id?: TspNodeId;
  distanceKm?: number;
  distance_km?: number;
}

export type DistanceMatrix =
  | Map<TspNodeId, Map<TspNodeId, number>>
  | Record<string, Record<string, number>>
  | DistanceMatrixEntry[];

export interface EvaluatedTspRoute {
  orderedIds: TspNodeId[];
  totalDistanceKm: number;
}

export interface SolveTspInput {
  startId: TspNodeId;
  destinationIds: TspNodeId[];
  fixedEndId?: TspNodeId;
  distanceMatrix: DistanceMatrix;
  maxEvaluatedRoutes?: number;
}

export interface SolveTspResult {
  orderedIds: TspNodeId[];
  totalDistanceKm: number;
  evaluatedRoutes: EvaluatedTspRoute[];
  evaluatedRouteCount: number;
  strategy: 'HELD_KARP' | 'NEAREST_NEIGHBOR';
}

const DEFAULT_MAX_EVALUATED_ROUTES = 20;
const HELD_KARP_LIMIT = 12;

export function solveTsp(input: SolveTspInput): SolveTspResult {
  const maxEvaluatedRoutes =
    input.maxEvaluatedRoutes ?? DEFAULT_MAX_EVALUATED_ROUTES;
  const destinations = normalizeDestinations(
    input.startId,
    input.destinationIds,
    input.fixedEndId,
  );
  const lookupDistance = createDistanceLookup(input.distanceMatrix);
  const strategy =
    destinations.permutableIds.length <= HELD_KARP_LIMIT
      ? 'HELD_KARP'
      : 'NEAREST_NEIGHBOR';

  if (destinations.permutableIds.length === 0) {
    const orderedIds = buildFullRoute(
      input.startId,
      [],
      destinations.fixedEndId,
    );
    const totalDistanceKm = calculateRouteDistance(orderedIds, lookupDistance);

    return {
      orderedIds,
      totalDistanceKm,
      evaluatedRoutes: [{ orderedIds, totalDistanceKm }],
      evaluatedRouteCount: 1,
      strategy,
    };
  }

  if (strategy === 'HELD_KARP') {
    return solveWithHeldKarp(
      input.startId,
      destinations.permutableIds,
      destinations.fixedEndId,
      lookupDistance,
    );
  }

  return solveWithNearestNeighbor(
    input.startId,
    destinations.permutableIds,
    destinations.fixedEndId,
    lookupDistance,
    maxEvaluatedRoutes,
  );
}

function solveWithHeldKarp(
  startId: TspNodeId,
  destinationIds: TspNodeId[],
  fixedEndId: TspNodeId | undefined,
  lookupDistance: (fromId: TspNodeId, toId: TspNodeId) => number,
): SolveTspResult {
  const count = destinationIds.length;
  const fullMask = (1 << count) - 1;
  const costs = new Map<string, number>();
  const parents = new Map<string, number>();

  for (let index = 0; index < count; index += 1) {
    costs.set(
      `${1 << index}:${index}`,
      lookupDistance(startId, destinationIds[index]),
    );
  }

  for (let mask = 1; mask <= fullMask; mask += 1) {
    for (let last = 0; last < count; last += 1) {
      if ((mask & (1 << last)) === 0) continue;
      const current = costs.get(`${mask}:${last}`);
      if (!Number.isFinite(current)) continue;
      for (let next = 0; next < count; next += 1) {
        if ((mask & (1 << next)) !== 0) continue;
        const nextMask = mask | (1 << next);
        const candidate =
          Number(current) +
          lookupDistance(destinationIds[last], destinationIds[next]);
        const key = `${nextMask}:${next}`;
        if (candidate < (costs.get(key) ?? Infinity)) {
          costs.set(key, candidate);
          parents.set(key, last);
        }
      }
    }
  }

  let bestLast = -1;
  let bestDistance = Infinity;
  for (let last = 0; last < count; last += 1) {
    const pathDistance = costs.get(`${fullMask}:${last}`) ?? Infinity;
    const totalDistance =
      fixedEndId === undefined
        ? pathDistance
        : pathDistance + lookupDistance(destinationIds[last], fixedEndId);
    if (totalDistance < bestDistance) {
      bestDistance = totalDistance;
      bestLast = last;
    }
  }

  const reversedOrder: TspNodeId[] = [];
  let mask = fullMask;
  let last = bestLast;
  while (last >= 0) {
    reversedOrder.push(destinationIds[last]);
    const previous = parents.get(`${mask}:${last}`);
    mask &= ~(1 << last);
    last = previous ?? -1;
  }
  const orderedIds = buildFullRoute(
    startId,
    reversedOrder.reverse(),
    fixedEndId,
  );
  const route = {
    orderedIds,
    totalDistanceKm: Number.isFinite(bestDistance)
      ? Number(bestDistance.toFixed(3))
      : Infinity,
  };

  return {
    orderedIds: route.orderedIds,
    totalDistanceKm: route.totalDistanceKm,
    evaluatedRoutes: [route],
    evaluatedRouteCount: costs.size,
    strategy: 'HELD_KARP',
  };
}

function solveWithNearestNeighbor(
  startId: TspNodeId,
  destinationIds: TspNodeId[],
  fixedEndId: TspNodeId | undefined,
  lookupDistance: (fromId: TspNodeId, toId: TspNodeId) => number,
  maxEvaluatedRoutes: number,
): SolveTspResult {
  const evaluatedRoutes: EvaluatedTspRoute[] = [];
  const firstChoices = destinationIds.slice(0, maxEvaluatedRoutes);

  for (const firstChoice of firstChoices) {
    const remaining = destinationIds.filter((id) => id !== firstChoice);
    const orderedMiddle = [
      firstChoice,
      ...buildNearestNeighborOrder(firstChoice, remaining, lookupDistance),
    ];
    evaluatedRoutes.push(
      buildRouteResult(startId, orderedMiddle, fixedEndId, lookupDistance),
    );
  }

  if (evaluatedRoutes.length === 0) {
    evaluatedRoutes.push(
      buildRouteResult(startId, destinationIds, fixedEndId, lookupDistance),
    );
  }

  const bestRoute = getBestEvaluatedRoutes(evaluatedRoutes, 1)[0];

  return {
    orderedIds: bestRoute.orderedIds,
    totalDistanceKm: bestRoute.totalDistanceKm,
    evaluatedRoutes: getBestEvaluatedRoutes(
      evaluatedRoutes,
      maxEvaluatedRoutes,
    ),
    evaluatedRouteCount: evaluatedRoutes.length,
    strategy: 'NEAREST_NEIGHBOR',
  };
}

function buildNearestNeighborOrder(
  startId: TspNodeId,
  destinationIds: TspNodeId[],
  lookupDistance: (fromId: TspNodeId, toId: TspNodeId) => number,
): TspNodeId[] {
  const remaining = [...destinationIds];
  const orderedIds: TspNodeId[] = [];
  let currentId = startId;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const distance = lookupDistance(currentId, remaining[index]);
      if (compareDistance(distance, bestDistance) < 0) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    const [nextId] = remaining.splice(bestIndex, 1);
    orderedIds.push(nextId);
    currentId = nextId;
  }

  return orderedIds;
}

function normalizeDestinations(
  startId: TspNodeId,
  destinationIds: TspNodeId[],
  fixedEndId?: TspNodeId,
): { permutableIds: TspNodeId[]; fixedEndId?: TspNodeId } {
  const uniqueIds = uniqueNodeIds(destinationIds).filter(
    (id) => !isSameNodeId(id, startId),
  );
  const normalizedFixedEndId =
    fixedEndId !== undefined && !isSameNodeId(fixedEndId, startId)
      ? fixedEndId
      : undefined;

  return {
    permutableIds: normalizedFixedEndId
      ? uniqueIds.filter((id) => !isSameNodeId(id, normalizedFixedEndId))
      : uniqueIds,
    fixedEndId: normalizedFixedEndId,
  };
}

function uniqueNodeIds(ids: TspNodeId[]): TspNodeId[] {
  const seen = new Set<string>();
  const result: TspNodeId[] = [];

  for (const id of ids) {
    const key = String(id);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(id);
  }

  return result;
}

function buildFullRoute(
  startId: TspNodeId,
  middleIds: TspNodeId[],
  fixedEndId?: TspNodeId,
): TspNodeId[] {
  return fixedEndId !== undefined
    ? [startId, ...middleIds, fixedEndId]
    : [startId, ...middleIds];
}

function buildRouteResult(
  startId: TspNodeId,
  middleIds: TspNodeId[],
  fixedEndId: TspNodeId | undefined,
  lookupDistance: (fromId: TspNodeId, toId: TspNodeId) => number,
): EvaluatedTspRoute {
  const orderedIds = buildFullRoute(startId, middleIds, fixedEndId);
  return {
    orderedIds,
    totalDistanceKm: calculateRouteDistance(orderedIds, lookupDistance),
  };
}

function calculateRouteDistance(
  orderedIds: TspNodeId[],
  lookupDistance: (fromId: TspNodeId, toId: TspNodeId) => number,
): number {
  let totalDistanceKm = 0;

  for (let index = 0; index < orderedIds.length - 1; index += 1) {
    const distance = lookupDistance(orderedIds[index], orderedIds[index + 1]);
    if (!Number.isFinite(distance)) return Infinity;
    totalDistanceKm += distance;
  }

  return Number(totalDistanceKm.toFixed(3));
}

function createDistanceLookup(
  distanceMatrix: DistanceMatrix,
): (fromId: TspNodeId, toId: TspNodeId) => number {
  if (distanceMatrix instanceof Map) {
    return (fromId, toId) =>
      distanceMatrix.get(fromId)?.get(toId) ??
      distanceMatrix.get(String(fromId))?.get(String(toId)) ??
      Infinity;
  }

  if (Array.isArray(distanceMatrix)) {
    const matrix = new Map<string, number>();
    for (const entry of distanceMatrix) {
      const fromId = entry.fromHeritageSiteId ?? entry.from_heritage_site_id;
      const toId = entry.toHeritageSiteId ?? entry.to_heritage_site_id;
      const distance = entry.distanceKm ?? entry.distance_km;

      if (fromId === undefined || toId === undefined) continue;
      matrix.set(buildDistanceKey(fromId, toId), Number(distance));
    }

    return (fromId, toId) =>
      matrix.get(buildDistanceKey(fromId, toId)) ?? Infinity;
  }

  return (fromId, toId) => {
    const directValue = distanceMatrix[String(fromId)]?.[String(toId)];
    return directValue === undefined ? Infinity : Number(directValue);
  };
}

function getBestEvaluatedRoutes(
  routes: EvaluatedTspRoute[],
  limit: number,
): EvaluatedTspRoute[] {
  return [...routes]
    .sort((a, b) => compareDistance(a.totalDistanceKm, b.totalDistanceKm))
    .slice(0, Math.max(limit, 1));
}

function compareDistance(a: number, b: number): number {
  if (!Number.isFinite(a) && !Number.isFinite(b)) return 0;
  if (!Number.isFinite(a)) return 1;
  if (!Number.isFinite(b)) return -1;
  return a - b;
}

function buildDistanceKey(fromId: TspNodeId, toId: TspNodeId): string {
  return `${String(fromId)}::${String(toId)}`;
}

function isSameNodeId(a: TspNodeId, b: TspNodeId): boolean {
  return String(a) === String(b);
}
