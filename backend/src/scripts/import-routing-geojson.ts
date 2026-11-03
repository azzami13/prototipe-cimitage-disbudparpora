import { NestFactory } from '@nestjs/core';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../app.module';
import { RoadEdge } from '../common/entities/road-edge.entity';
import { RoadNode } from '../common/entities/road-node.entity';
import { RoutingGraphCacheService } from '../modules/routing-engine/routing-graph-cache.service';
import { haversineM } from '../modules/routing-engine/routing-types';

type Coordinate = [number, number];

function argument(name: string, positionalIndex: number) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];

  const envName = `npm_config_${name.slice(2).replaceAll('-', '_')}`;
  const envValue = process.env[envName];
  if (envValue && envValue !== 'true') return envValue;

  // npm 11 meneruskan nilai custom option sebagai argumen positional.
  return process.argv.slice(2).filter((value) => !value.startsWith('--'))[
    positionalIndex
  ];
}

function booleanArgument(name: string) {
  if (process.argv.includes(name)) return true;
  const positionalName = name.slice(2);
  if (process.argv.slice(2).includes(positionalName)) return true;
  const envName = `npm_config_${name.slice(2).replaceAll('-', '_')}`;
  return ['1', 'true', 'yes'].includes(
    String(process.env[envName] ?? '').toLowerCase(),
  );
}

function utmToWgs84(
  easting: number,
  northing: number,
  zone = 48,
  southern = true,
): Coordinate {
  const a = 6378137;
  const eccentricity = 0.08181919084262149;
  const k0 = 0.9996;
  const x = easting - 500000;
  const y = northing - (southern ? 10000000 : 0);
  const m = y / k0;
  const mu =
    m /
    (a *
      (1 -
        eccentricity ** 2 / 4 -
        (3 * eccentricity ** 4) / 64 -
        (5 * eccentricity ** 6) / 256));
  const e1 =
    (1 - Math.sqrt(1 - eccentricity ** 2)) /
    (1 + Math.sqrt(1 - eccentricity ** 2));
  const fp =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const eSq = eccentricity ** 2 / (1 - eccentricity ** 2);
  const c1 = eSq * Math.cos(fp) ** 2;
  const t1 = Math.tan(fp) ** 2;
  const n1 = a / Math.sqrt(1 - eccentricity ** 2 * Math.sin(fp) ** 2);
  const r1 =
    (a * (1 - eccentricity ** 2)) /
    (1 - eccentricity ** 2 * Math.sin(fp) ** 2) ** 1.5;
  const d = x / (n1 * k0);
  const lat =
    fp -
    ((n1 * Math.tan(fp)) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eSq) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eSq - 3 * c1 ** 2) *
          d ** 6) /
          720);
  const origin = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const lng =
    origin +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eSq + 24 * t1 ** 2) * d ** 5) /
        120) /
      Math.cos(fp);
  return [(lng * 180) / Math.PI, (lat * 180) / Math.PI];
}

async function main() {
  const nodesPath = argument('--nodes', 0);
  const edgesPath = argument('--edges', 1);
  const dryRun = booleanArgument('--dry-run');
  const replaceGraph = booleanArgument('--replace-graph');
  if (!nodesPath || !edgesPath) {
    throw new Error(
      'Gunakan --nodes <path> --edges <path> [--dry-run] [--replace-graph]',
    );
  }
  const [nodesJson, edgesJson] = await Promise.all([
    readFile(resolve(nodesPath), 'utf8').then(JSON.parse),
    readFile(resolve(edgesPath), 'utf8').then(JSON.parse),
  ]);
  const firstCoordinate = nodesJson?.features?.[0]?.geometry?.coordinates ?? [];
  const projected =
    Math.abs(Number(firstCoordinate[0])) > 180 ||
    Math.abs(Number(firstCoordinate[1])) > 90;
  const normalize = (raw: any[]): Coordinate => {
    const coordinate: Coordinate = [Number(raw[0]), Number(raw[1])];
    return projected ? utmToWgs84(coordinate[0], coordinate[1]) : coordinate;
  };

  const nodes = new Map<
    string,
    { code: string; latitude: number; longitude: number }
  >();
  const gridScale = 250;
  const nodeGrid = new Map<string, string[]>();
  let invalidNodes = 0;
  let duplicateNodes = 0;
  for (const feature of nodesJson?.features ?? []) {
    const code = feature?.properties?.node_id;
    const coordinates = feature?.geometry?.coordinates;
    if (
      code === undefined ||
      feature?.geometry?.type !== 'Point' ||
      !Array.isArray(coordinates)
    ) {
      invalidNodes += 1;
      continue;
    }
    const [longitude, latitude] = normalize(coordinates);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      invalidNodes += 1;
      continue;
    }
    const key = String(code);
    if (nodes.has(key)) duplicateNodes += 1;
    nodes.set(key, { code: key, latitude, longitude });
    const gridKey = `${Math.floor(latitude * gridScale)}:${Math.floor(longitude * gridScale)}`;
    nodeGrid.set(gridKey, [...(nodeGrid.get(gridKey) ?? []), key]);
  }

  const nearestNode = (coordinate: Coordinate) => {
    const gridLat = Math.floor(coordinate[1] * gridScale);
    const gridLng = Math.floor(coordinate[0] * gridScale);
    const candidateCodes: string[] = [];
    for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
      for (let lngOffset = -1; lngOffset <= 1; lngOffset += 1) {
        candidateCodes.push(
          ...(nodeGrid.get(`${gridLat + latOffset}:${gridLng + lngOffset}`) ??
            []),
        );
      }
    }
    let best: { code: string; distanceM: number } | null = null;
    for (const code of candidateCodes) {
      const node = nodes.get(code)!;
      const distanceM = haversineM(
        coordinate[1],
        coordinate[0],
        node.latitude,
        node.longitude,
      );
      if (!best || distanceM < best.distanceM)
        best = { code: node.code, distanceM };
    }
    return best && best.distanceM <= 5 ? best.code : null;
  };
  const coordinateLookup = new Map(
    [...nodes.values()].map((node) => [
      `${node.longitude.toFixed(7)}:${node.latitude.toFixed(7)}`,
      node.code,
    ]),
  );
  const edgeInputs: Array<any> = [];
  let invalidEdges = 0;
  let skippedEdges = 0;
  const edgeCodes = new Set<string>();
  for (const feature of edgesJson?.features ?? []) {
    const rawCoordinates = feature?.geometry?.coordinates;
    const props = feature?.properties ?? {};
    if (
      feature?.geometry?.type !== 'LineString' ||
      !Array.isArray(rawCoordinates) ||
      rawCoordinates.length < 2
    ) {
      invalidEdges += 1;
      continue;
    }
    if (
      ['0', 'false', 'no'].includes(
        String(props.sakoci_allowed ?? 1).toLowerCase(),
      )
    ) {
      skippedEdges += 1;
      continue;
    }
    const geometry = rawCoordinates.map(normalize);
    const start = geometry[0];
    const end = geometry[geometry.length - 1];
    const fromCode =
      coordinateLookup.get(`${start[0].toFixed(7)}:${start[1].toFixed(7)}`) ??
      nearestNode(start);
    const toCode =
      coordinateLookup.get(`${end[0].toFixed(7)}:${end[1].toFixed(7)}`) ??
      nearestNode(end);
    if (!fromCode || !toCode || fromCode === toCode) {
      invalidEdges += 1;
      continue;
    }
    const code = String(
      props.edge_id ?? props.id ?? `edge-${edgeInputs.length + 1}`,
    );
    if (edgeCodes.has(code)) {
      skippedEdges += 1;
      continue;
    }
    edgeCodes.add(code);
    const calculatedLength = geometry
      .slice(1)
      .reduce(
        (sum, point, index) =>
          sum +
          haversineM(
            geometry[index][1],
            geometry[index][0],
            point[1],
            point[0],
          ),
        0,
      );
    const lengthM = Number(props.length_m);
    const safeLengthM =
      Number.isFinite(lengthM) && lengthM > 0 ? lengthM : calculatedLength;
    const forward = Number(props.cost);
    const reverse = Number(props.reverse_cost);
    edgeInputs.push({
      code,
      fromCode,
      toCode,
      geometry,
      distance_km: safeLengthM / 1000,
      forward_cost_m: Number.isFinite(forward) ? forward : safeLengthM,
      reverse_cost_m: Number.isFinite(reverse) ? reverse : safeLengthM,
      oneway: Number.isFinite(reverse) ? reverse < 0 : Boolean(props.oneway),
      sakoci_allowed: true,
      vehicle_accessible: true,
      road_name: props.name ?? props.road_name ?? null,
    });
  }

  const summary = {
    projectedUtmDetected: projected,
    nodesValid: nodes.size,
    nodesInvalid: invalidNodes,
    nodesDuplicate: duplicateNodes,
    edgesValid: edgeInputs.length,
    edgesInvalid: invalidEdges,
    edgesSkipped: skippedEdges,
    dryRun,
    replaceGraph,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (dryRun) return;
  if (!nodes.size || !edgeInputs.length)
    throw new Error('Tidak ada graph valid untuk diimpor');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const dataSource = app.get(DataSource);
    await dataSource.transaction(async (manager) => {
      const nodeRepo = manager.getRepository(RoadNode);
      const nodeValues = [...nodes.values()];
      for (let offset = 0; offset < nodeValues.length; offset += 1000) {
        await nodeRepo.upsert(nodeValues.slice(offset, offset + 1000), [
          'code',
        ]);
      }
      const storedNodes = await nodeRepo.find({ select: ['id', 'code'] });
      const idByCode = new Map(storedNodes.map((node) => [node.code, node.id]));
      const edges = edgeInputs
        .map((edge) => ({
          ...edge,
          from_node_id: idByCode.get(edge.fromCode),
          to_node_id: idByCode.get(edge.toCode),
        }))
        .filter((edge) => edge.from_node_id && edge.to_node_id);
      const edgeRepo = manager.getRepository(RoadEdge);
      for (let offset = 0; offset < edges.length; offset += 500) {
        await edgeRepo.upsert(edges.slice(offset, offset + 500), ['code']);
      }
      if (replaceGraph) {
        const importedCodes = new Set(edges.map((edge) => edge.code));
        const existingCodes = await edgeRepo.find({ select: ['id', 'code'] });
        const staleIds = existingCodes
          .filter((edge) => !importedCodes.has(edge.code))
          .map((edge) => edge.id);
        for (let offset = 0; offset < staleIds.length; offset += 1000) {
          await edgeRepo.update(
            { id: In(staleIds.slice(offset, offset + 1000)) },
            { sakoci_allowed: false, vehicle_accessible: false },
          );
        }
        console.warn(
          `--replace-graph menonaktifkan ${staleIds.length} edge lama tanpa DELETE/TRUNCATE.`,
        );
      }
    });
    await app.get(RoutingGraphCacheService).reload();
    console.log(
      'Import graph selesai dan cache backend berhasil dimuat ulang.',
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
