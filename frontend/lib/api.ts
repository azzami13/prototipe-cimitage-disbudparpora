import { waitForBackendReady } from './backend-readiness';
import { API_BASE_URL as BASE } from './runtime-config';
let sessionTokenPromise: Promise<string | null> | null = null;

async function readJsonResponse<T>(res: Response, fallback: T): Promise<T> {
  if (res.status === 204 || res.status === 205) return fallback;

  const text = await res.text();
  if (!text.trim()) return fallback;

  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function getAccessToken() {
  if (typeof window === 'undefined') return null;

  const localToken = localStorage.getItem('token');
  if (localToken) return localToken;

  sessionTokenPromise ??= fetch('/api/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const session = await readJsonResponse<any>(response, null);
      const token = typeof session?.accessToken === 'string' ? session.accessToken : null;
      if (token) localStorage.setItem('token', token);
      return token;
    })
    .catch(() => null)
    .finally(() => {
      sessionTokenPromise = null;
    });

  return sessionTokenPromise;
}

// ─── Generic request helper ────────────────────────────────────────────────────
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  await waitForBackendReady();
  const token = await getAccessToken();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await readJsonResponse<any>(res, { message: res.statusText }).catch(() => ({ message: res.statusText }));
    const error = new Error(err.message ?? `HTTP ${res.status}`) as Error & { code?: string; status?: number };
    error.code = err.code;
    error.status = res.status;
    throw error;
  }

  return readJsonResponse<T>(res, null as T);
}

// ─── API object ────────────────────────────────────────────────────────────────
export const api = {
  // ── Heritage Sites ──────────────────────────────────────────────────────────
  heritage: {
    list: (params?: Record<string, string>) =>
      req<PaginatedResult<HeritageSite>>(
        `/heritage?${new URLSearchParams(params)}`,
      ),
    geojson: () => req<GeoJSONFeatureCollection>('/heritage/geojson'),
    one: (id: number) => req<HeritageSite>(`/heritage/${id}`),
    create: (body: Partial<HeritageSite>) =>
      req<HeritageSite>('/heritage', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Partial<HeritageSite>) =>
      req<HeritageSite>(`/heritage/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      req<{ message: string }>(`/heritage/${id}`, { method: 'DELETE' }),
    upload: async (file: File) => {
      await waitForBackendReady();
      const token = await getAccessToken();
      const body = new FormData();
      body.append('file', file);

      const res = await fetch(`${BASE}/heritage/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });

      if (!res.ok) {
        const err = await readJsonResponse<any>(res, { message: res.statusText }).catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      return readJsonResponse<{ url: string; filename: string; mimetype: string }>(res, null as any);
    },
    statsByCategory: () =>
      req<Array<{ category: string; count: string }>>(
        '/heritage/stats/category',
      ),
    statsByKecamatan: () =>
      req<Array<{ kecamatan: string; count: string }>>(
        '/heritage/stats/kecamatan',
      ),
    summary: () => req<HeritageSummary>('/heritage/stats/summary'),
  },

  // ── Tour Packages ───────────────────────────────────────────────────────────
  packages: {
    list: (params?: Record<string, string>) =>
      req<PaginatedResult<TourPackage>>(
        `/tour-packages?${new URLSearchParams(params)}`,
      ),
    /** Shortcut untuk mengambil semua paket aktif (tanpa pagination) */
    listActive: () =>
      req<PaginatedResult<TourPackage>>('/tour-packages?active=true&limit=100'),
    one: (id: number) => req<TourPackage>(`/tour-packages/${id}`),
    create: (body: CreateTourPackageBody) =>
      req<TourPackage>('/tour-packages', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Partial<CreateTourPackageBody>) =>
      req<TourPackage>(`/tour-packages/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      req<{ message: string }>(`/tour-packages/${id}`, { method: 'DELETE' }),
    toggleActive: (id: number) =>
      req<TourPackage>(`/tour-packages/${id}/toggle-active`, {
        method: 'PUT',
      }),
    reorder: (id: number, sequences: Array<{ routeId: number; sequence: number }>) =>
      req<TourPackage>(`/tour-packages/${id}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ sequences }),
      }),
  },

  // ── Package Routes ──────────────────────────────────────────────────────────
  packageRoutes: {
    list: (tourPackageId?: number) =>
      req<PackageRoute[]>(
        `/package-routes${tourPackageId ? `?tour_package_id=${tourPackageId}` : ''}`,
      ),
    one: (id: number) => req<PackageRoute>(`/package-routes/${id}`),
    create: (body: CreatePackageRouteBody) =>
      req<PackageRoute>('/package-routes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Partial<CreatePackageRouteBody>) =>
      req<PackageRoute>(`/package-routes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      req<{ message: string }>(`/package-routes/${id}`, { method: 'DELETE' }),
    bulkReorder: (
      tourPackageId: number,
      items: Array<{ id: number; sequence: number }>,
    ) =>
      req<PackageRoute[]>(
        `/package-routes/by-package/${tourPackageId}/reorder`,
        { method: 'PUT', body: JSON.stringify({ items }) },
      ),
    removeAllByPackage: (tourPackageId: number) =>
      req<{ message: string }>(
        `/package-routes/by-package/${tourPackageId}`,
        { method: 'DELETE' },
      ),
  },

  // ── Bookings ────────────────────────────────────────────────────────────────
  bookings: {
    list: (params?: Record<string, string>) =>
      req<PaginatedResult<Booking>>(
        `/bookings?${new URLSearchParams(params)}`,
      ),
    one: (id: number) => req<Booking>(`/bookings/${id}`),
    route: (id: number) => req<RouteSnapshot>(`/bookings/${id}/route`),
    availability: (params: BookingAvailabilityParams) =>
      req<BookingAvailability>(`/bookings/availability?${new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== undefined) as [string, string][],
      )}`),
    mine: (token?: string) => req<Booking[]>('/bookings/me', authInit(token)),
    create: (body: CreateBookingBody) =>
      req<Booking>('/bookings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createMine: (body: CreateBookingBody) =>
      req<Booking>('/bookings/me', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateMyTravel: (id: number, body: UpdateBookingTravelBody) =>
      req<Booking>(`/bookings/${id}/travel`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    updateStatus: (id: number, status: string, notes?: string) =>
      req<Booking>(`/bookings/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, notes }),
      }),
    staff: (role?: 'tour_guide' | 'driver') =>
      req<AuthUser[]>(`/bookings/staff${role ? `?role=${role}` : ''}`),
    updateAssignment: (id: number, body: BookingAssignmentBody) =>
      req<Booking>(`/bookings/${id}/assignment`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    updatePayment: (id: number, body: BookingPaymentBody) =>
      req<Booking>(`/bookings/${id}/payment`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    verifyPayment: (id: number, body: { paid_amount?: number | null; payment_method?: string | null }) =>
      req<Booking>(`/bookings/${id}/payment/verify`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    rejectPayment: (id: number, reason: string) =>
      req<Booking>(`/bookings/${id}/payment/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    cancel: (id: number, reason: string) =>
      req<Booking>(`/bookings/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    finalizeRoute: (id: number, body?: {
      endpoint?: TripAssignmentBody['endpoint'];
      vehicleProfile?: string;
    }) =>
      req<RouteSnapshot>(`/bookings/${id}/finalize-route`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
    reoptimizeRoute: (id: number, reason: string) =>
      req<RouteSnapshot>(`/bookings/${id}/reoptimize-route`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    updateLocation: (id: number, body: { latitude: number; longitude: number }) =>
      req<Booking>(`/bookings/${id}/location`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    uploadPaymentProof: async (id: number, file: File) => {
      await waitForBackendReady();
      const token = await getAccessToken();
      const body = new FormData();
      body.append('file', file);

      const res = await fetch(`${BASE}/bookings/${id}/payment/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });

      if (!res.ok) {
        const err = await readJsonResponse<any>(res, { message: res.statusText }).catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      return readJsonResponse<{ url: string; filename: string; mimetype: string; booking: Booking }>(res, null as any);
    },
    openPaymentProof: async (id: number, kind: 'customer' | 'admin') => {
      await waitForBackendReady();
      const token = await getAccessToken();
      const res = await fetch(`${BASE}/bookings/${id}/payment/proof/${kind}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await readJsonResponse<any>(res, { message: res.statusText }).catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      const objectUrl = URL.createObjectURL(await res.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.target = '_blank';
      anchor.rel = 'noreferrer';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    },
    stats: () => req<BookingStats>('/bookings/stats'),
  },

  rentalOptions: {
    list: (active?: boolean) =>
      req<RentalOption[]>(
        `/rental-options${active === undefined ? '' : `?active=${active}`}`,
      ),
    create: (body: CreateRentalOptionBody) =>
      req<RentalOption>('/rental-options', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: number, body: CreateRentalOptionBody) =>
      req<RentalOption>(`/rental-options/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      req<{ message: string }>(`/rental-options/${id}`, { method: 'DELETE' }),
  },

  sakoci: {
    list: (params?: Record<string, string>) =>
      req<Sakoci[]>(
        `/sakoci?${new URLSearchParams(params)}`,
      ),
    publicList: () => req<PublicSakoci[]>('/sakoci/public'),
    one: (id: number) => req<Sakoci>(`/sakoci/${id}`),
    create: (body: SakociBody) =>
      req<Sakoci>('/sakoci', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: number, body: Partial<SakociBody>) =>
      req<Sakoci>(`/sakoci/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    updateLocation: (id: number, body: { latitude: number; longitude: number }) =>
      req<Sakoci>(`/sakoci/${id}/location`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    uploadImage: async (id: number, file: File) => {
      await waitForBackendReady();
      const token = await getAccessToken();
      const body = new FormData();
      body.append('file', file);

      const res = await fetch(`${BASE}/sakoci/${id}/image`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });

      if (!res.ok) {
        const err = await readJsonResponse<any>(res, { message: res.statusText }).catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      return readJsonResponse<{ url: string; filename: string; mimetype: string; sakoci: Sakoci }>(res, null as any);
    },
    delete: (id: number) =>
      req<{ message: string }>(`/sakoci/${id}`, { method: 'DELETE' }),
  },

  users: {
    list: (params?: Record<string, string>) =>
      req<PaginatedResult<ManagedUser>>(
        `/admin/users?${new URLSearchParams(params)}`,
      ),
    one: (id: number) => req<ManagedUser>(`/admin/users/${id}`),
    create: (body: CreateManagedUserBody) =>
      req<ManagedUser>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateStatus: (id: number, status: AccountStatus) =>
      req<ManagedUser>(`/admin/users/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    updateRole: (id: number, role_id?: number | null) =>
      req<ManagedUser>(`/admin/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role_id }),
      }),
    delete: (id: number) =>
      req<{ message: string; user: ManagedUser }>(`/admin/users/${id}`, {
        method: 'DELETE',
      }),
    roles: () => req<Role[]>('/admin/users/roles'),
  },

  tripAssignments: {
    one: (bookingId: number) =>
      req<DriverTrip | null>(`/admin/bookings/${bookingId}/assignment`),
    create: (bookingId: number, body: TripAssignmentBody) =>
      req<DriverTrip>(`/admin/bookings/${bookingId}/assignment`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (bookingId: number, body: TripAssignmentBody) =>
      req<DriverTrip>(`/admin/bookings/${bookingId}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    cancel: (bookingId: number, reason: string) =>
      req<DriverTrip>(`/admin/bookings/${bookingId}/assignment/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    active: () => req<DriverTrip[]>('/admin/trips/active'),
    incidents: (tripId: number) =>
      req<TripIncident[]>(`/admin/trips/${tripId}/incidents`),
    resolveIncident: (tripId: number, incidentId: number, resolution_note?: string) =>
      req<TripIncident>(`/admin/trips/${tripId}/incidents/${incidentId}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution_note }),
      }),
    updateIncidentStatus: (
      tripId: number,
      incidentId: number,
      body: { status: TripIncident['status']; resolution_note?: string | null },
    ) =>
      req<TripIncident>(`/admin/trips/${tripId}/incidents/${incidentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },

  tripPlayback: {
    route: (tripId: number) =>
      req<TripRoutePlayback>(`/trips/${tripId}/route`),
    publicRoute: (tripId: number) =>
      req<TripRoutePlayback>(`/trips/${tripId}/public-route`),
  },

  adminDashboard: {
    summary: (period: '7d' | '30d' | 'month' = '7d') =>
      req<AdminDashboardSummary>(`/admin/dashboard/summary?period=${period}`),
  },

  operations: {
    settings: () => req<SystemSettings>('/admin/settings'),
    updateSettings: (body: Partial<SystemSettings>) =>
      req<SystemSettings>('/admin/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    notifications: (limit = 50) =>
      req<{ data: OperationalAlert[]; total: number }>(`/admin/notifications?limit=${limit}`),
    audit: (params?: Record<string, string>) =>
      req<PaginatedResult<AuditLogItem>>(`/admin/audit?${new URLSearchParams(params)}`),
    report: (params?: Record<string, string>) =>
      req<OperationalReport>(`/admin/reports/operational?${new URLSearchParams(params)}`),
    exportReportCsv: async (params?: Record<string, string>) => {
      await waitForBackendReady();
      const token = await getAccessToken();
      const res = await fetch(`${BASE}/admin/reports/operational.csv?${new URLSearchParams(params)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await readJsonResponse<any>(res, { message: res.statusText }).catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }
      const objectUrl = URL.createObjectURL(await res.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'cimitage-operational-report.csv';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    },
    receipt: (bookingId: number) => req<BookingReceipt>(`/bookings/${bookingId}/receipt`),
  },

  driver: {
    dashboard: () => req<DriverDashboard>('/driver/dashboard'),
    tasks: (status?: 'upcoming' | 'active' | 'completed') =>
      req<DriverTrip[]>(`/driver/tasks${status ? `?status=${status}` : ''}`),
    task: (tripId: number) => req<DriverTrip>(`/driver/tasks/${tripId}`),
    action: (tripId: number, body: TripActionBody) =>
      req<DriverTrip>(`/driver/tasks/${tripId}/actions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    location: (tripId: number, body: TripLocationBody) =>
      req<TripLocationUpdate>(`/driver/tasks/${tripId}/location`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    incident: (tripId: number, body: TripIncidentBody) =>
      req<TripIncident>(`/driver/tasks/${tripId}/incidents`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    destinations: () => req<HeritageSite[]>('/driver/destinations'),
    destination: (id: number) => req<HeritageSite>(`/driver/destinations/${id}`),
    history: () => req<DriverTrip[]>('/driver/history'),
  },

  guide: {
    dashboard: () => req<GuideDashboard>('/guide/dashboard'),
    tasks: (status?: 'upcoming' | 'active' | 'completed') =>
      req<DriverTrip[]>(`/guide/tasks${status ? `?status=${status}` : ''}`),
    task: (tripId: number) => req<DriverTrip>(`/guide/tasks/${tripId}`),
    action: (tripId: number, body: GuideActionBody) =>
      req<DriverTrip>(`/guide/tasks/${tripId}/actions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    incident: (tripId: number, body: TripIncidentBody) =>
      req<TripIncident>(`/guide/tasks/${tripId}/incidents`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    destinations: () => req<GuideDestinationsResponse>('/guide/destinations'),
    destination: (id: number) => req<HeritageSite>(`/guide/destinations/${id}`),
    history: () => req<DriverTrip[]>('/guide/history'),
  },

  // ── Routing ─────────────────────────────────────────────────────────────────
  graph: {
    rebuild: () =>
      req<GraphRebuildSummary>('/graph/rebuild', { method: 'POST' }),
    destinationMatrix: () =>
      req<GraphDestinationMatrix>('/graph/destination-matrix'),
    destinationDistances: () =>
      req<DestinationDistance[]>('/graph/destination-distances'),
    roadNodes: (page = 1, limit = 1000) =>
      req<PaginatedRoadResult<RoadNode>>(`/graph/road-nodes?${new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })}`),
    roadEdges: (page = 1, limit = 1000) =>
      req<PaginatedRoadResult<RoadEdge>>(`/graph/road-edges?${new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })}`),
    playback: (nodeIds: number[], edgeIds: number[]) =>
      req<PlaybackGraph>(`/graph/playback?${new URLSearchParams({
        nodeIds: nodeIds.join(','),
        edgeIds: edgeIds.join(','),
      })}`),
    radius: (latitude: number, longitude: number, radiusMeters = 2000) =>
      req<PlaybackGraphRadius>(`/graph/radius?${new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        radiusMeters: String(radiusMeters),
      })}`),
  },

  routing: {
    optimize: (
      destinations: GeoPoint[],
      userLocation?: { lat: number; lng: number },
    ) =>
      req<OptimalRouteResult>('/routing/optimize', {
        method: 'POST',
        body: JSON.stringify({ destinations, userLocation }),
      }),
    dijkstra: (points: GeoPoint[], sourceIndex: number) =>
      req<any>('/routing/dijkstra', {
        method: 'POST',
        body: JSON.stringify({ points, sourceIndex }),
      }),
    optimizeV2: (body: OptimizeRouteV2Body) =>
      req<OptimizeRouteV2Result>('/routing/optimize-v2', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    preview: (body: OptimizeRouteV2Body) =>
      req<OptimizeRouteV2Result>('/routing/preview', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  // ── Auth (read-only, jangan ubah) ───────────────────────────────────────────
  auth: {
    login: (email: string, password: string) =>
      req<{ access_token: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (body: { name: string; email: string; password: string }) =>
      req<{ id: number; name: string; email: string; active: boolean; account_status: string; registered_at: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    me: (token?: string) => req<AuthUser>('/auth/me', authInit(token)),
    updateProfile: (body: ProfileBody, token?: string) =>
      req<AuthUser>('/auth/profile', {
        ...authInit(token),
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    uploadAvatar: async (file: File, token?: string) => {
      await waitForBackendReady();
      const localToken =
        token ?? await getAccessToken();
      const body = new FormData();
      body.append('file', file);

      const res = await fetch(`${BASE}/auth/profile/avatar`, {
        method: 'POST',
        headers: {
          ...(localToken ? { Authorization: `Bearer ${localToken}` } : {}),
        },
        body,
      });

      if (!res.ok) {
        const err = await readJsonResponse<any>(res, { message: res.statusText }).catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? `HTTP ${res.status}`);
      }

      return readJsonResponse<AuthUser>(res, null as any);
    },
  },
};

function authInit(token?: string): RequestInit {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

// ─── TypeScript Types ──────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HeritageSite {
  id: number;
  name: string;
  category: string; // BG | SI | KA | BD
  description?: string;
  address?: string;
  kelurahan?: string;
  kecamatan?: string;
  latitude?: number;
  longitude?: number;
  no_register?: string;
  sk_penetapan?: string;
  status: string; // aktif | tidak aktif | dalam kajian
  image_url?: string;
  images?: HeritageMediaItem[];
  youtube_links?: HeritageMediaItem[];
  pdf_files?: HeritageMediaItem[];
  tahun_register?: string;
  distance_km?: number;
  created_at: string;
}

export interface HeritageMediaItem {
  url: string;
  title?: string;
  is_visible?: boolean;
}

export interface TourPackage {
  id: number;
  code: string;
  name: string;
  description?: string;
  price_per_person: number;
  duration_hours?: number;
  active: boolean;
  image_url?: string;
  routes: PackageRoute[];
  created_at: string;
}

export interface PackageRoute {
  id: number;
  tour_package_id: number;
  heritage_site_id: number;
  sequence: number;
  notes?: string;
  heritage_site: HeritageSite;
  tour_package?: TourPackage;
}

export interface CreateTourPackageBody {
  code: string;
  name: string;
  description?: string;
  price_per_person?: number;
  duration_hours?: number;
  active?: boolean;
  image_url?: string;
  heritageIds?: number[];
}

export interface CreatePackageRouteBody {
  tour_package_id: number;
  heritage_site_id: number;
  sequence: number;
  notes?: string;
}

export interface Booking {
  id: number;
  booking_type?: 'package' | 'rental' | 'private';
  group_name: string;
  tour_package_id?: number;
  rental_option_id?: number;
  visit_date: string;
  pickup_time?: string;
  pickup_location?: string;
  pickup_maps_url?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  private_destination_ids?: number[];
  private_destinations?: HeritageSite[];
  participants: number;
  status: string;
  payment_status?: 'unpaid' | 'waiting_verification' | 'paid' | 'rejected' | 'expired' | 'refunded';
  payment_method?: string;
  paid_amount?: number;
  payment_proof_url?: string;
  admin_payment_proof_url?: string;
  payment_notes?: string;
  payment_rejection_reason?: string | null;
  payment_verified_at?: string | null;
  payment_rejected_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by_role?: string | null;
  cancellation_reason?: string | null;
  assigned_tour_guide_id?: number;
  assigned_driver_id?: number;
  sakoci_id?: number;
  vehicle_name?: string;
  vehicle_plate_number?: string;
  vehicle_latitude?: number;
  vehicle_longitude?: number;
  vehicle_location_updated_at?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
  total_price: number;
  tour_package?: TourPackage;
  rental_option?: RentalOption;
  tour_guide?: AuthUser;
  driver?: AuthUser;
  sakoci?: Sakoci;
  created_at: string;
}

export interface CreateBookingBody {
  booking_type?: 'package' | 'rental' | 'private';
  name?: string;
  groupName?: string;
  nama_rombongan?: string;
  namaRombongan?: string;
  group_name: string;
  tour_package_id?: number;
  rental_option_id?: number;
  visit_date?: string;
  pickup_time?: string;
  pickup_location?: string;
  pickup_maps_url?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  private_destination_ids?: number[];
  participants: number;
  password: string;
  nik: string;
  birth_place: string;
  birth_date: string;
  domicile: string;
  ktp_address: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}

export interface BookingAvailabilityParams {
  booking_type: 'package' | 'rental' | 'private';
  tour_package_id?: string;
  visit_date: string;
  pickup_time: string;
  duration_minutes?: string;
  destination_count?: string;
  participants?: string;
}

export interface BookingAvailability {
  available: boolean;
  capacity: number;
  booked: number;
  remaining: number;
  maxParticipantsPerBooking?: number;
  participantCapacity?: number;
  start: string;
  end: string;
}

export interface UpdateBookingTravelBody {
  group_name?: string;
  visit_date?: string;
  pickup_time?: string;
  participants?: number;
  pickup_location?: string;
  pickup_maps_url?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  private_destination_ids?: number[];
  contact_phone?: string;
  notes?: string;
}

export interface BookingAssignmentBody {
  assigned_tour_guide_id?: number | null;
  assigned_driver_id?: number | null;
  sakoci_id?: number | null;
  vehicle_name?: string | null;
  vehicle_plate_number?: string | null;
}

export interface BookingPaymentBody {
  payment_status?: 'unpaid' | 'waiting_verification' | 'paid' | 'rejected' | 'expired' | 'refunded';
  payment_method?: string | null;
  paid_amount?: number | null;
  payment_proof_url?: string | null;
  admin_payment_proof_url?: string | null;
  payment_notes?: string | null;
}

export interface RentalOption {
  id: number;
  name: string;
  description?: string;
  base_price: number;
  price_per_person: number;
  active: boolean;
  created_at: string;
}

export interface CreateRentalOptionBody {
  name: string;
  description?: string;
  base_price?: number;
  price_per_person?: number;
  active?: boolean;
}

export type SakociStatus = 'available' | 'assigned' | 'maintenance' | 'inactive';
export type SakociTrackingVisibility = 'public' | 'user' | 'admin' | 'hidden';

export interface Sakoci {
  id: number;
  name: string;
  code?: string | null;
  plate_number?: string | null;
  image_url?: string | null;
  status: SakociStatus;
  active: boolean;
  tracking_enabled: boolean;
  tracking_visibility: SakociTrackingVisibility;
  latitude?: number | null;
  longitude?: number | null;
  location_updated_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface SakociBody {
  name: string;
  code?: string | null;
  plate_number?: string | null;
  image_url?: string | null;
  status?: SakociStatus;
  active?: boolean;
  tracking_enabled?: boolean;
  tracking_visibility?: SakociTrackingVisibility;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  revenue: number;
  monthly: Array<{ month: string; count: string; visitors: string }>;
}

export interface HeritageSummary {
  total: number;
  aktif: number;
  byCategory: Array<{ category: string; count: string }>;
  byKecamatan: Array<{ kecamatan: string; count: string }>;
}

export interface GeoPoint {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface OptimalRouteResult {
  orderedDestinations: GeoPoint[];
  totalDistance: number;
  totalDuration: number;
  segments: Array<{
    from: GeoPoint;
    to: GeoPoint;
    distance: number;
    duration: number;
    geometry: any;
  }>;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  nik?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  domicile?: string | null;
  ktp_address?: string | null;
  active?: boolean;
  account_status?: AccountStatus;
  registered_at?: string;
  last_login?: string | null;
  role?: { name: string };
}

export interface OptimizeRouteV2Body {
  pickup?: {
    latitude: number;
    longitude: number;
  };
  destinationIds: number[];
  fixedEndId?: number;
}

export interface RouteSnapshot {
  status: 'pending' | 'success' | 'failed';
  routeStatus?: 'pending' | 'final' | 'stale' | 'failed';
  orderedDestinationIds: number[];
  totalDistanceKm: number;
  totalDurationMinutes?: number | null;
  segments: any[];
  geojson?: any;
  routeSource?: string | null;
  routingBuildId?: string | null;
  finalizedAt?: string | null;
  staleReason?: string | null;
  errorMessage?: string | null;
}

export interface TripRoutePlayback {
  tripId: number;
  bookingId: number;
  routeStatus?: 'pending' | 'final' | 'stale' | 'failed' | string | null;
  totalDistanceKm: number;
  totalDurationMinutes?: number | null;
  orderedDestinationIds: number[];
  geometry?: any;
  nodeIds: number[];
  edgeIds: number[];
  graph?: PlaybackGraph | null;
}

export interface AdminDashboardSummary {
  period: '7d' | '30d' | 'month';
  cards: {
    bookingsToday: number;
    pendingPayments: number;
    readyAssignment: number;
    activeTrips: number;
    completedToday: number;
    openIncidents: number;
  };
  queues: {
    pendingPayments: AdminDashboardQueueItem[];
    readyAssignment: AdminDashboardQueueItem[];
    upcomingDepartures: AdminDashboardQueueItem[];
    activeIncidents: AdminDashboardQueueItem[];
  };
  charts: {
    bookingTrend: Array<{ date: string; count: number }>;
    statusDistribution: Array<{ status: string; count: number }>;
    popularPackages: Array<{ name: string; count: number }>;
  };
  alerts: Array<{ type: string; count: number; href: string }>;
}

export interface AdminDashboardQueueItem {
  id: number;
  code?: string;
  group_name?: string;
  issue_type?: string;
  status?: string;
  href: string;
  [key: string]: unknown;
}

export interface OptimizeRouteV2Result {
  orderedDestinationIds?: number[];
  orderedDestinations: Array<{
    id: number;
    name: string;
    category?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }>;
  totalDistanceKm: number;
  totalHaversineDistanceKm?: number | null;
  totalDurationMinutes?: number;
  segments: Array<{
    from: { id: number | string; name: string; latitude: number; longitude: number };
    to: { id: number | string; name: string; latitude: number; longitude: number };
    distanceKm: number;
    haversineDistanceKm?: number;
    durationMinutes?: number;
    path_geojson?: any;
    pathGeojson?: any;
    geojson?: any;
  }>;
  geojson: any;
  routeGeojson?: any;
  warnings?: string[];
}

export interface GraphRebuildSummary {
  message: string;
  heritageSites: number;
  roadNodes: number;
  roadEdges: number;
  destinationNodes: number;
  destinationDistances: number;
  unreachablePairs: number;
  calculationMethod: string;
}

export interface GraphDestinationMatrix {
  destinations: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
  }>;
  matrix: Array<Array<number | null>>;
}

export interface PlaybackGraph {
  nodes: PlaybackGraphNode[];
  edges: PlaybackGraphEdge[];
}

export interface PlaybackGraphRadius extends PlaybackGraph {
  enabled: boolean;
  radiusMeters: number;
}

export interface PlaybackGraphNode {
  id: number;
  latitude: number;
  longitude: number;
  type?: string | null;
  name?: string | null;
}

export interface PlaybackGraphEdge {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  distanceKm: number;
  roadName?: string | null;
  oneway: boolean;
  geometry?: any;
}

export interface DestinationDistance {
  id: number;
  from_heritage_site_id: number;
  to_heritage_site_id: number;
  distance_km: number;
  duration_minutes?: number | null;
  path_node_ids: number[];
  path_geojson?: any;
  calculation_method?: string | null;
  created_at: string;
  updated_at: string;
  from_heritage_site?: HeritageSite;
  to_heritage_site?: HeritageSite;
}

export interface PaginatedRoadResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface RoadNode {
  id: number;
  code: string;
  latitude: number;
  longitude: number;
  type?: string | null;
  name?: string | null;
}

export interface RoadEdge {
  id: number;
  code: string;
  from_node_id: number;
  to_node_id: number;
  distance_km: number;
  road_name?: string | null;
  oneway: boolean;
  vehicle_accessible: boolean;
  from_node?: RoadNode;
  to_node?: RoadNode;
}

export type AccountStatus = 'normal' | 'suspended' | 'review' | 'deleted';

export interface Role {
  id: number;
  name: string;
}

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  nik?: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  domicile?: string | null;
  ktp_address?: string | null;
  role_id?: number | null;
  active: boolean;
  account_status: AccountStatus;
  registered_at: string;
  last_login?: string | null;
  role?: Role | null;
}

export interface CreateManagedUserBody {
  name: string;
  email: string;
  password: string;
  nik: string;
  birth_place: string;
  birth_date: string;
  domicile: string;
  ktp_address: string;
  role_id?: number;
  account_status?: AccountStatus;
}

export interface ProfileBody {
  name: string;
  nik: string;
  birth_place: string;
  birth_date: string;
  domicile: string;
  ktp_address: string;
  avatar_url?: string;
}

export type TripStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE_TO_PICKUP'
  | 'AT_PICKUP'
  | 'EN_ROUTE_TO_DESTINATION'
  | 'AT_DESTINATION'
  | 'EN_ROUTE_TO_ENDPOINT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ISSUE_REPORTED';

export type TripStopStatus = 'PENDING' | 'EN_ROUTE' | 'ARRIVED' | 'VISITING' | 'COMPLETED' | 'SKIPPED';

export interface TripItineraryItem {
  id: number;
  trip_id: number;
  sequence: number;
  stop_type: 'PICKUP' | 'DESTINATION' | 'ENDPOINT';
  heritage_site_id?: number | null;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  planned_duration_minutes?: number | null;
  estimated_arrival_at?: string | null;
  stop_status: TripStopStatus;
  en_route_at?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  skipped_at?: string | null;
  skip_reason?: string | null;
  guide_content_snapshot?: HeritageSite | null;
  heritage_site?: HeritageSite | null;
}

export type GuideSessionStatus = 'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface TripGuideSession {
  id: number;
  trip_id: number;
  itinerary_item_id: number;
  tour_guide_id: number;
  session_status: GuideSessionStatus;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
}

export interface TripStatusHistory {
  id: number;
  previous_status?: string | null;
  new_status: string;
  action: string;
  changed_at: string;
  notes?: string | null;
}

export interface TripIncident {
  id: number;
  trip_id: number;
  driver_id?: number | null;
  reported_by_user_id?: number | null;
  reporter_role?: 'driver' | 'tour_guide' | string | null;
  issue_type: string;
  description: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  reported_at: string;
  resolved_at?: string | null;
  resolution_note?: string | null;
}

export interface DriverTrip {
  id: number;
  booking_id: number;
  driver_id: number;
  tour_guide_id?: number | null;
  sakoci_id: number;
  assigned_by_admin_id: number;
  booking_reference: string;
  scheduled_user_pickup_at: string;
  driver_ready_at: string;
  driver_lead_time_minutes: number;
  estimated_duration_minutes: number;
  estimated_end_at: string;
  trip_status: TripStatus;
  current_itinerary_item_id?: number | null;
  current_stop_sequence?: number | null;
  tracking_active: boolean;
  tracking_started_at?: string | null;
  tracking_ended_at?: string | null;
  assigned_at?: string | null;
  accepted_at?: string | null;
  journey_started_at?: string | null;
  completed_at?: string | null;
  cancellation_reason?: string | null;
  route_snapshot?: {
    route_status?: 'pending' | 'final' | 'stale' | 'failed' | null;
    routing_build_id?: string | null;
    finalized_at?: string | null;
    total_distance_km?: number | null;
    total_duration_minutes?: number | null;
    geojson?: any;
    segments?: any[];
  } | null;
  booking: Booking;
  driver: AuthUser;
  tour_guide?: AuthUser | null;
  sakoci: Sakoci;
  itinerary_items: TripItineraryItem[];
  guide_sessions?: TripGuideSession[];
  status_history: TripStatusHistory[];
  incidents: TripIncident[];
  created_at: string;
  updated_at: string;
}

export interface TripAssignmentBody {
  driver_id: number;
  tour_guide_id?: number | null;
  sakoci_id: number;
  scheduled_user_pickup_at?: string;
  driver_ready_at?: string;
  driver_lead_time_minutes?: number;
  estimated_duration_minutes: number;
  destination_ids?: number[];
  endpoint?: {
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  } | null;
}

export interface TripActionBody {
  action:
    | 'ACCEPT_TASK'
    | 'START_TO_PICKUP'
    | 'CONFIRM_ARRIVAL_PICKUP'
    | 'START_TOUR'
    | 'CONFIRM_ARRIVAL_STOP'
    | 'START_NEXT_STOP'
    | 'SKIP_STOP'
    | 'COMPLETE_TRIP';
  itineraryItemId?: number;
  nextItineraryItemId?: number;
  latitude?: number;
  longitude?: number;
  reason?: string;
}

export interface TripLocationBody {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed_kmh?: number | null;
  heading?: number | null;
}

export interface TripLocationUpdate {
  tripId: number;
  bookingId: number;
  sakociId: number;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export interface TripIncidentBody {
  issue_type: string;
  description: string;
  latitude?: number;
  longitude?: number;
}

export interface DriverDashboard {
  driver: AuthUser;
  primary_trip?: DriverTrip | null;
  summary: {
    today: number;
    active: number;
    upcoming: number;
    completed: number;
  };
}

export type GuideActionBody =
  | { action: 'START_GUIDE_SESSION'; itineraryItemId: number }
  | { action: 'COMPLETE_GUIDE_SESSION'; itineraryItemId: number; notes?: string }
  | { action: 'SAVE_GUIDE_NOTE'; itineraryItemId: number; notes?: string };

export interface GuideDashboard {
  guide: AuthUser;
  primary_trip?: DriverTrip | null;
  summary: {
    today: number;
    active: number;
    upcoming: number;
    completed: number;
  };
}

export interface GuideDestinationsResponse {
  task_destinations: Array<TripItineraryItem & {
    booking_reference?: string;
    scheduled_user_pickup_at?: string;
    guide_session?: TripGuideSession | null;
  }>;
  all_destinations: HeritageSite[];
}

export interface SystemSettings {
  appName: string;
  agencyName: string;
  operationalHotline: string;
  customerSupportContact: string;
  operationalHours: string;
  paymentTimeoutHours: number;
  driverReadyOffsetMinutes: number;
  defaultCapacityLimit: number;
  trackingEnabled: boolean;
  publicTrackingEnabled: boolean;
  showPublicCurrentRoute: boolean;
  showSakociGraphRadius: boolean;
  pickupMaxSnapMeters: number;
}

export interface PublicSakoci extends Sakoci {
  activeTripId?: number | null;
  showPublicCurrentRoute?: boolean;
  showSakociGraphRadius?: boolean;
}

export interface OperationalAlert {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | string;
  timestamp: string;
  summary: string;
  href: string;
}

export interface AuditLogItem {
  id: number;
  actor_user_id?: number | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  booking_code?: string | null;
  scope: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface OperationalReport {
  filter: { start: string; end: string; status?: string | null; booking_type?: string | null };
  summary: {
    bookingTotal: number;
    paymentStatus: Record<string, number>;
    bookingStatus: Record<string, number>;
    completed: number;
    cancelled: number;
    activeTrips: number;
    completedTrips: number;
    incidentTotal: number;
  };
  sakociUsage: Record<string, number>;
  driverPerformance: Array<{ name: string; total: number; completed: number }>;
  guidePerformance: Array<{ name: string; total: number; completed: number }>;
  popularServices: Array<{ name: string; count: number; participants: number }>;
  incidentsByType: Record<string, number>;
  rows: Array<Record<string, any>>;
}

export interface BookingReceipt {
  issuer: {
    appName: string;
    agencyName: string;
    support: string;
    hotline: string;
    hours: string;
  };
  booking: {
    id: number;
    code: string;
    customer: string;
    bookingType: string;
    serviceName: string;
    visitDate?: string | null;
    pickupTime?: string | null;
    pickupLocation?: string | null;
    participants: number;
    status: string;
    paymentStatus: string;
    amount: number;
    paidAmount?: number | null;
    createdAt: string;
    notes?: string | null;
  };
  assignment?: {
    sakoci?: { name: string; code?: string | null; plateNumber?: string | null } | null;
    driver?: { name: string } | null;
    guide?: { name: string } | null;
  } | null;
  route?: {
    totalDistanceKm: number;
    totalDurationMinutes?: number | null;
    orderedDestinationIds: number[];
  } | null;
}

// GeoJSON minimal types
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: string; coordinates: number[] };
    properties: Record<string, any>;
  }>;
}
