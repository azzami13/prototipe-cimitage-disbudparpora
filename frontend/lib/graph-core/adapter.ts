import type { RoadEdge, RoadNode } from '../api';
import type { EdgeRecord, NodeRecord } from './types';

export function adaptRoadNode(node: RoadNode): NodeRecord {
  return {
    id: node.id,
    code: node.code,
    latLng: [Number(node.latitude), Number(node.longitude)],
    type: node.type ?? null,
    name: node.name ?? null,
    degree: 0,
  };
}

export function adaptRoadEdge(edge: RoadEdge): EdgeRecord {
  return {
    id: edge.id,
    code: edge.code,
    fromNodeId: edge.from_node_id,
    toNodeId: edge.to_node_id,
    distanceKm: Number(edge.distance_km),
    roadName: edge.road_name ?? null,
    oneWay: Boolean(edge.oneway),
    vehicleAccessible: Boolean(edge.vehicle_accessible),
  };
}
