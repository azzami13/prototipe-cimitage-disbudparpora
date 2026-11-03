import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, In, Not, Repository } from 'typeorm';
import { Booking } from '../../common/entities/booking.entity';
import {
  DriverTrip,
  TripStatus,
} from '../../common/entities/driver-trip.entity';
import {
  TripItineraryItem,
  TripStopType,
} from '../../common/entities/trip-itinerary-item.entity';
import { TripStatusHistory } from '../../common/entities/trip-status-history.entity';
import { TripLocationLog } from '../../common/entities/trip-location-log.entity';
import {
  TripIncident,
  TripIncidentStatus,
} from '../../common/entities/trip-incident.entity';
import { TripGuideSession } from '../../common/entities/trip-guide-session.entity';
import { User } from '../../common/entities/user.entity';
import { Sakoci } from '../../common/entities/sakoci.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { RouteOptimizationResult } from '../../common/entities/route-optimization-result.entity';
import { DriverTripGateway } from './driver-trip.gateway';
import { AuditService } from '../operations/services/audit.service';
import { SettingsService } from '../operations/services/settings.service';
import {
  ACTIVE_TRIP_STATUSES,
  assertBookingAssignable,
  businessConflict,
  syncBookingStatusFromTrip,
} from '../booking/booking-status.service';

export interface AssignmentInput {
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

const ACTIVE_STATUSES: TripStatus[] = ACTIVE_TRIP_STATUSES;

@Injectable()
export class DriverTripService {
  constructor(
    @InjectRepository(DriverTrip)
    private readonly tripRepo: Repository<DriverTrip>,
    @InjectRepository(TripItineraryItem)
    private readonly itemRepo: Repository<TripItineraryItem>,
    @InjectRepository(TripStatusHistory)
    private readonly historyRepo: Repository<TripStatusHistory>,
    @InjectRepository(TripLocationLog)
    private readonly locationRepo: Repository<TripLocationLog>,
    @InjectRepository(TripIncident)
    private readonly incidentRepo: Repository<TripIncident>,
    @InjectRepository(TripGuideSession)
    private readonly guideSessionRepo: Repository<TripGuideSession>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Sakoci) private readonly sakociRepo: Repository<Sakoci>,
    @InjectRepository(HeritageSite)
    private readonly heritageRepo: Repository<HeritageSite>,
    @InjectRepository(RouteOptimizationResult)
    private readonly routeRepo: Repository<RouteOptimizationResult>,
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly gateway: DriverTripGateway,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  async getAdminAssignment(
    authorization: string | undefined,
    bookingId: number,
  ) {
    this.requireAdmin(authorization);
    await this.ensureBooking(bookingId);
    return this.findByBooking(bookingId);
  }

  async saveAssignment(
    authorization: string | undefined,
    bookingId: number,
    input: AssignmentInput,
    updating = false,
  ) {
    const admin = this.requireAdmin(authorization);
    const booking = await this.ensureBooking(bookingId);
    assertBookingAssignable(booking);

    const existing = await this.tripRepo.findOne({
      where: { booking_id: bookingId },
    });
    if (updating && !existing)
      throw new NotFoundException('Assignment belum tersedia');
    if (!updating && existing)
      throw new BadRequestException('Booking sudah memiliki assignment');
    if (
      existing &&
      !['ASSIGNED', 'ACCEPTED', 'CANCELLED'].includes(existing.trip_status)
    ) {
      throw new BadRequestException(
        'Assignment tidak dapat diubah setelah perjalanan dimulai',
      );
    }

    const driverId = this.validId(input.driver_id, 'Driver');
    const guideId = this.optionalValidId(input.tour_guide_id, 'Tour Guide');
    const sakociId = this.validId(input.sakoci_id, 'Sakoci');
    await this.ensureDriver(driverId);
    if (guideId) await this.ensureTourGuide(guideId);
    await this.ensureSakoci(sakociId);

    const scheduled = this.resolveScheduledPickup(
      booking,
      input.scheduled_user_pickup_at,
    );
    const defaultLead =
      await this.settingsService.getDriverReadyOffsetMinutes();
    const lead = Number(input.driver_lead_time_minutes ?? defaultLead);
    if (!Number.isInteger(lead) || lead < 0 || lead > 1440) {
      throw new BadRequestException('Waktu persiapan Driver tidak valid');
    }
    const ready = input.driver_ready_at
      ? this.parseDate(input.driver_ready_at, 'Driver wajib siap')
      : new Date(scheduled.getTime() - lead * 60_000);
    if (ready.getTime() > scheduled.getTime()) {
      throw new BadRequestException(
        'Driver wajib siap tidak boleh lebih lambat dari jadwal wisatawan',
      );
    }
    const computedLead = Math.round(
      (scheduled.getTime() - ready.getTime()) / 60_000,
    );
    const duration = Number(input.estimated_duration_minutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      throw new BadRequestException('Estimasi durasi perjalanan tidak valid');
    }
    const estimatedEnd = new Date(scheduled.getTime() + duration * 60_000);

    const snapshot = await this.buildItinerarySnapshot(
      booking,
      input.destination_ids,
      input.endpoint,
    );

    const saved = await this.dataSource.transaction(async (manager) => {
      const lockedBooking = await manager.findOne(Booking, {
        where: { id: bookingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedBooking)
        throw new NotFoundException('Booking tidak ditemukan');
      assertBookingAssignable(lockedBooking);
      const bookingWithRelations = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: [
          'tour_package',
          'tour_package.routes',
          'tour_package.routes.heritage_site',
          'rental_option',
        ],
      });
      if (!bookingWithRelations)
        throw new NotFoundException('Booking tidak ditemukan');
      const lockedExisting = await manager.findOne(DriverTrip, {
        where: { booking_id: bookingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (updating && !lockedExisting)
        throw new NotFoundException('Assignment belum tersedia');
      if (!updating && lockedExisting)
        throw new BadRequestException('Booking sudah memiliki assignment');
      if (
        lockedExisting &&
        !['ASSIGNED', 'ACCEPTED', 'CANCELLED'].includes(
          lockedExisting.trip_status,
        )
      ) {
        throw new BadRequestException(
          'Assignment tidak dapat diubah setelah perjalanan dimulai',
        );
      }
      await this.ensureRouteFinalizedForAssignment(bookingWithRelations);
      const lockedResources = await this.lockAssignmentResources(
        manager,
        driverId,
        guideId,
        sakociId,
      );
      await this.ensureNoScheduleConflict(
        driverId,
        sakociId,
        guideId,
        ready,
        estimatedEnd,
        lockedExisting?.id,
        manager,
      );
      let trip = lockedExisting
        ? manager.merge(DriverTrip, lockedExisting, {
            driver_id: driverId,
            tour_guide_id: guideId,
            sakoci_id: sakociId,
            assigned_by_admin_id: admin.userId,
            scheduled_user_pickup_at: scheduled,
            driver_ready_at: ready,
            driver_lead_time_minutes: computedLead,
            estimated_duration_minutes: duration,
            estimated_end_at: estimatedEnd,
            trip_status: 'ASSIGNED',
            current_itinerary_item_id: null,
            current_stop_sequence: 0,
            tracking_active: false,
            tracking_ended_at: new Date(),
            accepted_at: null,
            route_snapshot: snapshot.route,
            assigned_at: new Date(),
          })
        : manager.create(DriverTrip, {
            booking_id: lockedBooking.id,
            driver_id: driverId,
            tour_guide_id: guideId,
            sakoci_id: sakociId,
            assigned_by_admin_id: admin.userId,
            booking_reference: this.bookingReference(lockedBooking),
            scheduled_user_pickup_at: scheduled,
            driver_ready_at: ready,
            driver_lead_time_minutes: computedLead,
            estimated_duration_minutes: duration,
            estimated_end_at: estimatedEnd,
            trip_status: 'ASSIGNED',
            current_stop_sequence: 0,
            tracking_active: false,
            assigned_at: new Date(),
            route_snapshot: snapshot.route,
          });
      trip = await manager.save(DriverTrip, trip);

      if (lockedExisting) {
        await manager.delete(TripGuideSession, { trip_id: trip.id });
        await manager.delete(TripItineraryItem, { trip_id: trip.id });
      }
      const items = snapshot.stops.map((stop, index) =>
        manager.create(TripItineraryItem, {
          trip_id: trip.id,
          sequence: index,
          ...stop,
        }),
      );
      const savedItems = await manager.save(TripItineraryItem, items);
      if (guideId) {
        const sessions = savedItems
          .filter((item) => item.stop_type === 'DESTINATION')
          .map((item) =>
            manager.create(TripGuideSession, {
              trip_id: trip.id,
              itinerary_item_id: item.id,
              tour_guide_id: guideId,
              session_status: 'PENDING',
            }),
          );
        if (sessions.length) await manager.save(TripGuideSession, sessions);
      }

      await manager.update(Booking, lockedBooking.id, {
        assigned_tour_guide_id: guideId ?? null,
        assigned_driver_id: driverId,
        sakoci_id: sakociId,
        vehicle_name: lockedResources.sakoci.name,
        vehicle_plate_number: lockedResources.sakoci.plate_number,
        status: syncBookingStatusFromTrip('ASSIGNED'),
      });
      await manager.update(Sakoci, sakociId, { status: 'assigned' });
      if (lockedExisting?.sakoci_id && lockedExisting.sakoci_id !== sakociId) {
        await this.releaseSakoci(manager, lockedExisting.sakoci_id);
      }
      await manager.save(
        TripStatusHistory,
        manager.create(TripStatusHistory, {
          trip_id: trip.id,
          previous_status: lockedExisting?.trip_status ?? null,
          new_status: 'ASSIGNED',
          action: lockedExisting ? 'REASSIGN_TRIP' : 'ASSIGN_TRIP',
          changed_by_user_id: admin.userId,
          notes: lockedExisting
            ? 'Assignment diperbarui Admin'
            : 'Assignment dibuat Admin',
        }),
      );
      return trip;
    });

    const detail = await this.findOne(saved.id);
    this.gateway.emitTripUpdate(detail);
    await this.auditService?.record({
      actor: { id: admin.userId, role: admin.role as any },
      action: updating ? 'assignment.reassign' : 'assignment.create',
      entityType: 'driver_trip',
      entityId: saved.id,
      bookingCode: detail.booking_reference,
      metadata: { bookingId, driverId, guideId, sakociId },
    });
    return detail;
  }

  async cancelAssignment(
    authorization: string | undefined,
    bookingId: number,
    reason?: string,
  ) {
    const admin = this.requireAdmin(authorization);
    const trip = await this.findByBookingOrFail(bookingId);
    if (['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) {
      throw new BadRequestException('Trip sudah selesai atau dibatalkan');
    }
    const previous = trip.trip_status;
    trip.trip_status = 'CANCELLED';
    trip.cancelled_at = new Date();
    trip.cancellation_reason = reason?.trim() || 'Dibatalkan Admin';
    trip.tracking_active = false;
    trip.tracking_ended_at = new Date();
    await this.tripRepo.save(trip);
    await this.bookingRepo.update(bookingId, {
      assigned_driver_id: null,
      sakoci_id: null,
      vehicle_name: null,
      vehicle_plate_number: null,
    });
    await this.releaseSakoci(this.dataSource.manager, trip.sakoci_id);
    await this.addHistory(
      trip,
      admin.userId,
      'CANCEL_ASSIGNMENT',
      previous,
      'CANCELLED',
      {
        notes: trip.cancellation_reason,
      },
    );
    const detail = await this.findOne(trip.id);
    this.gateway.emitTripUpdate(detail);
    await this.auditService?.record({
      actor: { id: admin.userId, role: admin.role as any },
      action: 'assignment.cancel',
      entityType: 'driver_trip',
      entityId: trip.id,
      bookingCode: trip.booking_reference,
      metadata: { bookingId, reason: trip.cancellation_reason },
    });
    return detail;
  }

  async adminActiveTrips(authorization?: string) {
    this.requireAdmin(authorization);
    return this.tripRepo.find({
      where: { trip_status: In(ACTIVE_STATUSES) },
      relations: this.relations(),
      order: { driver_ready_at: 'ASC' },
    });
  }

  async adminIncidents(authorization: string | undefined, tripId: number) {
    this.requireAdmin(authorization);
    await this.findOne(tripId);
    return this.incidentRepo.find({
      where: { trip_id: tripId },
      order: { reported_at: 'DESC' },
    });
  }

  async getTripRoutePlayback(
    authorization: string | undefined,
    tripId: number,
  ) {
    const user = this.auth(authorization);
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip tidak ditemukan');
    this.assertTripRouteAccess(trip, user);
    return this.buildTripRoutePlayback(trip);
  }

  async getPublicTripRoutePlayback(tripId: number) {
    const settings = await this.settingsService.getSettings();
    if (!settings.publicTrackingEnabled || !settings.showPublicCurrentRoute) {
      throw new NotFoundException('Route snapshot not available');
    }
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['sakoci'],
    });
    if (!trip || !ACTIVE_STATUSES.includes(trip.trip_status)) {
      throw new NotFoundException('Trip tidak ditemukan');
    }
    if (
      !trip.sakoci?.active ||
      !trip.sakoci.tracking_enabled ||
      trip.sakoci.tracking_visibility !== 'public'
    ) {
      throw new NotFoundException('Route snapshot not available');
    }
    return this.buildTripRoutePlayback(trip);
  }

  private async buildTripRoutePlayback(trip: DriverTrip) {
    const rows: Array<{
      status: string;
      route_status: string | null;
      ordered_destination_ids: number[] | null;
      total_distance_km: string | number | null;
      total_duration_minutes: string | number | null;
      route_node_ids: number[] | null;
      route_edge_ids: number[] | null;
      segments: any[] | null;
      route_geojson: any;
      osrm_geometry: any;
      route_geometry_geojson: string | null;
    }> = await this.dataSource.query(
      `
        SELECT
          "status",
          "route_status",
          "ordered_destination_ids",
          "total_distance_km",
          "total_duration_minutes",
          "route_node_ids",
          "route_edge_ids",
          "segments",
          "route_geojson",
          "osrm_geometry",
          ST_AsGeoJSON("route_geometry") AS "route_geometry_geojson"
        FROM "route_optimization_result"
        WHERE "booking_id" = $1
        ORDER BY "updated_at" DESC
        LIMIT 1
      `,
      [trip.booking_id],
    );
    const route = rows[0];
    if (!route || route.status !== 'success') {
      throw new NotFoundException('Route snapshot not available');
    }

    const nodeIds = route.route_node_ids?.length
      ? route.route_node_ids
      : this.mergePlaybackIds(route.segments, 'pathNodeIds');
    const edgeIds = route.route_edge_ids?.length
      ? route.route_edge_ids
      : this.mergePlaybackIds(route.segments, 'pathEdgeIds');
    const graph = await this.getRoutePlaybackGraph(nodeIds, edgeIds);

    return {
      tripId: trip.id,
      bookingId: trip.booking_id,
      routeStatus: route.route_status,
      totalDistanceKm: Number(route.total_distance_km ?? 0),
      totalDurationMinutes:
        route.total_duration_minutes == null
          ? null
          : Number(route.total_duration_minutes),
      orderedDestinationIds: route.ordered_destination_ids ?? [],
      geometry: this.routePlaybackGeometry(
        route.route_geometry_geojson,
        route.route_geojson ?? route.osrm_geometry,
      ),
      nodeIds,
      edgeIds,
      graph,
    };
  }

  private mergePlaybackIds(
    segments: any[] | null,
    key: 'pathNodeIds' | 'pathEdgeIds',
  ) {
    return [
      ...new Set(
        (segments ?? []).flatMap((segment) =>
          Array.isArray(segment?.[key])
            ? segment[key]
                .map((id: unknown) => Number(id))
                .filter(Number.isInteger)
            : [],
        ),
      ),
    ];
  }

  private async getRoutePlaybackGraph(nodeIds: number[], edgeIds: number[]) {
    const [nodes, edges] = await Promise.all([
      nodeIds.length
        ? this.dataSource.query(
            `
            SELECT "id", "latitude", "longitude", "type", "name"
            FROM "road_node"
            WHERE "id" = ANY($1)
          `,
            [nodeIds],
          )
        : [],
      edgeIds.length
        ? this.dataSource.query(
            `
            SELECT
              "id",
              "from_node_id",
              "to_node_id",
              "distance_km",
              "road_name",
              "oneway",
              "geometry" AS "legacy_geometry",
              ST_AsGeoJSON("line_geom") AS "line_geometry"
            FROM "road_edge"
            WHERE "id" = ANY($1)
          `,
            [edgeIds],
          )
        : [],
    ]);
    const nodeById = new Map(nodes.map((row: any) => [Number(row.id), row]));
    const edgeById = new Map(edges.map((row: any) => [Number(row.id), row]));
    return {
      nodes: nodeIds
        .map((id) => nodeById.get(id))
        .filter(Boolean)
        .map((row: any) => ({
          id: Number(row.id),
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          type: row.type,
          name: row.name,
        })),
      edges: edgeIds
        .map((id) => edgeById.get(id))
        .filter(Boolean)
        .map((row: any) => ({
          id: Number(row.id),
          fromNodeId: Number(row.from_node_id),
          toNodeId: Number(row.to_node_id),
          distanceKm: Number(row.distance_km),
          roadName: row.road_name,
          oneway: row.oneway,
          geometry: this.routePlaybackEdgeGeometry(
            row.line_geometry,
            row.legacy_geometry,
          ),
        })),
    };
  }

  private routePlaybackEdgeGeometry(
    lineGeometry: string | null,
    legacyGeometry: any,
  ) {
    if (lineGeometry) {
      try {
        return JSON.parse(lineGeometry);
      } catch {
        return legacyGeometry ?? null;
      }
    }
    return legacyGeometry ?? null;
  }

  async updateIncidentStatus(
    authorization: string | undefined,
    tripId: number,
    incidentId: number,
    input: { status?: TripIncidentStatus; resolution_note?: string },
  ) {
    const admin = this.requireAdmin(authorization);
    const trip = await this.findOne(tripId);
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId, trip_id: tripId },
    });
    if (!incident) throw new NotFoundException('Incident tidak ditemukan');
    const nextStatus = input.status;
    if (
      !nextStatus ||
      !['OPEN', 'IN_REVIEW', 'RESOLVED'].includes(nextStatus)
    ) {
      throw new BadRequestException('Status incident tidak valid');
    }
    const previousStatus = incident.status;
    incident.status = nextStatus;
    incident.resolution_note = input.resolution_note?.trim() || null;
    if (nextStatus === 'RESOLVED') {
      incident.resolved_at = incident.resolved_at ?? new Date();
      incident.resolved_by = incident.resolved_by ?? admin.userId;
    } else {
      incident.resolved_at = null;
      incident.resolved_by = null;
    }
    const saved = await this.incidentRepo.save(incident);
    await this.auditService?.record({
      actor: { id: admin.userId, role: admin.role as any },
      action:
        nextStatus === 'RESOLVED'
          ? 'incident.resolve'
          : 'incident.status.update',
      entityType: 'trip_incident',
      entityId: saved.id,
      bookingCode: trip.booking_reference,
      metadata: {
        tripId,
        previousStatus,
        nextStatus,
        hasResolutionNote: Boolean(saved.resolution_note),
      },
    });
    this.gateway.emitTripUpdate(await this.findOne(tripId));
    return saved;
  }

  async resolveIncident(
    authorization: string | undefined,
    tripId: number,
    incidentId: number,
    note?: string,
  ) {
    return this.updateIncidentStatus(authorization, tripId, incidentId, {
      status: 'RESOLVED',
      resolution_note: note,
    });
  }

  async dashboard(authorization?: string) {
    const driver = this.requireDriver(authorization);
    const trips = await this.driverTrips(driver.userId);
    const now = new Date();
    const today = this.dateKey(now);
    const active = trips.find(
      (trip) =>
        ACTIVE_STATUSES.includes(trip.trip_status) &&
        trip.trip_status !== 'ASSIGNED',
    );
    const upcoming = trips.find(
      (trip) => trip.trip_status === 'ASSIGNED' && trip.driver_ready_at > now,
    );
    return {
      driver: await this.safeUser(driver.userId),
      primary_trip: active ?? upcoming ?? null,
      summary: {
        today: trips.filter(
          (trip) => this.dateKey(trip.driver_ready_at) === today,
        ).length,
        active: trips.filter(
          (trip) =>
            ACTIVE_STATUSES.includes(trip.trip_status) &&
            trip.trip_status !== 'ASSIGNED',
        ).length,
        upcoming: trips.filter(
          (trip) =>
            trip.trip_status === 'ASSIGNED' && trip.driver_ready_at > now,
        ).length,
        completed: trips.filter((trip) => trip.trip_status === 'COMPLETED')
          .length,
      },
    };
  }

  async tasks(authorization: string | undefined, status?: string) {
    const driver = this.requireDriver(authorization);
    let trips = await this.driverTrips(driver.userId);
    if (status === 'upcoming')
      trips = trips.filter((trip) => trip.trip_status === 'ASSIGNED');
    if (status === 'active')
      trips = trips.filter(
        (trip) =>
          ACTIVE_STATUSES.includes(trip.trip_status) &&
          trip.trip_status !== 'ASSIGNED',
      );
    if (status === 'completed')
      trips = trips.filter((trip) => trip.trip_status === 'COMPLETED');
    return trips;
  }

  async driverTask(authorization: string | undefined, tripId: number) {
    const driver = this.requireDriver(authorization);
    return this.ownedTrip(tripId, driver.userId);
  }

  async action(
    authorization: string | undefined,
    tripId: number,
    body: {
      action?: string;
      itineraryItemId?: number;
      nextItineraryItemId?: number;
      latitude?: number;
      longitude?: number;
      reason?: string;
    },
  ) {
    const driver = this.requireDriver(authorization);
    const trip = await this.ownedTrip(tripId, driver.userId);
    if (['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) {
      throw new BadRequestException('Trip sudah tidak aktif');
    }
    const action = body.action?.trim().toUpperCase();
    const previous = trip.trip_status;
    const now = new Date();
    let item: TripItineraryItem | undefined;

    if (action === 'ACCEPT_TASK') {
      this.expect(trip, ['ASSIGNED']);
      trip.trip_status = 'ACCEPTED';
      trip.accepted_at = now;
    } else if (action === 'START_TO_PICKUP') {
      this.expect(trip, ['ACCEPTED']);
      item = this.stopByType(trip, 'PICKUP');
      item.stop_status = 'EN_ROUTE';
      item.en_route_at = now;
      trip.trip_status = 'EN_ROUTE_TO_PICKUP';
      trip.current_itinerary_item_id = item.id;
      trip.current_stop_sequence = item.sequence;
      trip.tracking_active = true;
      trip.tracking_started_at = trip.tracking_started_at ?? now;
      trip.tracking_ended_at = null;
      trip.en_route_pickup_at = now;
    } else if (action === 'CONFIRM_ARRIVAL_PICKUP') {
      this.expect(trip, ['EN_ROUTE_TO_PICKUP']);
      item = this.currentItem(trip);
      if (item.stop_type !== 'PICKUP')
        throw new BadRequestException('Tujuan aktif bukan titik penjemputan');
      item.stop_status = 'ARRIVED';
      item.arrived_at = now;
      trip.trip_status = 'AT_PICKUP';
      trip.arrived_pickup_at = now;
    } else if (action === 'START_TOUR') {
      this.expect(trip, ['AT_PICKUP']);
      const pickup = this.stopByType(trip, 'PICKUP');
      pickup.stop_status = 'COMPLETED';
      pickup.completed_at = now;
      await this.itemRepo.save(pickup);
      item = this.nextPending(trip, pickup.sequence);
      if (!item)
        throw new BadRequestException(
          'Itinerary tidak memiliki tujuan berikutnya',
        );
      item.stop_status = 'EN_ROUTE';
      item.en_route_at = now;
      trip.trip_status =
        item.stop_type === 'ENDPOINT'
          ? 'EN_ROUTE_TO_ENDPOINT'
          : 'EN_ROUTE_TO_DESTINATION';
      trip.current_itinerary_item_id = item.id;
      trip.current_stop_sequence = item.sequence;
      trip.journey_started_at = now;
      await this.bookingRepo.update(trip.booking_id, {
        status: syncBookingStatusFromTrip(trip.trip_status),
      });
    } else if (action === 'CONFIRM_ARRIVAL_STOP') {
      this.expect(trip, ['EN_ROUTE_TO_DESTINATION', 'EN_ROUTE_TO_ENDPOINT']);
      item = this.currentItem(trip);
      if (body.itineraryItemId && Number(body.itineraryItemId) !== item.id) {
        throw new BadRequestException('Destinasi bukan tujuan aktif');
      }
      item.stop_status = item.stop_type === 'ENDPOINT' ? 'ARRIVED' : 'VISITING';
      item.arrived_at = now;
      trip.trip_status =
        item.stop_type === 'ENDPOINT'
          ? 'EN_ROUTE_TO_ENDPOINT'
          : 'AT_DESTINATION';
      if (trip.tour_guide_id && item.stop_type === 'DESTINATION') {
        await this.guideSessionRepo.update(
          {
            trip_id: trip.id,
            itinerary_item_id: item.id,
            session_status: 'PENDING',
          },
          { session_status: 'READY' },
        );
      }
    } else if (action === 'START_NEXT_STOP') {
      this.expect(trip, ['AT_DESTINATION']);
      const current = this.currentItem(trip);
      await this.ensureGuideSessionCompleted(trip, current);
      current.stop_status = 'COMPLETED';
      current.completed_at = now;
      await this.itemRepo.save(current);
      item = this.nextPending(trip, current.sequence);
      if (!item)
        throw new BadRequestException(
          'Tidak ada tujuan berikutnya; selesaikan perjalanan',
        );
      if (
        body.nextItineraryItemId &&
        Number(body.nextItineraryItemId) !== item.id
      ) {
        throw new BadRequestException('Urutan tujuan tidak dapat diubah');
      }
      item.stop_status = 'EN_ROUTE';
      item.en_route_at = now;
      trip.trip_status =
        item.stop_type === 'ENDPOINT'
          ? 'EN_ROUTE_TO_ENDPOINT'
          : 'EN_ROUTE_TO_DESTINATION';
      trip.current_itinerary_item_id = item.id;
      trip.current_stop_sequence = item.sequence;
    } else if (action === 'SKIP_STOP') {
      this.expect(trip, ['EN_ROUTE_TO_DESTINATION', 'AT_DESTINATION']);
      const reason = body.reason?.trim();
      if (!reason)
        throw new BadRequestException('Alasan melewati destinasi wajib diisi');
      const current = this.currentItem(trip);
      if (current.stop_type !== 'DESTINATION')
        throw new BadRequestException('Titik ini tidak dapat dilewati');
      current.stop_status = 'SKIPPED';
      current.skipped_at = now;
      current.skip_reason = reason;
      await this.itemRepo.save(current);
      await this.markRouteNeedsAdminAttention(
        trip,
        `Destinasi dilewati: ${reason}`,
      );
      item = this.nextPending(trip, current.sequence);
      if (!item) {
        trip.trip_status = 'AT_DESTINATION';
        trip.current_itinerary_item_id = current.id;
      } else {
        item.stop_status = 'EN_ROUTE';
        item.en_route_at = now;
        trip.trip_status =
          item.stop_type === 'ENDPOINT'
            ? 'EN_ROUTE_TO_ENDPOINT'
            : 'EN_ROUTE_TO_DESTINATION';
        trip.current_itinerary_item_id = item.id;
        trip.current_stop_sequence = item.sequence;
      }
    } else if (action === 'COMPLETE_TRIP') {
      const current = this.currentItem(trip);
      const hasPending = trip.itinerary_items.some(
        (candidate) => candidate.stop_status === 'PENDING',
      );
      const canCompleteLastDestination =
        trip.trip_status === 'AT_DESTINATION' &&
        current.stop_type === 'DESTINATION' &&
        !hasPending;
      const canCompleteEndpoint =
        trip.trip_status === 'EN_ROUTE_TO_ENDPOINT' &&
        current.stop_type === 'ENDPOINT' &&
        current.stop_status === 'ARRIVED';
      if (!canCompleteLastDestination && !canCompleteEndpoint) {
        throw new BadRequestException('Perjalanan belum dapat diselesaikan');
      }
      if (canCompleteLastDestination)
        await this.ensureGuideSessionCompleted(trip, current);
      current.stop_status = 'COMPLETED';
      current.completed_at = now;
      await this.itemRepo.save(current);
      trip.trip_status = 'COMPLETED';
      trip.completed_at = now;
      trip.tracking_active = false;
      trip.tracking_ended_at = now;
      await this.bookingRepo.update(trip.booking_id, {
        status: syncBookingStatusFromTrip('COMPLETED'),
      });
      await this.releaseSakoci(this.dataSource.manager, trip.sakoci_id);
    } else {
      throw new BadRequestException('Aksi perjalanan tidak dikenali');
    }

    if (item) await this.itemRepo.save(item);
    await this.tripRepo.save(trip);
    await this.addHistory(
      trip,
      driver.userId,
      action,
      previous,
      trip.trip_status,
      {
        itemId: item?.id ?? trip.current_itinerary_item_id,
        latitude: body.latitude,
        longitude: body.longitude,
        notes: body.reason,
      },
    );
    const detail = await this.ownedTrip(trip.id, driver.userId);
    this.gateway.emitTripUpdate(detail);
    await this.auditService?.record({
      actor: { id: driver.userId, role: driver.role as any },
      action: 'trip.status.update',
      entityType: 'driver_trip',
      entityId: trip.id,
      bookingCode: trip.booking_reference,
      metadata: {
        action,
        previousStatus: previous,
        nextStatus: trip.trip_status,
      },
    });
    return detail;
  }

  async location(
    authorization: string | undefined,
    tripId: number,
    body: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      speed_kmh?: number;
      heading?: number;
    },
  ) {
    const driver = this.requireDriver(authorization);
    const trip = await this.ownedTrip(tripId, driver.userId);
    if (trip.booking?.status === 'cancelled') {
      throw new BadRequestException('Booking sudah dibatalkan');
    }
    if (!trip.tracking_active || !ACTIVE_STATUSES.includes(trip.trip_status)) {
      throw new BadRequestException('Tracking belum aktif untuk trip ini');
    }
    const latitude = this.coordinate(body.latitude, -90, 90, 'Latitude');
    const longitude = this.coordinate(body.longitude, -180, 180, 'Longitude');
    const capturedAt = new Date();
    await this.locationRepo.save(
      this.locationRepo.create({
        trip_id: trip.id,
        booking_id: trip.booking_id,
        sakoci_id: trip.sakoci_id,
        driver_id: driver.userId,
        latitude,
        longitude,
        accuracy: this.optionalNumber(body.accuracy),
        speed_kmh: this.optionalNumber(body.speed_kmh),
        heading: this.optionalNumber(body.heading),
        captured_at: capturedAt,
        current_trip_status: trip.trip_status,
        current_itinerary_item_id: trip.current_itinerary_item_id,
      }),
    );
    await this.bookingRepo.update(trip.booking_id, {
      vehicle_latitude: latitude,
      vehicle_longitude: longitude,
      vehicle_location_updated_at: capturedAt,
    });
    await this.sakociRepo.update(trip.sakoci_id, {
      latitude,
      longitude,
      location_updated_at: capturedAt,
    });
    const payload = {
      tripId: trip.id,
      bookingId: trip.booking_id,
      sakociId: trip.sakoci_id,
      driverId: trip.driver_id,
      tourGuideId: trip.tour_guide_id,
      latitude,
      longitude,
      updated_at: capturedAt,
    };
    this.gateway.emitLocationUpdate(payload);
    return payload;
  }

  async reportIncident(
    authorization: string | undefined,
    tripId: number,
    body: {
      issue_type?: string;
      description?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const driver = this.requireDriver(authorization);
    const trip = await this.ownedTrip(tripId, driver.userId);
    if (['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) {
      throw new BadRequestException('Trip sudah tidak aktif');
    }
    const issueType = body.issue_type?.trim();
    const description = body.description?.trim();
    if (!issueType || !description)
      throw new BadRequestException('Jenis dan catatan kendala wajib diisi');
    const incident = await this.incidentRepo.save(
      this.incidentRepo.create({
        trip_id: trip.id,
        driver_id: driver.userId,
        reported_by_user_id: driver.userId,
        reporter_role: 'driver',
        issue_type: issueType,
        description,
        latitude:
          body.latitude === undefined
            ? null
            : this.coordinate(body.latitude, -90, 90, 'Latitude'),
        longitude:
          body.longitude === undefined
            ? null
            : this.coordinate(body.longitude, -180, 180, 'Longitude'),
        status: 'OPEN',
      }),
    );
    await this.addHistory(
      trip,
      driver.userId,
      'REPORT_ISSUE',
      trip.trip_status,
      'ISSUE_REPORTED',
      {
        notes: `${issueType}: ${description}`,
        latitude: body.latitude,
        longitude: body.longitude,
      },
    );
    this.gateway.emitTripUpdate(await this.ownedTrip(trip.id, driver.userId));
    await this.auditService?.record({
      actor: { id: driver.userId, role: driver.role as any },
      action: 'incident.create',
      entityType: 'trip_incident',
      entityId: incident.id,
      bookingCode: trip.booking_reference,
      metadata: { tripId: trip.id, issueType },
    });
    return incident;
  }

  async destinations(authorization: string | undefined, id?: number) {
    this.requireDriver(authorization);
    if (id) {
      const site = await this.heritageRepo.findOne({
        where: { id, status: 'aktif' },
      });
      if (!site) throw new NotFoundException('Destinasi tidak ditemukan');
      return site;
    }
    return this.heritageRepo.find({
      where: { status: 'aktif' },
      order: { name: 'ASC' },
    });
  }

  async history(authorization: string | undefined) {
    const driver = this.requireDriver(authorization);
    const trips = await this.tripRepo.find({
      where: { driver_id: driver.userId, trip_status: 'COMPLETED' },
      relations: this.relations(),
      order: { completed_at: 'DESC' },
    });
    return trips.map((trip) => this.sanitizeTripUsers(trip, 'driver'));
  }

  async guideDashboard(authorization?: string) {
    const guide = this.requireGuide(authorization);
    const trips = await this.guideTrips(guide.userId);
    const now = new Date();
    const today = this.dateKey(now);
    const active = trips.find(
      (trip) =>
        ACTIVE_STATUSES.includes(trip.trip_status) &&
        trip.trip_status !== 'ASSIGNED',
    );
    const upcoming = trips.find(
      (trip) => trip.trip_status === 'ASSIGNED' && trip.driver_ready_at > now,
    );
    return {
      guide: await this.safeUser(guide.userId),
      primary_trip: active ?? upcoming ?? null,
      summary: {
        today: trips.filter(
          (trip) => this.dateKey(trip.driver_ready_at) === today,
        ).length,
        active: trips.filter(
          (trip) =>
            ACTIVE_STATUSES.includes(trip.trip_status) &&
            trip.trip_status !== 'ASSIGNED',
        ).length,
        upcoming: trips.filter(
          (trip) =>
            trip.trip_status === 'ASSIGNED' && trip.driver_ready_at > now,
        ).length,
        completed: trips.filter((trip) => trip.trip_status === 'COMPLETED')
          .length,
      },
    };
  }

  async guideTasks(authorization: string | undefined, status?: string) {
    const guide = this.requireGuide(authorization);
    let trips = await this.guideTrips(guide.userId);
    if (status === 'upcoming')
      trips = trips.filter((trip) => trip.trip_status === 'ASSIGNED');
    if (status === 'active')
      trips = trips.filter(
        (trip) =>
          ACTIVE_STATUSES.includes(trip.trip_status) &&
          trip.trip_status !== 'ASSIGNED',
      );
    if (status === 'completed')
      trips = trips.filter((trip) => trip.trip_status === 'COMPLETED');
    return trips;
  }

  async guideTask(authorization: string | undefined, tripId: number) {
    const guide = this.requireGuide(authorization);
    return this.ownedGuideTrip(tripId, guide.userId);
  }

  async guideAction(
    authorization: string | undefined,
    tripId: number,
    body: { action?: string; itineraryItemId?: number; notes?: string },
  ) {
    const guide = this.requireGuide(authorization);
    const trip = await this.ownedGuideTrip(tripId, guide.userId);
    if (['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) {
      throw new BadRequestException('Trip sudah tidak aktif');
    }
    const action = body.action?.trim().toUpperCase();
    const itemId = this.validId(body.itineraryItemId, 'Destinasi');
    const item = trip.itinerary_items.find(
      (candidate) => candidate.id === itemId,
    );
    if (!item || item.stop_type !== 'DESTINATION')
      throw new BadRequestException('Destinasi sesi tidak valid');
    const session = trip.guide_sessions?.find(
      (candidate) => candidate.itinerary_item_id === item.id,
    );
    if (!session || session.tour_guide_id !== guide.userId)
      throw new ForbiddenException('Sesi Guide bukan milik akun ini');
    const now = new Date();
    const previous = session.session_status;

    if (action === 'START_GUIDE_SESSION') {
      if (
        trip.trip_status !== 'AT_DESTINATION' ||
        trip.current_itinerary_item_id !== item.id
      ) {
        throw new BadRequestException(
          'Sesi hanya dapat dimulai setelah Sakoci tiba di destinasi aktif',
        );
      }
      if (!['READY', 'PENDING'].includes(session.session_status)) {
        throw new BadRequestException(
          'Sesi tidak dapat dimulai dari status saat ini',
        );
      }
      if (session.session_status === 'PENDING')
        session.session_status = 'READY';
      session.session_status = 'IN_PROGRESS';
      session.started_at = now;
    } else if (action === 'COMPLETE_GUIDE_SESSION') {
      if (session.session_status !== 'IN_PROGRESS') {
        throw new BadRequestException('Sesi belum berjalan');
      }
      session.session_status = 'COMPLETED';
      session.completed_at = now;
      session.notes = body.notes?.trim() || session.notes || null;
    } else if (action === 'SAVE_GUIDE_NOTE') {
      if (
        !['READY', 'IN_PROGRESS', 'COMPLETED'].includes(session.session_status)
      ) {
        throw new BadRequestException(
          'Catatan belum dapat disimpan untuk sesi ini',
        );
      }
      session.notes = body.notes?.trim() || null;
    } else {
      throw new BadRequestException('Aksi Guide tidak dikenali');
    }

    await this.guideSessionRepo.save(session);
    await this.addHistory(
      trip,
      guide.userId,
      action,
      previous,
      session.session_status,
      {
        itemId: item.id,
        notes: body.notes,
      },
    );
    const detail = await this.ownedGuideTrip(trip.id, guide.userId);
    this.gateway.emitTripUpdate(detail);
    return detail;
  }

  async guideIncident(
    authorization: string | undefined,
    tripId: number,
    body: {
      issue_type?: string;
      description?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const guide = this.requireGuide(authorization);
    const trip = await this.ownedGuideTrip(tripId, guide.userId);
    if (['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) {
      throw new BadRequestException('Trip sudah tidak aktif');
    }
    const issueType = body.issue_type?.trim();
    const description = body.description?.trim();
    if (!issueType || !description)
      throw new BadRequestException('Jenis dan catatan kendala wajib diisi');
    const incident = await this.incidentRepo.save(
      this.incidentRepo.create({
        trip_id: trip.id,
        driver_id: null,
        reported_by_user_id: guide.userId,
        reporter_role: 'tour_guide',
        issue_type: issueType,
        description,
        latitude:
          body.latitude === undefined
            ? null
            : this.coordinate(body.latitude, -90, 90, 'Latitude'),
        longitude:
          body.longitude === undefined
            ? null
            : this.coordinate(body.longitude, -180, 180, 'Longitude'),
        status: 'OPEN',
      }),
    );
    await this.addHistory(
      trip,
      guide.userId,
      'REPORT_GUIDE_ISSUE',
      trip.trip_status,
      'ISSUE_REPORTED',
      {
        notes: `${issueType}: ${description}`,
        latitude: body.latitude,
        longitude: body.longitude,
      },
    );
    this.gateway.emitTripUpdate(
      await this.ownedGuideTrip(trip.id, guide.userId),
    );
    await this.auditService?.record({
      actor: { id: guide.userId, role: guide.role as any },
      action: 'incident.create',
      entityType: 'trip_incident',
      entityId: incident.id,
      bookingCode: trip.booking_reference,
      metadata: { tripId: trip.id, issueType },
    });
    return incident;
  }

  async guideDestinations(authorization: string | undefined, id?: number) {
    const guide = this.requireGuide(authorization);
    if (id) {
      const site = await this.heritageRepo.findOne({
        where: { id, status: 'aktif' },
      });
      if (!site) throw new NotFoundException('Destinasi tidak ditemukan');
      return site;
    }
    const trips = await this.guideTrips(guide.userId);
    const taskDestinations = trips.flatMap((trip) =>
      (trip.itinerary_items ?? [])
        .filter((item) => item.stop_type === 'DESTINATION')
        .map((item) => ({
          ...item,
          trip_id: trip.id,
          booking_reference: trip.booking_reference,
          scheduled_user_pickup_at: trip.scheduled_user_pickup_at,
          guide_session:
            trip.guide_sessions?.find(
              (session) => session.itinerary_item_id === item.id,
            ) ?? null,
        })),
    );
    const all = await this.heritageRepo.find({
      where: { status: 'aktif' },
      order: { name: 'ASC' },
    });
    return { task_destinations: taskDestinations, all_destinations: all };
  }

  async guideHistory(authorization: string | undefined) {
    const guide = this.requireGuide(authorization);
    const trips = await this.tripRepo.find({
      where: { tour_guide_id: guide.userId, trip_status: 'COMPLETED' },
      relations: this.relations(),
      order: { completed_at: 'DESC' },
    });
    return trips.map((trip) => this.sanitizeTripUsers(trip, 'tour_guide'));
  }

  private async driverTrips(driverId: number) {
    const trips = await this.tripRepo.find({
      where: { driver_id: driverId, trip_status: Not('CANCELLED') },
      relations: this.relations(),
      order: { driver_ready_at: 'ASC' },
    });
    return trips.map((trip) => this.sanitizeTripUsers(trip, 'driver'));
  }

  private async guideTrips(guideId: number) {
    const trips = await this.tripRepo.find({
      where: { tour_guide_id: guideId, trip_status: Not('CANCELLED') },
      relations: this.relations(),
      order: { driver_ready_at: 'ASC' },
    });
    return trips.map((trip) => this.sanitizeTripUsers(trip, 'tour_guide'));
  }

  private async ownedTrip(id: number, driverId: number) {
    const trip = await this.findOne(id);
    if (trip.driver_id !== driverId)
      throw new NotFoundException('Trip tidak ditemukan');
    return this.sanitizeTripUsers(trip, 'driver');
  }

  private async ownedGuideTrip(id: number, guideId: number) {
    const trip = await this.findOne(id);
    if (trip.tour_guide_id !== guideId)
      throw new NotFoundException('Trip tidak ditemukan');
    return this.sanitizeTripUsers(trip, 'tour_guide');
  }

  private findOne(id: number) {
    return this.tripRepo
      .findOne({
        where: { id },
        relations: this.relations(),
        order: {
          itinerary_items: { sequence: 'ASC' },
          status_history: { changed_at: 'DESC' },
          incidents: { reported_at: 'DESC' },
        },
      })
      .then((trip) => {
        if (!trip) throw new NotFoundException('Trip tidak ditemukan');
        return this.hydrateRouteSnapshot(trip);
      });
  }

  private findByBooking(bookingId: number) {
    return this.tripRepo
      .findOne({
        where: { booking_id: bookingId },
        relations: this.relations(),
        order: {
          itinerary_items: { sequence: 'ASC' },
          status_history: { changed_at: 'DESC' },
        },
      })
      .then((trip) => (trip ? this.hydrateRouteSnapshot(trip) : null));
  }

  private async findByBookingOrFail(bookingId: number) {
    const trip = await this.findByBooking(bookingId);
    if (!trip) throw new NotFoundException('Assignment tidak ditemukan');
    return trip;
  }

  private relations() {
    return [
      'booking',
      'booking.tour_package',
      'driver',
      'tour_guide',
      'sakoci',
      'itinerary_items',
      'itinerary_items.heritage_site',
      'status_history',
      'incidents',
      'incidents.reported_by_user',
      'guide_sessions',
      'guide_sessions.tour_guide',
    ];
  }

  private async ensureBooking(id: number) {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: [
        'tour_package',
        'tour_package.routes',
        'tour_package.routes.heritage_site',
        'rental_option',
      ],
    });
    if (!booking) throw new NotFoundException('Booking tidak ditemukan');
    return booking;
  }

  private async ensureDriver(id: number) {
    const driver = await this.userRepo.findOne({
      where: { id },
      relations: ['role'],
    });
    if (
      !driver ||
      !driver.active ||
      driver.account_status !== 'normal' ||
      driver.role?.name !== 'driver'
    ) {
      throw new BadRequestException('Driver tidak valid atau tidak aktif');
    }
    return driver;
  }

  private async ensureTourGuide(id: number) {
    const guide = await this.userRepo.findOne({
      where: { id },
      relations: ['role'],
    });
    if (
      !guide ||
      !guide.active ||
      guide.account_status !== 'normal' ||
      guide.role?.name !== 'tour_guide'
    ) {
      throw new BadRequestException('Tour Guide tidak valid atau tidak aktif');
    }
    return guide;
  }

  private async ensureSakoci(id: number) {
    const sakoci = await this.sakociRepo.findOne({ where: { id } });
    if (
      !sakoci ||
      !sakoci.active ||
      ['maintenance', 'inactive'].includes(sakoci.status)
    ) {
      throw new BadRequestException('Sakoci tidak tersedia');
    }
    return sakoci;
  }

  private async lockAssignmentResources(
    manager: any,
    driverId: number,
    guideId: number | null,
    sakociId: number,
  ) {
    const sakoci = await manager.findOne(Sakoci, {
      where: { id: sakociId },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !sakoci ||
      !sakoci.active ||
      ['maintenance', 'inactive'].includes(sakoci.status)
    ) {
      throw new BadRequestException('Sakoci tidak tersedia');
    }

    const staffIds = [
      ...new Set([driverId, ...(guideId ? [guideId] : [])]),
    ].sort((a, b) => a - b);
    await manager.find(User, {
      where: { id: In(staffIds) },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const staff = await manager.find(User, {
      where: { id: In(staffIds) },
      relations: ['role'],
      order: { id: 'ASC' },
    });

    const driver = staff.find((user: User) => user.id === driverId);
    if (
      !driver ||
      !driver.active ||
      driver.account_status !== 'normal' ||
      driver.role?.name !== 'driver'
    ) {
      throw new BadRequestException('Driver tidak valid atau tidak aktif');
    }
    const guide = guideId
      ? staff.find((user: User) => user.id === guideId)
      : null;
    if (
      guideId &&
      (!guide ||
        !guide.active ||
        guide.account_status !== 'normal' ||
        guide.role?.name !== 'tour_guide')
    ) {
      throw new BadRequestException('Tour Guide tidak valid atau tidak aktif');
    }

    return { sakoci, driver, guide };
  }

  private async ensureNoScheduleConflict(
    driverId: number,
    sakociId: number,
    guideId: number | null,
    start: Date,
    end: Date,
    excludeTripId?: number,
    manager = this.dataSource.manager,
  ) {
    const qb = manager
      .createQueryBuilder(DriverTrip, 'trip')
      .where('trip.trip_status IN (:...statuses)', {
        statuses: ACTIVE_STATUSES,
      })
      .andWhere('trip.driver_ready_at < :end', { end })
      .andWhere('trip.estimated_end_at > :start', { start })
      .andWhere(
        guideId
          ? '(trip.driver_id = :driverId OR trip.sakoci_id = :sakociId OR trip.tour_guide_id = :guideId)'
          : '(trip.driver_id = :driverId OR trip.sakoci_id = :sakociId)',
        { driverId, sakociId, guideId },
      );
    if (excludeTripId)
      qb.andWhere('trip.id != :excludeTripId', { excludeTripId });
    const conflicts = await qb.getMany();
    const conflictDetails = (trip: DriverTrip) => ({
      bookingCode: trip.booking_reference,
      start: trip.driver_ready_at,
      end: trip.estimated_end_at,
    });
    const driverConflict = conflicts.find(
      (trip) => trip.driver_id === driverId,
    );
    if (driverConflict) {
      businessConflict(
        'DRIVER_SCHEDULE_CONFLICT',
        'Driver memiliki tugas aktif pada jadwal yang bertabrakan',
        conflictDetails(driverConflict),
      );
    }
    const sakociConflict = conflicts.find(
      (trip) => trip.sakoci_id === sakociId,
    );
    if (sakociConflict) {
      businessConflict(
        'SAKOCI_SCHEDULE_CONFLICT',
        'Sakoci memiliki tugas aktif pada jadwal yang bertabrakan',
        conflictDetails(sakociConflict),
      );
    }
    const guideConflict = guideId
      ? conflicts.find((trip) => trip.tour_guide_id === guideId)
      : undefined;
    if (guideConflict) {
      businessConflict(
        'TOUR_GUIDE_SCHEDULE_CONFLICT',
        'Tour Guide memiliki tugas aktif pada jadwal yang bertabrakan',
        conflictDetails(guideConflict),
      );
    }
  }

  private async buildItinerarySnapshot(
    booking: Booking,
    requestedIds?: number[],
    endpoint?: AssignmentInput['endpoint'],
  ) {
    const route = await this.routeRepo.findOne({
      where: { booking_id: booking.id },
    });
    let destinationIds = (requestedIds ?? [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!destinationIds.length && (route as any)?.route_status === 'final') {
      destinationIds = route?.ordered_destination_ids ?? [];
    }
    if (!destinationIds.length && booking.booking_type === 'private') {
      destinationIds = booking.private_destination_ids ?? [];
    }
    if (!destinationIds.length && booking.booking_type === 'package') {
      destinationIds = [...(booking.tour_package?.routes ?? [])]
        .sort((a, b) => a.sequence - b.sequence)
        .map((item) => item.heritage_site_id);
    }
    const uniqueIds = [...new Set(destinationIds)];
    const sites = uniqueIds.length
      ? await this.heritageRepo.find({ where: { id: In(uniqueIds) } })
      : [];
    if (sites.length !== uniqueIds.length)
      throw new BadRequestException('Salah satu destinasi tidak valid');
    const orderedSites = uniqueIds.map((id) =>
      sites.find((site) => site.id === id)!,
    );

    const pickupLat = Number(booking.pickup_latitude);
    const pickupLng = Number(booking.pickup_longitude);
    const stops: Array<Partial<TripItineraryItem>> = [
      {
        stop_type: 'PICKUP',
        heritage_site_id: null,
        name: booking.pickup_location || 'Titik Penjemputan',
        address: booking.pickup_location || null,
        latitude: Number.isFinite(pickupLat) ? pickupLat : null,
        longitude: Number.isFinite(pickupLng) ? pickupLng : null,
        stop_status: 'PENDING',
      },
    ];
    orderedSites.forEach((site) =>
      stops.push({
        stop_type: 'DESTINATION',
        heritage_site_id: site.id,
        name: site.name,
        address: site.address,
        latitude: site.latitude,
        longitude: site.longitude,
        guide_content_snapshot: this.guideContentSnapshot(site),
        stop_status: 'PENDING',
      }),
    );
    if (endpoint?.name?.trim()) {
      stops.push({
        stop_type: 'ENDPOINT',
        heritage_site_id: null,
        name: endpoint.name.trim(),
        address: endpoint.address?.trim() || null,
        latitude: endpoint.latitude ?? null,
        longitude: endpoint.longitude ?? null,
        stop_status: 'PENDING',
      });
    }
    return {
      stops,
      route: {
        captured_at: new Date(),
        route_optimization_id: route?.id ?? null,
        route_status: (route as any)?.route_status ?? null,
        routing_build_id: (route as any)?.routing_build_id ?? null,
        finalized_at: (route as any)?.finalized_at ?? null,
        ordered_destination_ids: uniqueIds,
        total_distance_km: route ? Number(route.total_distance_km) : null,
        total_duration_minutes: route?.total_duration_minutes
          ? Number(route.total_duration_minutes)
          : null,
        segments: route?.segments ?? [],
        geojson: route?.route_geojson ?? route?.osrm_geometry ?? null,
        route_node_ids: route?.route_node_ids ?? [],
        route_edge_ids: route?.route_edge_ids ?? [],
        route_source: route?.route_source ?? null,
      },
    };
  }

  private async hydrateRouteSnapshot(trip: DriverTrip) {
    const route = await this.routeRepo.findOne({
      where: { booking_id: trip.booking_id },
      order: { updated_at: 'DESC' },
    });
    if (!route) return trip;
    const snapshot = trip.route_snapshot ?? {};
    const routeGeojson = route.route_geojson ?? route.osrm_geometry ?? null;
    const hasSnapshotGeometry = Boolean(
      snapshot.geojson ?? snapshot.routeGeojson ?? snapshot.route_geojson,
    );
    const hasSegmentGeometry =
      Array.isArray(snapshot.segments) &&
      snapshot.segments.some((segment: any) =>
        Boolean(segment?.geojson ?? segment?.geometry),
      );

    if (hasSnapshotGeometry && hasSegmentGeometry) return trip;

    trip.route_snapshot = {
      ...snapshot,
      captured_at: snapshot.captured_at ?? new Date(),
      route_optimization_id: snapshot.route_optimization_id ?? route.id,
      route_status:
        snapshot.route_status ?? (route as any).route_status ?? null,
      routing_build_id:
        snapshot.routing_build_id ?? (route as any).routing_build_id ?? null,
      finalized_at:
        snapshot.finalized_at ?? (route as any).finalized_at ?? null,
      ordered_destination_ids: snapshot.ordered_destination_ids?.length
        ? snapshot.ordered_destination_ids
        : (route.ordered_destination_ids ?? []),
      total_distance_km:
        snapshot.total_distance_km ?? Number(route.total_distance_km ?? 0),
      total_duration_minutes:
        snapshot.total_duration_minutes ??
        (route.total_duration_minutes == null
          ? null
          : Number(route.total_duration_minutes)),
      segments: hasSegmentGeometry ? snapshot.segments : (route.segments ?? []),
      geojson:
        snapshot.geojson ??
        snapshot.routeGeojson ??
        snapshot.route_geojson ??
        routeGeojson,
      route_node_ids: snapshot.route_node_ids ?? route.route_node_ids ?? [],
      route_edge_ids: snapshot.route_edge_ids ?? route.route_edge_ids ?? [],
      route_source: snapshot.route_source ?? route.route_source ?? null,
    };
    return trip;
  }

  private resolveScheduledPickup(booking: Booking, supplied?: string) {
    if (supplied) return this.parseDate(supplied, 'Jadwal wisatawan');
    if (!booking.visit_date)
      throw new BadRequestException('Tanggal booking belum tersedia');
    const date = new Date(booking.visit_date).toISOString().slice(0, 10);
    const time = booking.pickup_time?.match(/^\d{2}:\d{2}/)?.[0];
    if (!time)
      throw new BadRequestException(
        'Jam booking belum tersedia; isi jadwal wisatawan',
      );
    return this.parseDate(`${date}T${time}:00+07:00`, 'Jadwal wisatawan');
  }

  private parseDate(value: string, label: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException(`${label} tidak valid`);
    return date;
  }

  private bookingReference(booking: Booking) {
    const date = booking.visit_date
      ? new Date(booking.visit_date)
          .toISOString()
          .slice(0, 10)
          .replaceAll('-', '')
      : new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `BK-${date}-${String(booking.id).padStart(3, '0')}`;
  }

  private requireAdmin(authorization?: string) {
    const auth = this.auth(authorization);
    if (!['super_admin', 'admin_operasional'].includes(auth.role)) {
      throw new ForbiddenException(
        'Hanya Admin yang dapat mengelola assignment',
      );
    }
    return auth;
  }

  private requireDriver(authorization?: string) {
    const auth = this.auth(authorization);
    if (auth.role !== 'driver')
      throw new ForbiddenException('Endpoint khusus Driver');
    return auth;
  }

  private requireGuide(authorization?: string) {
    const auth = this.auth(authorization);
    if (auth.role !== 'tour_guide')
      throw new ForbiddenException('Endpoint khusus Tour Guide');
    return auth;
  }

  private auth(authorization?: string): { userId: number; role: string } {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    if (!token) throw new UnauthorizedException('Token tidak ditemukan');
    try {
      const payload = this.jwt.verify(token);
      const userId = Number(payload.sub);
      if (!Number.isInteger(userId) || userId < 1) throw new Error();
      return { userId, role: String(payload.role ?? '') };
    } catch {
      throw new UnauthorizedException('Token tidak valid');
    }
  }

  private assertTripRouteAccess(
    trip: DriverTrip,
    user: { userId: number; role: string },
  ) {
    if (['super_admin', 'admin_operasional'].includes(user.role)) return;
    if (user.role === 'driver' && trip.driver_id === user.userId) return;
    if (user.role === 'tour_guide' && trip.tour_guide_id === user.userId)
      return;
    throw new ForbiddenException('Tidak memiliki akses ke route trip ini');
  }

  private routePlaybackGeometry(
    postgisGeometry: string | null,
    cachedGeojson: any,
  ) {
    if (!postgisGeometry) return cachedGeojson ?? null;
    try {
      return JSON.parse(postgisGeometry);
    } catch {
      return cachedGeojson ?? null;
    }
  }

  private expect(trip: DriverTrip, statuses: TripStatus[]) {
    if (!statuses.includes(trip.trip_status)) {
      throw new BadRequestException(
        `Aksi tidak valid dari status ${trip.trip_status}`,
      );
    }
  }

  private currentItem(trip: DriverTrip) {
    const item = trip.itinerary_items.find(
      (candidate) => candidate.id === trip.current_itinerary_item_id,
    );
    if (!item) throw new BadRequestException('Tujuan aktif tidak ditemukan');
    return item;
  }

  private stopByType(trip: DriverTrip, type: TripStopType) {
    const item = trip.itinerary_items.find(
      (candidate) => candidate.stop_type === type,
    );
    if (!item) throw new BadRequestException('Titik itinerary tidak ditemukan');
    return item;
  }

  private nextPending(trip: DriverTrip, sequence: number) {
    return trip.itinerary_items
      .filter(
        (item) => item.sequence > sequence && item.stop_status === 'PENDING',
      )
      .sort((a, b) => a.sequence - b.sequence)[0];
  }

  private async ensureGuideSessionCompleted(
    trip: DriverTrip,
    item: TripItineraryItem,
  ) {
    if (!trip.tour_guide_id || item.stop_type !== 'DESTINATION') return;
    const session =
      trip.guide_sessions?.find(
        (candidate) => candidate.itinerary_item_id === item.id,
      ) ??
      (await this.guideSessionRepo.findOne({
        where: { trip_id: trip.id, itinerary_item_id: item.id },
      }));
    if (
      session &&
      session.session_status !== 'COMPLETED' &&
      session.session_status !== 'SKIPPED'
    ) {
      throw new BadRequestException(
        'Menunggu Tour Guide menyelesaikan sesi destinasi.',
      );
    }
  }

  private async addHistory(
    trip: DriverTrip,
    userId: number,
    action: string,
    previous: string,
    next: string,
    data?: {
      itemId?: number | null;
      notes?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    await this.historyRepo.save(
      this.historyRepo.create({
        trip_id: trip.id,
        itinerary_item_id: data?.itemId ?? null,
        previous_status: previous,
        new_status: next,
        action,
        changed_by_user_id: userId,
        notes: data?.notes?.trim() || null,
        latitude: data?.latitude ?? null,
        longitude: data?.longitude ?? null,
      }),
    );
  }

  private async markRouteNeedsAdminAttention(trip: DriverTrip, reason: string) {
    if (trip.route_snapshot) {
      trip.route_snapshot = {
        ...trip.route_snapshot,
        route_status: 'stale',
        stale_reason: reason,
      };
    }
    const route = await this.routeRepo.findOne({
      where: { booking_id: trip.booking_id },
      order: { updated_at: 'DESC' },
    });
    if (route && (route as any).route_status === 'final') {
      (route as any).route_status = 'stale';
      (route as any).stale_reason = reason;
      await this.routeRepo.save(route);
    }
  }

  private coordinate(value: unknown, min: number, max: number, label: string) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
      throw new BadRequestException(`${label} tidak valid`);
    }
    return number;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private validId(value: unknown, label: string) {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1)
      throw new BadRequestException(`${label} tidak valid`);
    return id;
  }

  private optionalValidId(value: unknown, label: string) {
    if (value === undefined || value === null || value === '') return null;
    return this.validId(value, label);
  }

  private guideContentSnapshot(site: HeritageSite) {
    return {
      id: site.id,
      name: site.name,
      category: site.category,
      description: site.description,
      address: site.address,
      kelurahan: site.kelurahan,
      kecamatan: site.kecamatan,
      latitude: site.latitude,
      longitude: site.longitude,
      no_register: site.no_register,
      sk_penetapan: site.sk_penetapan,
      status: site.status,
      tahun_register: site.tahun_register,
      image_url: site.image_url,
      images: site.images ?? [],
      youtube_links: site.youtube_links ?? [],
      pdf_files: site.pdf_files ?? [],
    };
  }

  private async releaseSakoci(manager: any, sakociId: number) {
    const sakoci = await manager.findOne(Sakoci, { where: { id: sakociId } });
    if (sakoci && sakoci.status !== 'maintenance' && sakoci.active) {
      await manager.update(Sakoci, sakociId, { status: 'available' });
    }
  }

  private async safeUser(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role'],
    });
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan');
    const { password, ...safe } = user as User & { password?: string };
    return safe;
  }

  private async ensureRouteFinalizedForAssignment(booking: Booking) {
    if (!this.bookingRequiresRoute(booking)) return;
    const route = await this.routeRepo.findOne({
      where: { booking_id: booking.id },
      order: { updated_at: 'DESC' },
    });
    if (
      !route ||
      route.status !== 'success' ||
      (route as any).route_status !== 'final'
    ) {
      throw new BadRequestException({
        code: 'ROUTE_FINALIZATION_REQUIRED',
        message: 'Finalisasi rute diperlukan sebelum assignment',
      });
    }
  }

  private bookingRequiresRoute(booking: Booking) {
    if (booking.booking_type === 'rental') return false;
    if (booking.booking_type === 'private')
      return (booking.private_destination_ids ?? []).length >= 2;
    if (booking.booking_type === 'package')
      return (booking.tour_package?.routes ?? []).length >= 2;
    return false;
  }

  private sanitizeTripUsers(
    trip: DriverTrip,
    audience: 'driver' | 'tour_guide',
  ) {
    const publicStaff = (user?: User | null) =>
      user
        ? { id: user.id, name: user.name, avatar_url: user.avatar_url }
        : null;

    if (audience === 'driver') {
      (trip as any).tour_guide = publicStaff(trip.tour_guide);
    } else {
      (trip as any).driver = publicStaff(trip.driver);
      if (trip.booking) {
        trip.booking.contact_email = null as any;
        trip.booking.contact_phone = null as any;
      }
    }
    for (const incident of trip.incidents ?? []) {
      (incident as any).reported_by_user = publicStaff(
        incident.reported_by_user,
      );
    }
    if (trip.route_snapshot) {
      trip.route_snapshot = this.sanitizeRouteSnapshot(trip.route_snapshot);
    }
    return trip;
  }

  private sanitizeRouteSnapshot(snapshot: any) {
    const sanitizeSegment = (segment: any) => {
      if (!segment || typeof segment !== 'object') return segment;
      const { edgeSteps, pathNodeIds, alternatives, ...safe } = segment;
      return safe;
    };
    return {
      ...snapshot,
      segments: (snapshot.segments ?? []).map(sanitizeSegment),
    };
  }

  private dateKey(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
    }).format(new Date(date));
  }
}
