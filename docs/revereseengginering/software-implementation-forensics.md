# Software Implementation Forensics Document

Proyek: Cimahi Heritage / Cimitage  
Snapshot: source code lokal pada repository `cimahiheritage`  
Basis analisis: backend NestJS, frontend Next.js, dummy Sakoci tracker, konfigurasi, migration, seed, entity, controller, service, guard, gateway, helper, dan script yang ditemukan di snapshot source code.

Dokumen ini hanya mendeskripsikan implementasi yang terlihat pada snapshot source code. Apabila implementasi tidak ditemukan pada snapshot, bagian terkait ditulis secara eksplisit sebagai tidak ditemukan.

---

## 1. Project Inventory

Repository berisi tiga aplikasi utama:

| Area | Lokasi | Runtime | Peran implementasi |
|---|---|---|---|
| Backend API | `backend/` | NestJS 11, TypeScript, TypeORM, PostgreSQL | REST API, autentikasi JWT, RBAC, booking, pembayaran, assignment driver/guide, routing, graph, audit, settings, WebSocket monitoring, upload file |
| Frontend | `frontend/` | Next.js 14 App Router, React 18, NextAuth, Leaflet | Antarmuka publik, customer booking, admin dashboard, manajemen data, monitoring realtime, driver app, guide app, PWA |
| Dummy tracker | `dummy-sakoci-tracker/` | Express, Axios | Simulator GPS Sakoci yang mengirim posisi ke backend |
| Root scripts | `package.json` root | npm | Wrapper build/seed backend dan frontend |

Artifact data dan aset yang ditemukan:

| Jenis | Lokasi | Isi |
|---|---|---|
| Upload backend | `backend/uploads/` | gambar beranda, logo, media heritage, PDF |
| Static frontend | `frontend/public/` | icon PWA, fallback heritage SVG, image landing, service worker, offline page |
| Seed graph | `backend/src/database/seeds/road-graph.seed.json` | node dan edge dummy road graph |
| Migration TypeORM | `backend/src/database/migrations/` | perubahan schema booking, trip operation, routing matrix, PostGIS, audit/settings, route finalization/playback |
| Test/spec | `backend/src/**/*.spec.ts`, `backend/test/` | unit/security/e2e coverage untuk auth/security, booking status, routing, operations, upload |

---

## 2. Repository Tree

```text
cimahiheritage/
  package.json
  package-lock.json
  README.md
  DEPLOYMENT_RENDER_VERCEL.md
  setup.sh
  backend/
    package.json
    nest-cli.json
    tsconfig.json
    .env.example
    src/
      main.ts
      app.module.ts
      app.controller.ts
      app.service.ts
      common/
        config/
        entities/
        enums/
        security/
        upload/
      database/
        database.config.ts
        data-source.ts
        migrations/
        seed.ts
        seeds/
      modules/
        admin-users/
        auth/
        booking/
        driver-trip/
        graph/
        heritage/
        operations/
        package-route/
        rental-option/
        routing/
        routing-engine/
        sakoci/
        tour-package/
        user/
      scripts/
    uploads/
    test/
  frontend/
    package.json
    next.config.js
    middleware.ts
    app/
      api/auth/[...nextauth]/route.ts
      admin/
      booking/
      driver/
      guide/
      heritage/
      login/
      my-orders/
      offline/
      paket/
      peta/
      profile/
      tentang/
    components/
      admin/
      booking/
      driver/
      guide/
      heritage/
      home/
      layout/
      maps/
      providers/
      pwa/
      ui/
    lib/
      api.ts
      backend-readiness.ts
      rbac.ts
      runtime-config.ts
    public/
    types/
  dummy-sakoci-tracker/
    package.json
    src/index.js
```

---

## 3. Dependency Analysis

### 3.1 Root Dependency

Root `package.json` menyediakan script wrapper:

| Script | Perintah |
|---|---|
| `seed` | `npm --prefix backend run seed` |
| `backend:seed` | `npm --prefix backend run seed` |
| `backend:build` | `npm --prefix backend run build` |
| `frontend:build` | `npm --prefix frontend run build` |

Dependency root yang terlihat: `@nestjs/mapped-types`, `axios`, `bcryptjs`, `class-transformer`, `class-validator`. Dev dependency root: `autoprefixer`, `postcss`, `tailwindcss`, dan type bcryptjs.

### 3.2 Backend Dependency

Backend menggunakan:

| Library | Penggunaan implementasi |
|---|---|
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` | struktur module, controller, provider, pipe, guard, upload interceptor |
| `@nestjs/config` | konfigurasi global dan JWT secret melalui `ConfigModule` |
| `@nestjs/typeorm`, `typeorm`, `pg` | repository, entity, migration, transaction, PostgreSQL |
| `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | JWT signing dan validasi akses |
| `@nestjs/throttler` | global throttling guard pada security module |
| `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` | gateway realtime booking dan trip |
| `bcrypt`, `bcryptjs` | hashing password dan validasi login |
| `class-validator`, `class-transformer` | validasi DTO melalui `ValidationPipe` |
| `axios` | OSRM HTTP route fallback |
| `dotenv` | script seed dan data source |

Script backend:

| Script | Fungsi |
|---|---|
| `build` | build NestJS |
| `start:dev` | menjalankan Nest watch |
| `prestart:prod` | menjalankan migration sebelum production start |
| `migration:run` | TypeORM migration dari `dist/database/data-source.js` |
| `seed` | seed lokal via `src/database/seed.ts` |
| `seed:uat` | seed UAT dengan flag `--uat` |
| `routing:import-geojson` | import road graph GeoJSON |
| `routing:rebuild-matrix` | rebuild matrix routing |
| `schema:tour-guide` | apply schema tour guide |

### 3.3 Frontend Dependency

Frontend menggunakan:

| Library | Penggunaan implementasi |
|---|---|
| `next` | App Router, route handler NextAuth, manifest |
| `react`, `react-dom` | UI state dan rendering |
| `next-auth` | session frontend dan credentials login backend |
| `leaflet` | peta heritage, route preview, pickup picker, route map |
| `socket.io-client` | realtime monitoring admin booking dan monitoring trip |
| `tailwindcss`, `@tailwindcss/postcss` | styling |

Script frontend: `dev`, `build`, `start`.

### 3.4 Dummy Sakoci Tracker Dependency

Dummy tracker menggunakan Express sebagai server lokal, Axios untuk memanggil backend, CORS, dan dotenv. Environment yang dibaca: `PORT`, `BACKEND_API_URL`, `DEFAULT_SPEED_KMH`, `UPDATE_INTERVAL_MS`.

---

## 4. Architecture Analysis

Arsitektur implementasi berbentuk monorepo dengan frontend dan backend terpisah.

```text
Browser / PWA
  |
  | Next.js App Router
  | NextAuth credentials login
  | frontend/lib/api.ts
  v
NestJS Backend /api
  |
  | Controller
  v
Service
  |
  | TypeORM Repository / DataSource transaction
  v
PostgreSQL + PostGIS-related SQL columns

Realtime:
Browser socket.io-client
  -> BookingGateway namespace booking-monitoring
  -> DriverTripGateway namespace trip-monitoring

Routing:
BookingService / RoutingController / PetaClient
  -> RoutingService
  -> RoutingGraphCacheService
  -> DestinationDistanceRepository / RoadNode / RoadEdge
  -> solveTsp
  -> RoutingGeoJsonService
  -> RouteOptimizationResult

Dummy GPS:
dummy-sakoci-tracker
  -> backend /api driver-trip location endpoints
```

Global backend behavior:

| File | Implementasi |
|---|---|
| `backend/src/main.ts` | enable CORS, global validation pipe whitelist/transform, global prefix `api`, listen port `process.env.PORT ?? 3001` |
| `backend/src/app.module.ts` | konfigurasi module root, TypeORM async config, import module domain |
| `backend/src/common/security/security.module.ts` | JWT module, throttler, global guards |
| `backend/src/database/database.config.ts` | `DATABASE_URL` wajib; Postgres/SSL/migration/entity config |

Tidak ditemukan implementasi GraphQL. Tidak ditemukan scheduler/cron. Tidak ditemukan cache eksternal seperti Redis. Cache yang ditemukan adalah cache in-memory graph pada `RoutingGraphCacheService`.

---

## 5. Configuration Analysis

### 5.1 Backend Environment

`backend/.env.example` memuat:

| Variable | Default/example | Implementasi |
|---|---|---|
| `PORT` | `3001` | port backend |
| `DATABASE_URL` | kosong | wajib pada database config |
| `JWT_SECRET` | kosong | wajib pada security module |

Variable lain yang dibaca source code:

| Variable | File | Implementasi |
|---|---|---|
| `NODE_ENV` | `cors-origins.ts`, `seed.ts` | membedakan production dan lokal |
| `FRONTEND_URL` | `cors-origins.ts` | whitelist origin frontend |
| `ALLOW_PRODUCTION_SEED` | `seed.ts` | flag eksplisit untuk `seed:uat` |
| `UAT_SEED_PASSWORD` | `seed.ts` | password akun seed UAT |
| `ROUTING_PICKUP_MAX_SNAP_METERS` | `settings.service.ts`, `routing.service.ts` | batas snap pickup ke graph |

### 5.2 Frontend Environment

Frontend membaca:

| Variable | File | Implementasi |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `frontend/lib/runtime-config.ts` | base URL API backend |
| `NEXTAUTH_SECRET` | `frontend/middleware.ts`, NextAuth route | secret session/JWT NextAuth |

### 5.3 Dummy Tracker Environment

| Variable | Default | Implementasi |
|---|---|---|
| `PORT` | `3010` | port dummy tracker |
| `BACKEND_API_URL` | `http://localhost:3001/api` | target backend API |
| `DEFAULT_SPEED_KMH` | `25` | kecepatan simulasi |
| `UPDATE_INTERVAL_MS` | `1000` | interval update lokasi |

---

## 6. Backend Module Inventory

| Module | Controller/Gateway | Service | Entity utama | Fungsi |
|---|---|---|---|---|
| `auth` | `AuthController` | `AuthService` | `User`, `Role` | login, register, profile, avatar |
| `admin-users` | `AdminUsersController` | `AdminUsersService` | `User`, `Role` | manajemen user dan role oleh super admin |
| `heritage` | `HeritageController` | `HeritageService` | `HeritageSite`, `PackageRoute` | CRUD situs heritage, upload media, stats, geojson |
| `tour-package` | `TourPackageController` | `TourPackageService` | `TourPackage`, `PackageRoute`, `HeritageSite` | CRUD paket, reorder route, aktif/nonaktif |
| `package-route` | `PackageRouteController` | `PackageRouteService` | `PackageRoute`, `TourPackage`, `HeritageSite` | CRUD rute paket |
| `rental-option` | `RentalOptionController` | `RentalOptionService` | `RentalOption` | CRUD opsi sewa |
| `booking` | `BookingController`, `AdminDashboardController`, `BookingGateway` | `BookingService`, `booking-status.service` | `Booking`, `RouteOptimizationResult`, `DriverTrip`, `TripIncident` | booking, pembayaran, finalisasi rute, dashboard admin, websocket booking |
| `driver-trip` | `DriverTripController`, `DriverTripGateway` | `DriverTripService` | `DriverTrip`, `TripItineraryItem`, `TripStatusHistory`, `TripLocationLog`, `TripIncident`, `TripGuideSession` | assignment, lifecycle driver/guide, GPS, incident, monitoring |
| `routing` | `RoutingController`, `LegacyRoutingController` | `RoutingService`, `OsrmService`, `DestinationDistanceGeometryRepository` | `DestinationDistance`, `DestinationNode`, `RoutingBuild`, `HeritageSite` | route optimization v2, legacy route endpoint, OSRM fallback |
| `routing-engine` | tidak ada controller langsung | `RoutingGraphCacheService`, `RoutingMatrixBuilderService`, `RoutingGeoJsonService`, `GraphValidatorService` | `RoadNode`, `RoadEdge`, `DestinationNode`, `DestinationDistance`, `RoutingBuild` | graph cache, Dijkstra, matrix build, geojson merge |
| `graph` | `GraphController` | `GraphService` | `RoadNode`, `RoadEdge`, `DestinationDistance`, `RoutingBuild` | rebuild graph, matrix, playback graph, routing status |
| `operations` | `OperationsController` | `OperationsService`, `AuditService`, `SettingsService` | `AuditLog`, `SystemSetting`, `Booking`, `DriverTrip`, `TripIncident` | settings, audit, notifications, reports, receipt |
| `sakoci` | `SakociController` | `SakociService` | `Sakoci`, `DriverTrip` | CRUD Sakoci, public tracking list, update location |
| `user` | tidak ditemukan controller | `UsersService` | `User` | service user pendukung |

---

## 7. Security, Authentication, Authorization

### 7.1 Authentication Flow

```text
Frontend login page
  -> NextAuth credentials provider
  -> POST backend /api/auth/login
  -> AuthService.validateUser(email,password)
  -> bcrypt compare password
  -> account active/status validation
  -> AuthService.login()
  -> JWT payload { sub, email, role }
  -> Frontend stores accessToken in session/localStorage
  -> frontend/lib/api.ts adds Authorization: Bearer <token>
  -> JwtAuthGuard validates token on protected backend route
```

Backend `AuthService` behavior:

| Method | Implementasi |
|---|---|
| `validateUser` | mencari user by email dengan password selected, validasi password bcrypt, menolak akun inactive atau status selain `normal` |
| `login` | sign JWT dengan `sub`, `email`, dan role name; update `last_login`; return access token dan safe user |
| `register` | membuat user customer tanpa role eksplisit pada implementasi auth service |
| `me` | mengambil user aktif beserta role |
| `updateProfile` | update profil identitas user |
| `updateAvatar` | update avatar URL |

### 7.2 Authorization Flow

Backend menggunakan decorator `@Roles(...)`, `@Public()`, `JwtAuthGuard`, dan `RolesGuard`.

```text
Request masuk
  -> Public metadata checked
  -> JwtAuthGuard validates bearer token unless route public
  -> RolesGuard reads @Roles metadata
  -> role user dibandingkan dengan allowed roles
  -> controller method dipanggil
```

Role enum:

| Role | Nilai |
|---|---|
| `SUPER_ADMIN` | `super_admin` |
| `ADMIN_OPERASIONAL` | `admin_operasional` |
| `TOUR_GUIDE` | `tour_guide` |
| `DRIVER` | `driver` |
| `CUSTOMER` | `customer` |

Kontrol khusus ownership:

| Komponen | Implementasi |
|---|---|
| `BookingOwnershipGuard` | memastikan customer hanya mengakses booking miliknya untuk upload/baca bukti pembayaran |
| `BookingGateway` | socket join booking room memvalidasi token dan akses booking |
| `DriverTripGateway` | socket join trip room memvalidasi token dan akses trip sebagai admin, driver terkait, atau guide terkait |
| `DriverTripService.auth` | beberapa endpoint driver/guide/admin membaca header Authorization dan memverifikasi JWT langsung memakai `JwtService` |

Tidak ditemukan implementasi permission granular berbasis tabel permission. Otorisasi yang ditemukan berbasis role dan ownership.

---

## 8. Database Analysis

### 8.1 Entity Catalog

| Entity | Table | Primary fields | Relasi |
|---|---|---|---|
| `User` | `user` | `id`, `name`, `email`, `password`, `active`, `account_status`, identitas KTP, `avatar_url`, `registered_at`, `last_login`, `role_id` | many-to-one `Role` |
| `Role` | `role` | `id`, `name` unique | one-to-many `User` |
| `HeritageSite` | `heritage_site` | `id`, `name`, `category`, `description`, `address`, `kelurahan`, `kecamatan`, `latitude`, `longitude`, `geom`, `no_register`, `sk_penetapan`, `status`, `tahun_register`, `image_url`, `images`, `youtube_links`, `pdf_files` | one-to-many `PackageRoute` |
| `TourPackage` | `tour_package` | `id`, `code` unique, `name`, `description`, `price_per_person`, `active`, `image_url`, `duration_hours` | one-to-many `PackageRoute`, one-to-many `Booking` |
| `PackageRoute` | `package_route` | `id`, `tour_package_id`, `heritage_site_id`, `sequence`, `notes` | many-to-one `TourPackage`, many-to-one `HeritageSite` |
| `RentalOption` | `rental_option` | `id`, `name`, `description`, `base_price`, `price_per_person`, `active` | referenced by `Booking` |
| `Booking` | `booking` | customer/travel/payment/assignment/pickup fields, `status`, `payment_status`, `total_price` | many-to-one `TourPackage`, `RentalOption`, `User`, guide `User`, driver `User`, `Sakoci` |
| `Sakoci` | `sakoci` | `id`, `name`, `code`, `plate_number`, `status`, `active`, `tracking_enabled`, `tracking_visibility`, `latitude`, `longitude`, `location_updated_at`, `notes` | one-to-many `Booking` |
| `DriverTrip` | `driver_trip` | assignment, schedule, trip status, tracking, current itinerary, route snapshot | many-to-one `Booking`, `User` driver, `User` guide, admin `User`, `Sakoci`; one-to-many trip child entities |
| `TripItineraryItem` | `trip_itinerary_item` | `trip_id`, `sequence`, `stop_type`, `heritage_site_id`, stop status/timestamps, content snapshot | many-to-one `DriverTrip`, `HeritageSite`; one-to-many `TripGuideSession` |
| `TripStatusHistory` | `trip_status_history` | `trip_id`, `previous_status`, `new_status`, `action`, `changed_by_user_id`, location, notes | many-to-one `DriverTrip`, itinerary item, `User` |
| `TripLocationLog` | `trip_location_log` | `trip_id`, `sakoci_id`, driver/current status, coordinate, accuracy/speed/heading | many-to-one `DriverTrip`, itinerary item |
| `TripIncident` | `trip_incident` | `trip_id`, reporter fields, `issue_type`, `description`, `status`, coordinate, resolution | many-to-one `DriverTrip`, `User` driver, reported-by `User` |
| `TripGuideSession` | `trip_guide_session` | `trip_id`, `itinerary_item_id`, `tour_guide_id`, `session_status`, timestamps, notes | many-to-one `DriverTrip`, itinerary item, `User` |
| `RoadNode` | `road_node` | `id`, `code` unique, coordinate, type, name, geom | one-to-many outgoing/incoming `RoadEdge`, destination nodes |
| `RoadEdge` | `road_edge` | `id`, `code` unique, from/to node, `distance_km`, road metadata, access flags, geometry | many-to-one `RoadNode` from/to |
| `DestinationNode` | `destination_node` | mapping heritage site to road node per routing build | many-to-one `HeritageSite`, `RoadNode` |
| `DestinationDistance` | `destination_distance` | from/to heritage site, distance, duration, path nodes/edges/geojson, method, build id | many-to-one `HeritageSite` from/to |
| `RoutingBuild` | `routing_build` | uuid id, status, active flag, timestamps, counts, error | no relation decorator found |
| `RouteOptimizationResult` | `route_optimization_result` | booking route status, algorithm, ordered ids, distance/duration, route geojson, node/edge ids, fingerprint, metadata | many-to-one `Booking` |
| `SystemSetting` | `system_setting` | `key`, `value`, `updated_by_user_id` | no relation decorator found |
| `AuditLog` | `audit_log` | actor, action, entity, booking code, scope, metadata | no relation decorator found |

### 8.2 State Machine

Booking status:

```text
pending
  -> confirmed        when payment becomes paid
  -> cancelled        when expired/refunded or cancellation accepted

confirmed
  -> assigned         when trip assignment is created
  -> cancelled        when admin/customer cancellation allowed

assigned
  -> in_progress      when trip status enters movement/arrival/issue states
  -> cancelled        admin cancellation path

in_progress
  -> completed        when trip completed

cancelled terminal
completed terminal
```

Payment status:

```text
unpaid
  -> waiting_verification    customer/admin uploads proof or admin sets payment pending
  -> paid                    admin verifies payment
  -> rejected                admin rejects proof
  -> expired/refunded        supported by status sync helper

waiting_verification
  -> paid
  -> rejected

paid
  -> confirmed booking status
```

Driver trip status:

```text
ASSIGNED
  -> ACCEPTED
  -> CANCELLED

ACCEPTED
  -> EN_ROUTE_TO_PICKUP

EN_ROUTE_TO_PICKUP
  -> AT_PICKUP

AT_PICKUP
  -> EN_ROUTE_TO_DESTINATION

EN_ROUTE_TO_DESTINATION
  -> AT_DESTINATION

AT_DESTINATION
  -> EN_ROUTE_TO_DESTINATION
  -> EN_ROUTE_TO_ENDPOINT
  -> COMPLETED

EN_ROUTE_TO_ENDPOINT
  -> COMPLETED

Any active movement/status
  -> ISSUE_REPORTED
  -> previous next status after issue handling by actions

COMPLETED terminal
CANCELLED terminal
```

Sakoci status:

```text
available
  -> assigned
  -> maintenance
  -> inactive

assigned
  -> available after release if active and not maintenance
```

Route snapshot status:

```text
pending
  -> final
  -> failed

final
  -> stale when route-affecting data changes
```

Trip itinerary item status:

```text
PENDING
  -> EN_ROUTE
  -> ARRIVED
  -> VISITING
  -> COMPLETED
  -> SKIPPED
```

Trip incident status:

```text
OPEN
  -> RESOLVED
```

Source code defines `IN_REVIEW` usage in operations query, but transition method to `IN_REVIEW` was not found in the analyzed service flow.

---

## 9. API Catalog

Global prefix backend: `/api`.

### 9.1 App

| Method | Path | Access | Handler | Output |
|---|---|---|---|---|
| GET | `/` | public | `AppController.getHello` | app service hello |
| GET | `/health` | public | `AppController.getHealth` | health payload |

### 9.2 Auth

| Method | Path | Access | Handler | Service |
|---|---|---|---|---|
| POST | `/auth/login` | public | `AuthController.login` | `AuthService.validateUser`, `login` |
| POST | `/auth/register` | public | `AuthController.register` | `AuthService.register` |
| GET | `/auth/me` | authenticated | `AuthController.me` | `AuthService.me` |
| PUT | `/auth/profile` | authenticated | `AuthController.updateProfile` | `AuthService.updateProfile` |
| POST | `/auth/profile/avatar` | authenticated upload | `AuthController.uploadAvatar` | `AuthService.updateAvatar` |

### 9.3 Heritage

| Method | Path | Access | Handler | Service |
|---|---|---|---|---|
| GET | `/heritage` | public | `findAll` | list with filters/pagination |
| GET | `/heritage/geojson` | public | `getGeoJson` | GeoJSON heritage |
| GET | `/heritage/stats/summary` | public | `getSummary` | summary count |
| GET | `/heritage/stats/category` | public | `getStatsByCategory` | group by category |
| GET | `/heritage/stats/kecamatan` | public | `getStatsByKecamatan` | group by kecamatan |
| GET | `/heritage/:id` | public | `findOne` | detail |
| POST | `/heritage` | admin operasional, super admin | `create` | create |
| POST | `/heritage/upload` | admin operasional, super admin | `upload` | upload asset |
| PUT | `/heritage/:id` | admin operasional, super admin | `update` | update |
| DELETE | `/heritage/:id` | admin operasional, super admin | `remove` | delete |

### 9.4 Tour Package

| Method | Path | Access | Handler |
|---|---|---|---|
| GET | `/tour-packages` | public | list package |
| GET | `/tour-packages/:id` | public | detail package |
| POST | `/tour-packages` | admin operasional, super admin | create |
| PUT | `/tour-packages/:id` | admin operasional, super admin | update |
| DELETE | `/tour-packages/:id` | admin operasional, super admin | delete |
| PUT | `/tour-packages/:id/toggle-active` | admin operasional, super admin | toggle active |
| PUT | `/tour-packages/:id/reorder` | admin operasional, super admin | reorder route |

### 9.5 Package Route

| Method | Path | Access | Handler |
|---|---|---|---|
| GET | `/package-routes` | public | list route, optional package filter |
| GET | `/package-routes/:id` | public | detail |
| POST | `/package-routes` | admin operasional, super admin | create |
| PUT | `/package-routes/:id` | admin operasional, super admin | update |
| DELETE | `/package-routes/:id` | admin operasional, super admin | delete |
| PUT | `/package-routes/by-package/:tourPackageId/reorder` | admin operasional, super admin | bulk reorder |
| DELETE | `/package-routes/by-package/:tourPackageId` | admin operasional, super admin | remove all by package |

### 9.6 Booking

| Method | Path | Access | Handler | Service flow |
|---|---|---|---|---|
| GET | `/bookings` | admin operasional, super admin | list | `findAll` |
| GET | `/bookings/stats` | admin operasional, super admin | stats | `getStats` |
| GET | `/bookings/availability` | public | availability | `checkAvailability` |
| GET | `/bookings/staff` | admin operasional, super admin | staff list | booking staff query |
| GET | `/bookings/me` | customer | my bookings | `findMyBookings` |
| GET | `/bookings/:id/route` | customer/admin | route snapshot | `getRouteOptimization` |
| GET | `/bookings/:id/payment/proof/:kind` | owner/customer/admin | payment proof blob | file response |
| GET | `/bookings/:id` | customer/admin | detail | `findOneForUser` |
| POST | `/bookings` | public | create booking | `createInternal` creates user when needed |
| POST | `/bookings/me` | customer | create as logged-in customer | `createForAuthenticatedCustomer` |
| PUT | `/bookings/:id/status` | admin | status update | transition validation |
| PUT | `/bookings/:id/assignment` | admin | legacy assignment fields | booking assignment update |
| PUT | `/bookings/:id/payment` | admin | payment update | payment state update |
| PUT | `/bookings/:id/travel` | customer | edit travel | validates status/payment and availability |
| POST | `/bookings/:id/payment/verify` | admin | verify payment | payment to paid |
| POST | `/bookings/:id/payment/reject` | admin | reject proof | payment to rejected |
| POST | `/bookings/:id/cancel` | customer/admin | cancel | `canCancelBooking` |
| POST | `/bookings/:id/finalize-route` | admin | finalize route | `RoutingService.optimizeV2`, save snapshot |
| POST | `/bookings/:id/reoptimize-route` | admin | reoptimize route | mark stale and re-run routing |
| PUT | `/bookings/:id/location` | admin | update vehicle location | update booking/Sakoci coordinate |
| POST | `/bookings/:id/payment/upload` | customer/admin owner | upload proof | upload file, payment waiting verification |

### 9.7 Driver Trip and Assignment

| Method | Path | Access | Handler |
|---|---|---|---|
| GET | `/admin/bookings/:bookingId/assignment` | admin | get assignment |
| POST | `/admin/bookings/:bookingId/assignment` | admin | create assignment |
| PATCH | `/admin/bookings/:bookingId/assignment` | admin | update assignment |
| POST | `/admin/bookings/:bookingId/assignment/cancel` | admin | cancel assignment |
| GET | `/admin/bookings/:bookingId/trip-monitoring` | admin | monitoring by booking |
| GET | `/admin/trips/active` | admin | active trips |
| GET | `/admin/trips/:tripId/incidents` | admin | incidents |
| GET | `/trips/:tripId/route` | customer/admin/driver/guide roles in code | route playback |
| PATCH | `/admin/trips/:tripId/incidents/:incidentId/resolve` | admin | resolve incident |
| GET | `/driver/dashboard` | driver | driver dashboard |
| GET | `/driver/tasks` | driver | tasks by status |
| GET | `/driver/tasks/:tripId` | driver | task detail |
| POST | `/driver/tasks/:tripId/actions` | driver | trip lifecycle action |
| POST | `/driver/tasks/:tripId/location` | driver | GPS update |
| POST | `/driver/tasks/:tripId/incidents` | driver | report incident |
| GET | `/driver/destinations` | driver | destinations from tasks |
| GET | `/driver/destinations/:heritageSiteId` | driver | destination material |
| GET | `/driver/history` | driver | history |
| GET | `/guide/dashboard` | tour guide | dashboard |
| GET | `/guide/tasks` | tour guide | tasks |
| GET | `/guide/tasks/:tripId` | tour guide | task detail |
| POST | `/guide/tasks/:tripId/actions` | tour guide | guide session actions |
| POST | `/guide/tasks/:tripId/incidents` | tour guide | report incident |
| GET | `/guide/destinations` | tour guide | guide destinations |
| GET | `/guide/destinations/:heritageSiteId` | tour guide | destination material |
| GET | `/guide/history` | tour guide | history |

### 9.8 Routing and Graph

| Method | Path | Access | Handler | Implementasi |
|---|---|---|---|---|
| GET | `/routing/simple` | super admin | simple | legacy/simple routing |
| POST | `/routing/optimize` | super admin | optimize | legacy optimize |
| POST | `/routing/optimize-v2` | public | optimize v2 public | sanitized v2 route |
| POST | `/routing/distance-matrix` | super admin | distance matrix | legacy matrix |
| POST | `/routing/dijkstra` | super admin | dijkstra | legacy Dijkstra |
| POST | `/routing/legacy/simple` | super admin | legacy simple | legacy controller |
| POST | `/routing/legacy/optimize` | super admin | legacy optimize | legacy controller |
| POST | `/routing/legacy/distance-matrix` | super admin | legacy matrix | legacy controller |
| POST | `/routing/legacy/dijkstra` | super admin | legacy dijkstra | legacy controller |
| POST | `/graph/rebuild` | super admin | rebuild | `RoutingMatrixBuilderService.rebuildActiveMatrix` |
| GET | `/graph/destination-matrix` | super admin | matrix | destination matrix |
| GET | `/graph/destination-distances` | super admin | distances | distance rows |
| GET | `/graph/road-nodes` | super admin | nodes | paginated nodes |
| GET | `/graph/road-edges` | super admin | edges | paginated edges |
| GET | `/graph/playback` | admin/driver/guide roles | playback | nodes/edges by ids |
| GET | `/graph/routing-status` | super admin | status | active build/cache summary |
| GET | `/graph/nearest-node/:heritageId` | super admin | nearest | nearest road node |

### 9.9 Operations

| Method | Path | Access | Handler |
|---|---|---|---|
| GET | `/admin/settings` | admin operasional, super admin | read settings |
| POST | `/admin/settings` | super admin | update settings |
| GET | `/admin/notifications` | admin operasional, super admin | alerts |
| GET | `/admin/audit` | admin operasional, super admin | audit logs |
| GET | `/admin/reports/operational` | admin operasional, super admin | report |
| GET | `/admin/reports/operational.csv` | admin operasional, super admin | CSV export |
| GET | `/bookings/:id/receipt` | customer/admin | receipt |

### 9.10 Sakoci, Rental Option, Admin Users

| Area | Endpoint summary |
|---|---|
| Sakoci | `GET /sakoci`, `GET /sakoci/public`, `GET /sakoci/:id`, `POST /sakoci`, `PUT /sakoci/:id`, `PUT /sakoci/:id/location`, `DELETE /sakoci/:id` |
| Rental option | `GET /rental-options`, `POST /rental-options`, `PUT /rental-options/:id`, `DELETE /rental-options/:id` |
| Admin users | `GET /admin/users`, `GET /admin/users/roles`, `POST /admin/users`, `GET /admin/users/:id`, `PUT /admin/users/:id/status`, `PUT /admin/users/:id/role`, `DELETE /admin/users/:id` |

---

## 10. Endpoint Traceability Matrix

| Feature | Frontend | API client | Endpoint | Controller | Service | Repository/entity |
|---|---|---|---|---|---|---|
| Login | `app/login/page.tsx`, NextAuth route | backend fetch in NextAuth | `POST /auth/login` | `AuthController` | `AuthService` | `User`, `Role` |
| Profile | `app/profile/page.tsx` | `api.auth.me`, `updateProfile`, `uploadAvatar` | `/auth/me`, `/auth/profile`, `/auth/profile/avatar` | `AuthController` | `AuthService` | `User` |
| Public heritage list | `app/heritage/page.tsx`, home sections | `api.heritage.list` | `GET /heritage` | `HeritageController` | `HeritageService` | `HeritageSite` |
| Heritage detail | `app/heritage/[id]/page.tsx` | `api.heritage.one` | `GET /heritage/:id` | `HeritageController` | `HeritageService` | `HeritageSite` |
| Public map | `app/peta/PetaClient.tsx` | `api.heritage.list`, `api.sakoci.publicList`, `api.routing.optimizeV2` | `/heritage`, `/sakoci/public`, `/routing/optimize-v2` | Heritage/Sakoci/Routing controllers | related services | `HeritageSite`, `Sakoci`, routing tables |
| Package list/detail | `app/paket/page.tsx`, `app/paket/[id]/page.tsx` | `api.packages.*` | `/tour-packages` | `TourPackageController` | `TourPackageService` | `TourPackage`, `PackageRoute`, `HeritageSite` |
| Booking creation | `app/booking/page.tsx` | `api.bookings.create`, `createMine`, `availability` | `/bookings`, `/bookings/me`, `/bookings/availability` | `BookingController` | `BookingService` | `Booking`, `User`, `TourPackage`, `RentalOption`, `HeritageSite` |
| Booking detail/customer order | `app/booking/[id]/page.tsx`, `profile`, `my-orders` | `api.bookings.one`, `route` | `/bookings/:id`, `/bookings/:id/route` | `BookingController` | `BookingService` | `Booking`, `RouteOptimizationResult` |
| Payment proof | booking/admin detail pages | `uploadPaymentProof`, `openPaymentProof` | `/bookings/:id/payment/upload`, `/bookings/:id/payment/proof/:kind` | `BookingController` | `BookingService` | `Booking`, filesystem uploads |
| Admin dashboard | `app/admin/page.tsx` | `api.adminDashboard.summary`, `api.operations.notifications` | `/admin/dashboard/summary`, `/admin/notifications` | `AdminDashboardController`, `OperationsController` | `BookingService`, `OperationsService` | `Booking`, `DriverTrip`, `TripIncident` |
| Admin booking management | `app/admin/booking/page.tsx`, `[id]/page.tsx` | `api.bookings.*`, `api.tripAssignments.*` | booking and assignment endpoints | `BookingController`, `DriverTripController` | `BookingService`, `DriverTripService` | Booking/trip entities |
| Route finalization | admin booking detail | `api.bookings.finalizeRoute`, `reoptimizeRoute` | `/bookings/:id/finalize-route`, `/reoptimize-route` | `BookingController` | `BookingService`, `RoutingService` | `RouteOptimizationResult`, routing tables |
| Driver tasks | `app/driver/**` | `api.driver.*` | `/driver/*` | `DriverTripController` | `DriverTripService` | `DriverTrip`, itinerary/history/location/incidents |
| Guide tasks | `app/guide/**` | `api.guide.*` | `/guide/*` | `DriverTripController` | `DriverTripService` | `DriverTrip`, `TripGuideSession`, `HeritageSite` |
| Admin monitoring | `app/admin/monitoring/page.tsx` | `api.sakoci.*`, `api.tripAssignments.active`, Socket.IO | `/sakoci`, `/admin/trips/active`, `trip-monitoring` | `SakociController`, `DriverTripController`, gateway | `SakociService`, `DriverTripService` | `Sakoci`, `DriverTrip` |
| Graph admin | `app/admin/graph/page.tsx` | `api.graph.*` | `/graph/*` | `GraphController` | `GraphService`, matrix builder | graph/routing entities |
| Operations settings/audit/reports | `app/admin/settings`, `audit`, `reports`, `notifications` | `api.operations.*` | `/admin/settings`, `/admin/audit`, `/admin/reports/*` | `OperationsController` | `SettingsService`, `AuditService`, `OperationsService` | `SystemSetting`, `AuditLog`, operational entities |
| Admin users/RBAC | `app/admin/users/page.tsx`, `rbac/page.tsx` | `api.users.*` | `/admin/users/*` | `AdminUsersController` | `AdminUsersService` | `User`, `Role` |

---

## 11. Business Flow Diagrams

### 11.1 Booking Flow

```text
Customer opens /booking
  -> frontend loads packages, rental options, heritage sites
  -> customer selects booking type
  -> frontend calls /bookings/availability
  -> BookingService resolves date/time/duration
  -> BookingService counts active slot usage against Sakoci capacity
  -> customer submits
  -> public booking creates new User when not authenticated
  -> authenticated customer uses existing User
  -> Booking saved with status pending and payment_status unpaid
  -> frontend redirects to /booking/{id}
```

### 11.2 Payment Flow

```text
Customer/admin uploads proof
  -> BookingOwnershipGuard verifies access
  -> upload-options validates MIME/size and writes file
  -> BookingService asserts booking payable
  -> Booking.payment_status = waiting_verification
  -> Admin verifies or rejects
  -> verify: payment_status = paid, status = confirmed
  -> reject: payment_status = rejected, status = pending
  -> audit record created for operational action
```

### 11.3 Route Finalization Flow

```text
Admin opens booking detail
  -> frontend requests booking and route snapshot
  -> admin calls finalize route
  -> BookingService validates payment_status = paid
  -> BookingService resolves destination ids
  -> BookingService validates pickup coordinate
  -> RoutingService.optimizeV2
      -> active RoutingBuild required
      -> DestinationNode mapping required
      -> DestinationDistance matrix required
      -> pickup snaps to nearest road node when pickup exists
      -> RoutingGraphCacheService.dijkstra builds pickup distances
      -> solveTsp returns best order
      -> RoutingGeoJsonService merges segment geometry
  -> BookingService stores RouteOptimizationResult
  -> PostGIS route_geometry is updated from GeoJSON when possible
```

### 11.4 Assignment Flow

```text
Admin creates assignment
  -> DriverTripService.requireAdmin verifies JWT role
  -> ensure booking exists
  -> assertBookingAssignable requires paid and non-terminal status
  -> validate driver, optional guide, sakoci
  -> calculate scheduled pickup, driver ready time, estimated end
  -> build itinerary snapshot from finalized route/package/private destination
  -> transaction begins
      -> lock booking
      -> lock existing trip when update
      -> ensure route finalized when route is required
      -> lock Sakoci and staff users
      -> ensure no overlapping active schedule
      -> create/update DriverTrip
      -> recreate TripItineraryItem and TripGuideSession when needed
      -> update Booking assignment fields and status
      -> update Sakoci status assigned
      -> insert TripStatusHistory
  -> emit trip update through DriverTripGateway
  -> audit record created
```

### 11.5 Driver Trip Flow

```text
Driver dashboard
  -> GET /driver/dashboard
  -> DriverTripService filters trips owned by JWT user
Driver accepts task
  -> POST /driver/tasks/{id}/actions ACCEPT_TASK
  -> trip ASSIGNED -> ACCEPTED
Driver starts pickup
  -> START_TO_PICKUP
  -> pickup itinerary item EN_ROUTE
  -> tracking_active true
Driver reports location
  -> POST /driver/tasks/{id}/location
  -> TripLocationLog inserted
  -> Sakoci and Booking vehicle coordinate updated
  -> websocket trip-location emitted
Driver proceeds through stop actions
  -> statuses move through pickup, destination, endpoint
Completion
  -> trip COMPLETED
  -> booking completed
  -> Sakoci released when eligible
```

### 11.6 Tour Guide Flow

```text
Guide dashboard/tasks
  -> GET /guide/dashboard and /guide/tasks
Guide opens task
  -> Guide receives itinerary and destination content snapshot
Guide starts/completes destination session
  -> POST /guide/tasks/{tripId}/actions
  -> TripGuideSession session_status updated
Driver cannot complete destination when guide session is required and not completed/skipped
Guide may report incident
  -> TripIncident inserted with reporter_role tour_guide
```

---

## 12. Algorithm Pipeline

### 12.1 Routing optimizeV2

```text
Input pickup + destinationIds + optional fixedEndId
  -> normalize destination ids
  -> validate 2..8 unique active heritage sites
  -> read active RoutingBuild
  -> read DestinationNode mapping for build
  -> reject unroutable destinations
  -> read DestinationDistance rows
  -> build distance matrix
  -> if pickup provided:
       RoutingGraphCacheService.ensureLoaded()
       getNearestNode(pickup, maxSnapM)
       map destinations to road node codes
       dijkstra(nearest pickup node -> destination nodes)
       add pickup row to matrix
  -> solveTsp(startId, destinationIds, fixedEndId, matrix)
  -> build segment list:
       pickup segment from graph cache edge steps
       destination pair segment from DestinationDistance path geometry
  -> merge GeoJSON collections
  -> return algorithm HELD_KARP_TSP_WITH_DIJKSTRA_MATRIX
```

### 12.2 Dijkstra Graph Cache

`RoutingGraphCacheService` implements:

| Method | Behavior |
|---|---|
| `ensureLoaded` | loads cache when not loaded |
| `reload` | reads active build, road nodes/edges, builds adjacency and spatial grid |
| `getNearestNode` | searches nearest graph node within max snap distance |
| `dijkstra` | computes shortest paths from source node code to target node codes |
| `reconstructEdgeSteps` | rebuilds edge steps from previous map |
| `reconstructNodeIds` | rebuilds node ids |
| `edgeStepsToGeoJson` | converts path steps to GeoJSON |
| `edgeStepsToEdgeIds` | extracts edge ids |

### 12.3 TSP Solver

`backend/src/modules/routing/algorithms/tsp.algorithm.ts` implements Held-Karp TSP strategy for route order. Test `tsp.algorithm.spec.ts` verifies it chooses best total route and not only nearest-first destination.

Legacy routing methods `buildDistanceMatrix`, `dijkstra`, and `computeOptimalRoute` remain in `RoutingService` and are marked deprecated in comments. These legacy methods use Haversine/OSRM logic and are exposed only through super admin legacy endpoints.

---

## 13. Realtime Flow

### 13.1 BookingGateway

Namespace: `booking-monitoring`.

Events:

| Event | Direction | Behavior |
|---|---|---|
| `join-booking` | client -> server | validates token and ownership/admin access, joins room `booking:{id}` |
| `driver-location` | client -> server | throws forbidden; source instructs using validated driver tracking endpoint |
| `vehicle-location` | server -> room | emitted when booking vehicle location changes |

### 13.2 DriverTripGateway

Namespace: `trip-monitoring`.

Events:

| Event | Direction | Behavior |
|---|---|---|
| `join-trip` | client -> server | validates handshake JWT and trip access; joins `trip:{id}` |
| `trip-updated` | server -> room/admin | emits after assignment/action/incident changes |
| `trip-location` | server -> room/admin | emits after driver location update |

Frontend consumers:

| Page | Socket namespace | Events |
|---|---|---|
| `frontend/app/admin/booking/[id]/page.tsx` | `booking-monitoring`, `trip-monitoring` | `vehicle-location`, `trip-updated`, `trip-location` |
| `frontend/app/admin/monitoring/page.tsx` | `trip-monitoring` | `trip-updated`, `trip-location` |

---

## 14. Upload Flow

`backend/src/common/upload/upload-options.ts` defines upload handling:

| Mechanism | Implementasi |
|---|---|
| File size | `MAX_UPLOAD_SIZE = 5 * 1024 * 1024` |
| File count | single file |
| Filename | server-side UUID filename based on trusted MIME extension |
| Folder | destination folder by domain such as `heritage` or `profile` |
| Security | SVG and script-capable image MIME rejected according to upload tests |

Upload endpoints:

| Endpoint | Use |
|---|---|
| `POST /heritage/upload` | upload heritage image/PDF media from admin |
| `POST /auth/profile/avatar` | upload profile avatar |
| `POST /bookings/:id/payment/upload` | upload customer/admin payment proof |

---

## 15. Frontend Analysis

### 15.1 Frontend Routing

| Route | Page file | Function |
|---|---|---|
| `/` | `app/page.tsx` | homepage sections |
| `/tentang` | `app/tentang/page.tsx` | about page |
| `/heritage` | `app/heritage/page.tsx` | heritage listing |
| `/heritage/[id]` | `app/heritage/[id]/page.tsx` | heritage detail |
| `/paket` | `app/paket/page.tsx` | package listing |
| `/paket/[id]` | `app/paket/[id]/page.tsx` | package detail |
| `/peta` | `app/peta/page.tsx`, `PetaClient.tsx` | map, public route preview, public Sakoci |
| `/booking` | `app/booking/page.tsx` | booking form |
| `/booking/[id]` | `app/booking/[id]/page.tsx` | booking confirmation/detail |
| `/booking/[id]/edit` | `app/booking/[id]/edit/page.tsx` | customer edit travel |
| `/booking/[id]/receipt` | `app/booking/[id]/receipt/page.tsx` | receipt |
| `/my-orders` | `app/my-orders/page.tsx` | customer orders |
| `/profile` | `app/profile/page.tsx` | profile and bookings |
| `/login` | `app/login/page.tsx` | login/register UI |
| `/admin` | `app/admin/page.tsx` | dashboard |
| `/admin/booking` | `app/admin/booking/page.tsx` | booking management |
| `/admin/booking/[id]` | `app/admin/booking/[id]/page.tsx` | booking detail, assignment, route, payment |
| `/admin/heritage` | `app/admin/heritage/page.tsx` | heritage management |
| `/admin/paket` | `app/admin/paket/page.tsx` | package management |
| `/admin/routes` | `app/admin/routes/page.tsx` | package route management |
| `/admin/sewa` | `app/admin/sewa/page.tsx` | rental option management |
| `/admin/users` | `app/admin/users/page.tsx` | user management |
| `/admin/graph` | `app/admin/graph/page.tsx` | graph/routing management |
| `/admin/monitoring` | `app/admin/monitoring/page.tsx` | active trip/Sakoci monitoring |
| `/admin/settings` | `app/admin/settings/page.tsx` | operations settings |
| `/admin/audit` | `app/admin/audit/page.tsx` | audit logs |
| `/admin/reports` | `app/admin/reports/page.tsx` | operational reports |
| `/admin/notifications` | `app/admin/notifications/page.tsx` | notifications |
| `/driver` | `app/driver/page.tsx` | driver home |
| `/driver/tasks` | `app/driver/tasks/page.tsx` | driver task list |
| `/driver/tasks/[tripId]` | `app/driver/tasks/[tripId]/page.tsx` | driver task detail/actions/location |
| `/driver/destinations` | `app/driver/destinations/page.tsx` | driver destination material |
| `/driver/history` | `app/driver/history/page.tsx` | driver history |
| `/driver/account` | `app/driver/account/page.tsx` | driver account |
| `/guide` | `app/guide/page.tsx` | guide home |
| `/guide/tasks` | `app/guide/tasks/page.tsx` | guide task list |
| `/guide/tasks/[tripId]` | `app/guide/tasks/[tripId]/page.tsx` | guide task detail/session |
| `/guide/destinations` | `app/guide/destinations/page.tsx` | guide destination list |
| `/guide/destinations/[heritageSiteId]` | `app/guide/destinations/[heritageSiteId]/page.tsx` | guide destination detail |
| `/guide/history` | `app/guide/history/page.tsx` | guide history |
| `/offline` | `app/offline/page.tsx` | PWA offline page |

### 15.2 Frontend API Client

`frontend/lib/api.ts` is the central API client. It:

| Function | Implementation |
|---|---|
| `getAccessToken` | reads `localStorage.token`, then `/api/auth/session`, then caches token |
| `req` | waits backend readiness, attaches JSON headers and bearer token, parses JSON, throws Error with backend code/status |
| file upload helpers | use `FormData` and omit JSON content type |
| blob helpers | open payment proof and download operational CSV using object URL |

### 15.3 Frontend Traceability Matrix

| Page | Component/API | Backend |
|---|---|---|
| Home | home components, popular sites/package/order shortcuts | `/heritage`, `/tour-packages`, `/bookings/me` through components |
| Heritage list/detail | `HeritageCard`, `HeritageGallery`, `HeritageDetail`, map components | `/heritage`, `/heritage/:id` |
| Peta | Leaflet map, route preview, playback graph | `/heritage`, `/sakoci/public`, `/routing/optimize-v2`, `/trips/:id/route`, `/graph/playback` |
| Booking form | `PickupMapPicker`, booking state | `/bookings/availability`, `/bookings`, `/bookings/me` |
| Admin booking detail | assignment/payment/route panels, sockets | booking endpoints, assignment endpoints, gateways |
| Driver task detail | GPS browser geolocation, actions, incidents | `/driver/tasks/:id/actions`, `/location`, `/incidents` |
| Guide task detail | guide session actions, incident report, material links | `/guide/tasks/:id/actions`, `/incidents`, destination endpoints |
| Admin graph | matrix/rebuild status | `/graph/rebuild`, matrix/distances |
| Admin operations | settings/audit/report/notification | `/admin/settings`, `/admin/audit`, `/admin/reports/*`, `/admin/notifications` |

---

## 16. Service Dependency Matrix

| Service | Dependencies |
|---|---|
| `BookingService` | Booking/TourPackage/User/RentalOption/HeritageSite/Sakoci/RouteOptimizationResult/DriverTrip/TripIncident repositories, `RoutingService`, `AuditService`, `DataSource` |
| `DriverTripService` | trip child repositories, Booking/User/Sakoci/HeritageSite/RouteOptimizationResult repositories, `JwtService`, `DataSource`, `DriverTripGateway`, `SettingsService`, `AuditService` |
| `RoutingService` | HeritageSite/DestinationNode/DestinationDistance/RoutingBuild repositories, `RoutingGraphCacheService`, `RoutingGeoJsonService`, `OsrmService`, `DestinationDistanceGeometryRepository`, `solveTsp` |
| `GraphService` | graph/routing repositories, `RoutingMatrixBuilderService`, `RoutingGraphCacheService` |
| `OperationsService` | Booking/DriverTrip/TripIncident repositories, `SettingsService` |
| `AuditService` | `AuditLog` repository |
| `SettingsService` | `SystemSetting` repository |
| `AuthService` | `User` repository, `JwtService` |
| `AdminUsersService` | `User`, `Role` repositories, `AuditService` |
| `SakociService` | `Sakoci`, `DriverTrip` repositories, `SettingsService` via operations module |
| `TourPackageService` | `TourPackage`, `PackageRoute`, `HeritageSite` repositories |
| `PackageRouteService` | `PackageRoute`, `TourPackage`, `HeritageSite` repositories |
| `HeritageService` | `HeritageSite`, `PackageRoute` repositories |

---

## 17. Call Graph

### 17.1 Booking Create

```text
BookingController.create
  -> BookingService.create
  -> BookingService.createInternal
  -> validate booking_type/group/participants/date/time/email/password
  -> package/rental/private branch validation
  -> BookingService.getSlotAvailability
  -> DataSource.transaction
     -> User save when guest
     -> Booking save
  -> Response Booking
```

### 17.2 Payment Verify

```text
BookingController.verifyPayment
  -> BookingService.verifyPayment
  -> assertPaymentVerifiable
  -> syncBookingStatusFromPayment('paid')
  -> save Booking
  -> AuditService.record
  -> Response Booking
```

### 17.3 Route Finalization

```text
BookingController.finalizeRoute
  -> BookingService.finalizeRoute
  -> BookingService.assertRouteFinalizable
  -> BookingService.getBookingDestinationIds
  -> BookingService.routeFingerprint
  -> RoutingService.optimizeV2
     -> RoutingGraphCacheService.ensureLoaded
     -> RoutingGraphCacheService.getNearestNode
     -> RoutingGraphCacheService.dijkstra
     -> solveTsp
     -> RoutingGeoJsonService.merge
  -> BookingService.saveRouteOptimizationSuccess
  -> BookingService.saveRouteOptimizationGeometry
  -> AuditService.record
  -> Response RouteSnapshot
```

### 17.4 Assignment

```text
DriverTripController.createAssignment
  -> DriverTripService.saveAssignment
  -> requireAdmin
  -> ensureBooking
  -> assertBookingAssignable
  -> ensureDriver / ensureTourGuide / ensureSakoci
  -> buildItinerarySnapshot
  -> DataSource.transaction
     -> lock Booking
     -> ensureRouteFinalizedForAssignment
     -> lockAssignmentResources
     -> ensureNoScheduleConflict
     -> save DriverTrip
     -> save TripItineraryItem[]
     -> save TripGuideSession[]
     -> update Booking
     -> update Sakoci
     -> save TripStatusHistory
  -> DriverTripGateway.emitTripUpdate
  -> AuditService.record
  -> Response DriverTrip detail
```

### 17.5 Driver Location

```text
DriverTripController.location
  -> DriverTripService.location
  -> requireDriver
  -> ownedTrip
  -> coordinate validation
  -> save TripLocationLog
  -> update Sakoci coordinate
  -> update Booking vehicle coordinate
  -> DriverTripGateway.emitLocationUpdate
  -> Response location payload
```

### 17.6 Graph Rebuild

```text
GraphController.rebuild
  -> GraphService.rebuild
  -> RoutingMatrixBuilderService.rebuildActiveMatrix
  -> RoadNode/RoadEdge/DestinationNode/DestinationDistance/RoutingBuild writes
  -> AuditService.record from controller
  -> Response rebuild summary
```

---

## 18. Data Lifecycle

### 18.1 Booking Data

```text
Created from frontend booking form
  -> stored in booking table
  -> payment proof upload updates payment fields
  -> admin verification updates payment_status and status
  -> route finalization creates/updates route_optimization_result
  -> assignment updates booking driver/guide/sakoci fields
  -> trip actions sync booking status
  -> receipt/report/dashboard read booking data
  -> cancellation/completion terminal state
```

### 18.2 Route Data

```text
Road graph seed/import
  -> road_node / road_edge
Graph rebuild
  -> routing_build ACTIVE
  -> destination_node mapping
  -> destination_distance matrix and path metadata
Booking route finalization
  -> route_optimization_result with ordered ids, distance, duration, segments, geojson, fingerprint
Assignment
  -> route snapshot copied into driver_trip.route_snapshot
Playback
  -> /trips/:id/route and /graph/playback expose route geometry/node/edge data
```

### 18.3 GPS/Tracking Data

```text
Driver browser or dummy tracker posts location
  -> DriverTripService validates driver/trip ownership
  -> trip_location_log inserted
  -> sakoci current coordinate updated
  -> booking vehicle coordinate updated
  -> trip-location event emitted
  -> admin monitoring and booking detail refresh
  -> public map reads /sakoci/public according to tracking visibility/settings
```

### 18.4 Audit Data

```text
Operational action
  -> AuditService.record receives actor/action/entity/metadata
  -> metadata sanitized
  -> audit_log row inserted
  -> /admin/audit lists logs
  -> admin operasional scope limited to operational logs
```

---

## 19. Implementation Traceability Matrix

| Feature | Frontend | Backend | Endpoint | Controller | Service | Entity | Migration/schema |
|---|---|---|---|---|---|---|---|
| Heritage CRUD | `admin/heritage` | `heritage` module | `/heritage*` | `HeritageController` | `HeritageService` | `HeritageSite` | base schema plus PostGIS migration |
| Package CRUD | `admin/paket` | `tour-package` module | `/tour-packages*` | `TourPackageController` | `TourPackageService` | `TourPackage`, `PackageRoute` | base schema |
| Package route order | `admin/routes` | `package-route` module | `/package-routes*` | `PackageRouteController` | `PackageRouteService` | `PackageRoute` | base schema |
| Booking | `booking`, `my-orders`, `profile` | `booking` module | `/bookings*` | `BookingController` | `BookingService` | `Booking` | booking operational migrations |
| Payment proof | booking/admin detail | upload + booking | `/bookings/:id/payment*` | `BookingController` | `BookingService` | `Booking` | payment columns in booking entity |
| Final route | admin booking detail, map | booking + routing | `/bookings/:id/finalize-route` | `BookingController` | `BookingService`, `RoutingService` | `RouteOptimizationResult` | route finalization/playback migrations |
| Assignment | admin booking detail | driver-trip | `/admin/bookings/:id/assignment` | `DriverTripController` | `DriverTripService` | `DriverTrip`, itinerary, guide session | driver/tour guide operation migrations |
| Driver task | driver app | driver-trip | `/driver/*` | `DriverTripController` | `DriverTripService` | trip entities | driver trip operations |
| Guide task | guide app | driver-trip | `/guide/*` | `DriverTripController` | `DriverTripService` | guide session, itinerary | tour guide operation migration |
| Realtime monitoring | admin pages | gateways | socket namespace | `BookingGateway`, `DriverTripGateway` | service emits | booking/trip/location entities | no separate websocket table |
| Graph rebuild | `admin/graph` | graph/routing-engine | `/graph/rebuild` | `GraphController` | `GraphService`, matrix builder | road/destination/routing entities | routing matrix/PostGIS migrations |
| Settings | `admin/settings` | operations | `/admin/settings` | `OperationsController` | `SettingsService` | `SystemSetting` | operations settings audit migration |
| Audit | `admin/audit` | operations | `/admin/audit` | `OperationsController` | `AuditService` | `AuditLog` | operations settings audit migration |
| Reports | `admin/reports` | operations | `/admin/reports/operational*` | `OperationsController` | `OperationsService` | booking/trip/incident | existing operational tables |
| Sakoci public/admin | peta/admin monitoring | sakoci | `/sakoci*` | `SakociController` | `SakociService` | `Sakoci`, `DriverTrip` | booking operational migrations |
| User management | admin/users | admin-users | `/admin/users*` | `AdminUsersController` | `AdminUsersService` | `User`, `Role` | base schema |

---

## 20. Repository Catalog

TypeORM repositories are injected by `@InjectRepository`. Custom SQL through `DataSource.query` is used for PostGIS geometry update and playback graph queries.

| Repository/entity | Used by | Query patterns |
|---|---|---|
| `Booking` | `BookingService`, `DriverTripService`, `OperationsService` | find/findOne/findAndCount/count, query builder aggregations, transaction update, status filters |
| `User` | `AuthService`, `BookingService`, `DriverTripService`, `AdminUsersService` | email lookup, role relation lookup, password select, active/status validation |
| `Role` | `AdminUsersService`, `User` relation | role list and ensure role |
| `HeritageSite` | heritage/package/routing/driver-trip | filter active/status, id list, relation route |
| `TourPackage` | booking/tour package/package route | package price/duration, active validation |
| `RentalOption` | booking/rental option | price and active validation |
| `PackageRoute` | package service and route management | order by sequence, delete/reorder |
| `Sakoci` | booking/driver-trip/sakoci | status availability, GPS update, assignment release |
| `RouteOptimizationResult` | booking/driver-trip/routing | upsert by booking, final/stale/pending/failed route state |
| `DriverTrip` | booking dashboard/driver-trip/sakoci/operations | active status filters, schedule conflict query, relation-heavy task detail |
| `TripItineraryItem` | driver-trip | save/delete per assignment, status updates |
| `TripStatusHistory` | driver-trip | append history |
| `TripLocationLog` | driver-trip | append GPS logs |
| `TripIncident` | booking dashboard/driver-trip/operations | open/resolve incident queries |
| `TripGuideSession` | driver-trip | create per destination, update session status |
| `RoadNode`, `RoadEdge` | graph/routing-engine | cache load, playback, seed/import |
| `DestinationNode`, `DestinationDistance` | routing/routing-engine | matrix and mapping lookup |
| `RoutingBuild` | routing/routing-engine/graph | active build lookup |
| `AuditLog` | audit service | insert/list with metadata sanitization |
| `SystemSetting` | settings service | key-value JSON settings |

Transactions and locks:

| Flow | Transaction/lock |
|---|---|
| Booking create | `DataSource.transaction` creates user and booking atomically |
| Assignment create/update | transaction with pessimistic write locks on booking, existing trip, Sakoci, and staff rows |
| Route optimization save geometry | raw SQL update with `ST_SetSRID(ST_GeomFromGeoJSON(...),4326)` |

---

## 21. Configuration Catalog

Application settings stored in `SystemSetting` with defaults in `SettingsService`:

| Setting | Default source behavior |
|---|---|
| `appName` | application name setting |
| `agencyName` | agency name |
| `operationalHotline` | operational hotline |
| `customerSupportContact` | customer support contact |
| `operationalHours` | operational hours |
| `paymentTimeoutHours` | numeric timeout |
| `driverReadyOffsetMinutes` | used by assignment schedule |
| `defaultCapacityLimit` | used for booking availability capacity |
| `trackingEnabled` | controls tracking behavior |
| `publicTrackingEnabled` | controls public Sakoci visibility |
| `showPublicCurrentRoute` | exposed to public Sakoci response |
| `pickupMaxSnapMeters` | default from `ROUTING_PICKUP_MAX_SNAP_METERS ?? 150` |

Validation in settings rejects secret-like keys and invalid loose boolean/hour values according to operations spec.

---

## 22. Seed and Deployment

### 22.1 Seed

`backend/src/database/seed.ts`:

| Seed area | Implementation |
|---|---|
| Production guard | `NODE_ENV=production` blocks normal seed |
| UAT seed | requires `ALLOW_PRODUCTION_SEED=true` and `UAT_SEED_PASSWORD` |
| Local password | `admin123` |
| Roles | `super_admin`, `admin_operasional`, `tour_guide`, `driver` |
| Dummy users | admin, operasional, guide, driver |
| Heritage | array `heritage75` inserted to `heritage_site` |
| Tour packages | `PKG-MILITER`, `PKG-RELIGI`, `PKG-FULLDAY` |
| Package routes | route rows by package and heritage names |
| Road graph | reads `seeds/road-graph.seed.json` and upserts `road_node`, `road_edge` |

### 22.2 Deployment

`DEPLOYMENT_RENDER_VERCEL.md` exists at root. Backend package defines Node engine `22.x` and `prestart:prod` runs TypeORM migrations before `node dist/main`. Frontend package defines Next production build/start scripts.

---

## 23. Security Mechanism

| Mechanism | Implementation |
|---|---|
| JWT required | global guard except `@Public()` |
| Role access | `@Roles(...)` metadata and `RolesGuard` |
| Ownership | booking ownership guard and socket room ownership checks |
| Password hashing | bcrypt/bcryptjs |
| Account status | login and driver/guide assignment reject inactive/non-normal accounts |
| Upload hardening | 5 MB limit, single file, UUID filename, MIME whitelist/rejection |
| CORS | origin whitelist from environment/config helper |
| Throttling | `ThrottlerModule` and throttler guard in security module |
| CSV injection hardening | `OperationsService.csvCell` escapes risky prefixes according to spec |
| Audit metadata sanitization | `AuditService.sanitize` removes sensitive keys according to operations tests |

Tidak ditemukan implementasi encryption-at-rest khusus di source code. Tidak ditemukan implementation CSRF token kustom; frontend menggunakan bearer token/session mechanism.

---

## 24. Performance Mechanism

| Area | Mechanism |
|---|---|
| Routing graph | in-memory `RoutingGraphCacheService` loads active graph and adjacency |
| Nearest node | spatial grid keying in graph cache |
| Routing matrix | `DestinationDistance` precomputed matrix from rebuild |
| Pagination | list endpoints include page/limit on booking, heritage, admin users, audit, graph nodes/edges |
| Promise parallelism | frontend pages and backend dashboard use `Promise.all` in several flows |
| Query builder aggregation | dashboard stats and reports aggregate via database queries |

Tidak ditemukan Redis, CDN cache configuration, server-side job queue, or background worker process in snapshot.

---

## 25. Library Usage Catalog

| Library | Used in | Purpose |
|---|---|---|
| NestJS | backend modules/controllers/services | HTTP API and DI |
| TypeORM | backend entities/services/migrations | ORM, repositories, transactions, migration |
| PostgreSQL/pg | backend database | relational persistence |
| PostGIS SQL functions | route geometry updates/playback | spatial geometry from GeoJSON |
| Socket.IO | gateways/frontend | realtime booking/trip updates |
| Next.js | frontend app | routing/rendering/route handler |
| NextAuth | frontend auth | credentials auth and session |
| Leaflet | frontend maps | map, markers, route preview |
| bcrypt/bcryptjs | auth/seed/booking | password hashing |
| class-validator | DTOs/global validation | request validation |
| axios | OSRM/dummy tracker | HTTP client |
| Tailwind CSS | frontend styling | UI styles |

---

## 26. Class Catalog

| Class | Location | Dependencies | Public methods found |
|---|---|---|---|
| `AppController` | `backend/src/app.controller.ts` | `AppService` | `getHello`, `getHealth` |
| `AuthController` | `modules/auth/auth.controller.ts` | `AuthService` | `login`, `register`, `me`, `updateProfile`, `uploadAvatar` |
| `AuthService` | `modules/auth/auth.service.ts` | `User` repo, `JwtService` | `validateUser`, `login`, `register`, `me`, `updateProfile`, `updateAvatar` |
| `BookingController` | `modules/booking/booking.controller.ts` | `BookingService` | list/detail/create/payment/status/route/upload handlers |
| `BookingService` | `modules/booking/booking.service.ts` | many repositories, `RoutingService`, `AuditService`, `DataSource` | `findAll`, `findOne`, `findMyBookings`, `create`, `createForAuthenticatedCustomer`, `checkAvailability`, `updateMyTravelDetails`, payment/status/route/stat methods |
| `AdminDashboardController` | `modules/booking/admin-dashboard.controller.ts` | `BookingService` | `summary` |
| `BookingGateway` | `modules/booking/booking.gateway.ts` | JWT/booking dependencies | `handleConnection`, `joinBooking`, `emitVehicleLocation` |
| `DriverTripController` | `modules/driver-trip/driver-trip.controller.ts` | `DriverTripService` | admin assignment, driver, guide, trip route, incident handlers |
| `DriverTripService` | `modules/driver-trip/driver-trip.service.ts` | trip repositories, booking/user/sakoci/route repos, JWT, gateway, settings, audit | assignment, action, location, incident, dashboard/task/history/destination methods |
| `DriverTripGateway` | `modules/driver-trip/driver-trip.gateway.ts` | JWT/user/trip repos | `handleConnection`, `joinTrip`, `emitTripUpdate`, `emitLocationUpdate` |
| `RoutingController` | `modules/routing/routing.controller.ts` | `RoutingService` | `simple`, `optimize`, `optimizeV2`, `distanceMatrix`, `dijkstra` |
| `RoutingService` | `modules/routing/routing.service.ts` | routing repos/services | `optimizeV2`, `optimizeV2Public`, legacy route methods |
| `RoutingGraphCacheService` | `modules/routing-engine/routing-graph-cache.service.ts` | graph repositories | graph cache, dijkstra, reconstruction methods |
| `RoutingMatrixBuilderService` | `modules/routing-engine/routing-matrix-builder.service.ts` | graph/routing repositories | `rebuildActiveMatrix`, `getActiveBuild` |
| `GraphController` | `modules/graph/graph.controller.ts` | `GraphService`, `AuditService` | graph admin endpoints |
| `GraphService` | `modules/graph/graph.service.ts` | routing matrix builder/cache and repos | matrix/status/playback methods |
| `OperationsController` | `modules/operations/operations.controller.ts` | operations/settings/audit services | settings, notifications, audit, report, csv, receipt |
| `OperationsService` | `modules/operations/services/operations.service.ts` | booking/trip/incident repos, settings | `alerts`, `report`, `csv`, `receipt` |
| `SettingsService` | `modules/operations/services/settings.service.ts` | `SystemSetting` repo | `getSettings`, `updateSettings`, `getDriverReadyOffsetMinutes` |
| `AuditService` | `modules/operations/services/audit.service.ts` | `AuditLog` repo | `record`, `list`, `sanitize` |
| `HeritageController`/`Service` | `modules/heritage` | heritage/package route repos | CRUD, stats, geojson |
| `TourPackageController`/`Service` | `modules/tour-package` | tour package/package route/heritage repos | CRUD, toggle, reorder |
| `PackageRouteController`/`Service` | `modules/package-route` | package route/tour package/heritage repos | CRUD, bulk reorder/remove |
| `RentalOptionController`/`Service` | `modules/rental-option` | rental option repo | CRUD |
| `SakociController`/`Service` | `modules/sakoci` | sakoci/trip repos | CRUD, public list, location |
| `AdminUsersController`/`Service` | `modules/admin-users` | user/role repos, audit | user CRUD, roles, status/role update |

---

## 27. Method Catalog Summary

This section summarizes major methods. Controller methods are thin and delegate to services.

| Method | Input | Output | DB/query | Side effect |
|---|---|---|---|---|
| `BookingService.createInternal` | booking DTO, optional authenticated user | `Booking` | user/package/rental/availability lookup, transaction save | creates customer account for guest, booking row |
| `BookingService.updateMyTravelDetails` | booking id, user, travel DTO | customer booking | booking lookup and save | audit record, may mark route stale |
| `BookingService.finalizeRoute` | booking id, actor, endpoint/profile options | route snapshot | route optimization upsert | route geometry SQL update, audit |
| `BookingService.reoptimizeRoute` | booking id, reason | route snapshot | route row update/upsert | stale/final transition |
| `BookingService.getAdminDashboardSummary` | period | dashboard summary | counts, query builder aggregation | none |
| `DriverTripService.saveAssignment` | auth header, booking id, assignment input | `DriverTrip` detail | transaction, locks, conflict query | booking/sakoci updates, history, guide sessions, websocket, audit |
| `DriverTripService.action` | auth header, trip id, driver action | updated trip | trip/item/history updates | status lifecycle, booking sync, websocket |
| `DriverTripService.location` | auth header, trip id, coordinate payload | location payload | location insert, sakoci/booking update | websocket location |
| `DriverTripService.guideAction` | auth header, trip id, guide action | updated trip | guide session update | history/websocket where applicable |
| `RoutingService.optimizeV2` | pickup/destinations/fixed end | route result | routing build/mapping/distance queries | none until caller persists |
| `RoutingGraphCacheService.dijkstra` | source code, target codes | distance/previous maps | in-memory graph | none |
| `OperationsService.alerts` | limit | notification list | booking/trip/incident queries | none |
| `OperationsService.report` | filter | report | filtered booking/trip/incident queries | none |
| `AuditService.record` | audit input | saved audit log | insert | sanitizes metadata |
| `SettingsService.updateSettings` | actor, settings body | settings | upsert setting | rejects invalid/secret-like settings |

---

## 28. Frontend Component Catalog

| Folder | Components | Role |
|---|---|---|
| `components/ui` | Button, Card, Input, Modal, Badge, LoadingSkeleton, Section, BackendAssetImage | UI primitives |
| `components/layout` | Navbar, SiteHeader, Footer, SiteFooter, Container | site layout |
| `components/home` | Hero, sections, search, cards, shortcuts | homepage |
| `components/heritage` | HeritageCard, HeritageDetail, HeritageGallery | heritage display |
| `components/booking` | BookingForm, BookingStep, BookingSummary | booking UI |
| `components/maps` | RoutePreviewMap, RouteMap, PickupMapPicker, Heritage map components | Leaflet map views |
| `components/admin` | AdminSidebar, AdminRouteVisualization, PlaceholderPage | admin shell/tools |
| `components/driver` | DriverTripCard, DriverTripMap, DriverBottomNav, utils, page states | driver mobile UI |
| `components/guide` | GuideTripCard, GuideBottomNav, utils, page states | guide mobile UI |
| `components/providers` | AuthProvider, BackendReadinessProvider | auth/session and backend readiness state |
| `components/pwa` | install button/guide/service worker hook | PWA install/offline integration |

---

## 29. Cross Reference Matrix

| Implementation | Used by | Downstream effect |
|---|---|---|
| `solveTsp` | `RoutingService.optimizeV2` | ordered destination ids for route result |
| `RoutingGraphCacheService.dijkstra` | pickup-to-destination routing and matrix builder | pickup segment, destination matrix |
| `DestinationDistance` | `RoutingService`, `GraphService` | optimized routes and graph admin matrix |
| `RouteOptimizationResult` | booking route, assignment snapshot, trip playback | route finalization, driver trip route, public/admin playback |
| `TripLocationLog` | driver location update | monitoring/audit trail for GPS |
| `BookingStatusService` helpers | `BookingService`, `DriverTripService` | payment/status/trip sync and validation |
| `SettingsService.driverReadyOffsetMinutes` | assignment | default driver ready time |
| `AuditService` | booking/admin-users/graph/operations/assignment | operational audit logs |
| `Sakoci.tracking_visibility` | public map and booking tracking visibility | controls public/user/admin exposure |

---

## 30. Missing Implementations Explicitly Not Found

Snapshot source code tidak menunjukkan implementasi berikut:

| Area | Status |
|---|---|
| GraphQL API | Tidak ditemukan implementasi GraphQL |
| Scheduler/cron backend | Tidak ditemukan implementasi scheduler/cron |
| Redis/cache eksternal | Tidak ditemukan implementasi Redis atau cache eksternal |
| Message queue/job queue | Tidak ditemukan implementasi queue worker |
| Payment gateway eksternal | Tidak ditemukan integrasi payment gateway; pembayaran berbasis status dan bukti upload |
| Email/SMS notification provider | Tidak ditemukan provider email/SMS |
| Object storage eksternal | Tidak ditemukan S3/Cloudinary; upload memakai filesystem backend |
| Permission table granular | Tidak ditemukan permission matrix berbasis database selain role dan status account |
| Automated route rebuild scheduler | Tidak ditemukan scheduler; rebuild melalui endpoint/script |
| Frontend test suite | Tidak ditemukan test frontend dalam file yang dianalisis |

---

## 31. Document Control Notes

Dokumen ini adalah snapshot implementasi berdasarkan file yang ditemukan pada repository lokal. Untuk meningkatkan dokumen sampai target 300-700 halaman, bagian yang perlu diperluas dalam iterasi berikutnya adalah:

1. Ekstraksi field entity per file secara penuh dalam tabel detail.
2. Ekstraksi method catalog penuh untuk semua service/controller dengan input/output per signature.
3. Trace query per method berdasarkan semua body method tanpa pemadatan.
4. Penyalinan ringkas migration per migration file.
5. Diagram sequence terpisah per endpoint, bukan per fitur utama.
6. Frontend state dan form-field catalog per page.

Snapshot source code saat ini sudah menunjukkan implementasi utama sistem pada level backend, frontend, routing, realtime, upload, auth, authorization, database entity, data lifecycle, call graph, dan dependency graph sebagaimana dirangkum dalam dokumen ini.
