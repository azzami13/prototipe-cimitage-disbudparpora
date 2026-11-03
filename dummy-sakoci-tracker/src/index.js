require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 3010);
const BACKEND_API_URL = (process.env.BACKEND_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const DEFAULT_SPEED_KMH = Number(process.env.DEFAULT_SPEED_KMH || 25);
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS || 1000);

/** @type {Map<number, any>} */
const activeTrips = new Map();

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function interpolatePoint(a, b, ratio) {
  return {
    lat: a.lat + (b.lat - a.lat) * ratio,
    lng: a.lng + (b.lng - a.lng) * ratio,
  };
}

function normalizePoint(point, label = 'point') {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`${label} harus memiliki lat/lng valid`);
  }

  return {
    id: point.id,
    name: point.name || label,
    lat,
    lng,
  };
}

function extractPolylineFromOptimizeResult(result) {
  const points = [];

  for (const segment of result?.segments || []) {
    const coordinates = segment?.geometry?.coordinates;

    if (Array.isArray(coordinates) && coordinates.length > 0) {
      for (const [lng, lat] of coordinates) {
        points.push({ lat: Number(lat), lng: Number(lng) });
      }
    } else if (segment?.from && segment?.to) {
      points.push(normalizePoint(segment.from, 'segment.from'));
      points.push(normalizePoint(segment.to, 'segment.to'));
    }
  }

  return dedupePolyline(points);
}

function extractPolylineFromGeometryPayload(body) {
  const points = [];

  if (Array.isArray(body.points)) {
    for (const point of body.points) {
      points.push(normalizePoint(point, 'points[]'));
    }
  }

  if (body.geometry?.type === 'LineString' && Array.isArray(body.geometry.coordinates)) {
    for (const [lng, lat] of body.geometry.coordinates) {
      points.push({ lat: Number(lat), lng: Number(lng) });
    }
  }

  if (Array.isArray(body.segments)) {
    for (const segment of body.segments) {
      const coordinates = segment?.geometry?.coordinates;
      if (Array.isArray(coordinates) && coordinates.length > 0) {
        for (const [lng, lat] of coordinates) {
          points.push({ lat: Number(lat), lng: Number(lng) });
        }
      } else if (segment?.from && segment?.to) {
        points.push(normalizePoint(segment.from, 'segment.from'));
        points.push(normalizePoint(segment.to, 'segment.to'));
      }
    }
  }

  return dedupePolyline(points);
}

function dedupePolyline(points) {
  const clean = [];
  for (const point of points) {
    const lat = Number(point.lat);
    const lng = Number(point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const prev = clean[clean.length - 1];
    if (!prev || Math.abs(prev.lat - lat) > 1e-7 || Math.abs(prev.lng - lng) > 1e-7) {
      clean.push({ lat, lng });
    }
  }
  return clean;
}

async function updateBackendLocation(sakociId, point) {
  const url = `${BACKEND_API_URL}/sakoci/${sakociId}/location`;
  await axios.put(url, {
    latitude: point.lat,
    longitude: point.lng,
  }, { timeout: 5000 });
}

function stopTrip(sakociId, reason = 'stopped') {
  const trip = activeTrips.get(Number(sakociId));
  if (!trip) return false;
  clearInterval(trip.timer);
  trip.status = reason;
  trip.endedAt = new Date().toISOString();
  activeTrips.delete(Number(sakociId));
  return true;
}

function startTrip({ sakociId, polyline, speedKmh, loop = false, meta = {} }) {
  const id = Number(sakociId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('sakociId wajib berupa angka positif');
  }

  if (!Array.isArray(polyline) || polyline.length < 2) {
    throw new Error('Polyline minimal berisi 2 titik');
  }

  stopTrip(id, 'replaced');

  const speedMetersPerSecond = Math.max(Number(speedKmh || DEFAULT_SPEED_KMH), 1) * 1000 / 3600;
  const stepDistance = speedMetersPerSecond * (UPDATE_INTERVAL_MS / 1000);

  const trip = {
    sakociId: id,
    status: 'running',
    speedKmh: Number(speedKmh || DEFAULT_SPEED_KMH),
    loop: Boolean(loop),
    polyline,
    segmentIndex: 0,
    distanceOnSegment: 0,
    totalSent: 0,
    currentPoint: polyline[0],
    startedAt: new Date().toISOString(),
    endedAt: null,
    meta,
    timer: null,
  };

  const tick = async () => {
    try {
      let remaining = stepDistance;

      while (remaining > 0 && trip.segmentIndex < polyline.length - 1) {
        const from = polyline[trip.segmentIndex];
        const to = polyline[trip.segmentIndex + 1];
        const segmentLength = Math.max(haversineMeters(from, to), 0.01);
        const leftOnSegment = segmentLength - trip.distanceOnSegment;

        if (remaining >= leftOnSegment) {
          remaining -= leftOnSegment;
          trip.segmentIndex += 1;
          trip.distanceOnSegment = 0;
          trip.currentPoint = to;
        } else {
          trip.distanceOnSegment += remaining;
          const ratio = trip.distanceOnSegment / segmentLength;
          trip.currentPoint = interpolatePoint(from, to, ratio);
          remaining = 0;
        }
      }

      if (trip.segmentIndex >= polyline.length - 1) {
        trip.currentPoint = polyline[polyline.length - 1];
        await updateBackendLocation(id, trip.currentPoint);
        trip.totalSent += 1;

        if (trip.loop) {
          trip.segmentIndex = 0;
          trip.distanceOnSegment = 0;
          trip.polyline = [...trip.polyline].reverse();
          return;
        }

        stopTrip(id, 'finished');
        return;
      }

      await updateBackendLocation(id, trip.currentPoint);
      trip.totalSent += 1;
    } catch (error) {
      trip.lastError = error.message;
      console.error(`[DummyTracker] Gagal update Sakoci #${id}:`, error.message);
    }
  };

  trip.timer = setInterval(tick, UPDATE_INTERVAL_MS);
  activeTrips.set(id, trip);

  // kirim titik awal langsung supaya marker muncul cepat
  tick();

  return trip;
}

function publicTrip(trip) {
  return {
    sakociId: trip.sakociId,
    status: trip.status,
    speedKmh: trip.speedKmh,
    loop: trip.loop,
    segmentIndex: trip.segmentIndex,
    totalSegments: Math.max(trip.polyline.length - 1, 0),
    totalPoints: trip.polyline.length,
    totalSent: trip.totalSent,
    currentPoint: trip.currentPoint,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    lastError: trip.lastError || null,
    meta: trip.meta,
  };
}

app.get('/', (req, res) => {
  res.json({
    name: 'Dummy Sakoci Tracker',
    backendApiUrl: BACKEND_API_URL,
    updateIntervalMs: UPDATE_INTERVAL_MS,
    activeTrips: activeTrips.size,
  });
});

app.get('/trips', (req, res) => {
  res.json([...activeTrips.values()].map(publicTrip));
});

app.get('/trips/:sakociId', (req, res) => {
  const trip = activeTrips.get(Number(req.params.sakociId));
  if (!trip) return res.status(404).json({ message: 'Trip tidak aktif / tidak ditemukan' });
  res.json(publicTrip(trip));
});

app.delete('/trips/:sakociId', (req, res) => {
  const ok = stopTrip(Number(req.params.sakociId), 'stopped');
  res.json({ stopped: ok });
});

app.post('/trips', async (req, res) => {
  try {
    const { sakociId, destinations, userLocation, speedKmh, loop } = req.body;
    const normalizedDestinations = (destinations || []).map((p, i) => normalizePoint(p, `destinations[${i}]`));

    if (normalizedDestinations.length < 2 && !userLocation) {
      return res.status(400).json({ message: 'Minimal 2 destinasi, atau 1 start userLocation + 1 destinasi' });
    }

    const optimizeBody = {
      destinations: normalizedDestinations,
      userLocation: userLocation ? normalizePoint(userLocation, 'userLocation') : undefined,
    };

    const routeRes = await axios.post(`${BACKEND_API_URL}/routing/optimize`, optimizeBody, { timeout: 30000 });
    const polyline = extractPolylineFromOptimizeResult(routeRes.data);

    const trip = startTrip({
      sakociId,
      polyline,
      speedKmh,
      loop,
      meta: {
        mode: 'routing-optimize',
        orderedDestinations: routeRes.data.orderedDestinations || [],
        totalDistance: routeRes.data.totalDistance,
        totalDuration: routeRes.data.totalDuration,
      },
    });

    res.status(201).json({
      message: 'Dummy tracking dimulai',
      trip: publicTrip(trip),
      route: routeRes.data,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/trips/from-geometry', async (req, res) => {
  try {
    const { sakociId, speedKmh, loop } = req.body;
    const polyline = extractPolylineFromGeometryPayload(req.body);

    const trip = startTrip({
      sakociId,
      polyline,
      speedKmh,
      loop,
      meta: { mode: 'provided-geometry' },
    });

    res.status(201).json({
      message: 'Dummy tracking dari geometry dimulai',
      trip: publicTrip(trip),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Dummy Sakoci Tracker running on http://localhost:${PORT}`);
  console.log(`Backend target: ${BACKEND_API_URL}`);
});
