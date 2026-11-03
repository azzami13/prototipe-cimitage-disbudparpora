import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { DriverTripService } from './driver-trip.service';
import type { AssignmentInput } from './driver-trip.service';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { Public } from '../../common/security/public.decorator';

@Controller()
export class DriverTripController {
  constructor(private readonly service: DriverTripService) {}

  @Get('admin/bookings/:bookingId/assignment')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  adminAssignment(
    @Req() req: any,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.service.getAdminAssignment(
      req.headers.authorization,
      bookingId,
    );
  }

  @Post('admin/bookings/:bookingId/assignment')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  createAssignment(
    @Req() req: any,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() body: AssignmentInput,
  ) {
    return this.service.saveAssignment(
      req.headers.authorization,
      bookingId,
      body,
    );
  }

  @Patch('admin/bookings/:bookingId/assignment')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  updateAssignment(
    @Req() req: any,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() body: AssignmentInput,
  ) {
    return this.service.saveAssignment(
      req.headers.authorization,
      bookingId,
      body,
      true,
    );
  }

  @Post('admin/bookings/:bookingId/assignment/cancel')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  cancelAssignment(
    @Req() req: any,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() body: { reason?: string },
  ) {
    return this.service.cancelAssignment(
      req.headers.authorization,
      bookingId,
      body.reason,
    );
  }

  @Get('admin/bookings/:bookingId/trip-monitoring')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  tripMonitoring(
    @Req() req: any,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.service.getAdminAssignment(
      req.headers.authorization,
      bookingId,
    );
  }

  @Get('admin/trips/active')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  activeTrips(@Req() req: any) {
    return this.service.adminActiveTrips(req.headers.authorization);
  }

  @Get('admin/trips/:tripId/incidents')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  incidents(@Req() req: any, @Param('tripId', ParseIntPipe) tripId: number) {
    return this.service.adminIncidents(req.headers.authorization, tripId);
  }

  @Get('trips/:tripId/route')
  @Roles(
    UserRole.ADMIN_OPERASIONAL,
    UserRole.SUPER_ADMIN,
    UserRole.DRIVER,
    UserRole.TOUR_GUIDE,
  )
  tripRoute(@Req() req: any, @Param('tripId', ParseIntPipe) tripId: number) {
    return this.service.getTripRoutePlayback(req.headers.authorization, tripId);
  }

  @Get('trips/:tripId/public-route')
  @Public()
  publicTripRoute(@Param('tripId', ParseIntPipe) tripId: number) {
    return this.service.getPublicTripRoutePlayback(tripId);
  }

  @Patch('admin/trips/:tripId/incidents/:incidentId/resolve')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  resolveIncident(
    @Req() req: any,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('incidentId', ParseIntPipe) incidentId: number,
    @Body() body: { resolution_note?: string },
  ) {
    return this.service.resolveIncident(
      req.headers.authorization,
      tripId,
      incidentId,
      body.resolution_note,
    );
  }

  @Patch('admin/trips/:tripId/incidents/:incidentId/status')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  updateIncidentStatus(
    @Req() req: any,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('incidentId', ParseIntPipe) incidentId: number,
    @Body()
    body: {
      status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
      resolution_note?: string;
    },
  ) {
    return this.service.updateIncidentStatus(
      req.headers.authorization,
      tripId,
      incidentId,
      body,
    );
  }

  @Get('driver/dashboard')
  @Roles(UserRole.DRIVER)
  dashboard(@Req() req: any) {
    return this.service.dashboard(req.headers.authorization);
  }

  @Get('driver/tasks')
  @Roles(UserRole.DRIVER)
  tasks(@Req() req: any, @Query('status') status?: string) {
    return this.service.tasks(req.headers.authorization, status);
  }

  @Get('driver/tasks/:tripId')
  @Roles(UserRole.DRIVER)
  task(@Req() req: any, @Param('tripId', ParseIntPipe) tripId: number) {
    return this.service.driverTask(req.headers.authorization, tripId);
  }

  @Post('driver/tasks/:tripId/actions')
  @Roles(UserRole.DRIVER)
  action(
    @Req() req: any,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() body: any,
  ) {
    return this.service.action(req.headers.authorization, tripId, body);
  }

  @Post('driver/tasks/:tripId/location')
  @Roles(UserRole.DRIVER)
  location(
    @Req() req: any,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() body: any,
  ) {
    return this.service.location(req.headers.authorization, tripId, body);
  }

  @Post('driver/tasks/:tripId/incidents')
  @Roles(UserRole.DRIVER)
  reportIncident(
    @Req() req: any,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() body: any,
  ) {
    return this.service.reportIncident(req.headers.authorization, tripId, body);
  }

  @Get('driver/destinations')
  @Roles(UserRole.DRIVER)
  destinations(@Req() req: any) {
    return this.service.destinations(req.headers.authorization);
  }

  @Get('driver/destinations/:heritageSiteId')
  @Roles(UserRole.DRIVER)
  destination(
    @Req() req: any,
    @Param('heritageSiteId', ParseIntPipe) heritageSiteId: number,
  ) {
    return this.service.destinations(req.headers.authorization, heritageSiteId);
  }

  @Get('driver/history')
  @Roles(UserRole.DRIVER)
  history(@Req() req: any) {
    return this.service.history(req.headers.authorization);
  }

  @Get('guide/dashboard')
  @Roles(UserRole.TOUR_GUIDE)
  guideDashboard(@Req() req: any) {
    return this.service.guideDashboard(req.headers.authorization);
  }

  @Get('guide/tasks')
  @Roles(UserRole.TOUR_GUIDE)
  guideTasks(@Req() req: any, @Query('status') status?: string) {
    return this.service.guideTasks(req.headers.authorization, status);
  }

  @Get('guide/tasks/:tripId')
  @Roles(UserRole.TOUR_GUIDE)
  guideTask(@Req() req: any, @Param('tripId', ParseIntPipe) tripId: number) {
    return this.service.guideTask(req.headers.authorization, tripId);
  }

  @Post('guide/tasks/:tripId/actions')
  @Roles(UserRole.TOUR_GUIDE)
  guideAction(
    @Req() req: any,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() body: any,
  ) {
    return this.service.guideAction(req.headers.authorization, tripId, body);
  }

  @Post('guide/tasks/:tripId/incidents')
  @Roles(UserRole.TOUR_GUIDE)
  guideIncident(
    @Req() req: any,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() body: any,
  ) {
    return this.service.guideIncident(req.headers.authorization, tripId, body);
  }

  @Get('guide/destinations')
  @Roles(UserRole.TOUR_GUIDE)
  guideDestinations(@Req() req: any) {
    return this.service.guideDestinations(req.headers.authorization);
  }

  @Get('guide/destinations/:heritageSiteId')
  @Roles(UserRole.TOUR_GUIDE)
  guideDestination(
    @Req() req: any,
    @Param('heritageSiteId', ParseIntPipe) heritageSiteId: number,
  ) {
    return this.service.guideDestinations(
      req.headers.authorization,
      heritageSiteId,
    );
  }

  @Get('guide/history')
  @Roles(UserRole.TOUR_GUIDE)
  guideHistory(@Req() req: any) {
    return this.service.guideHistory(req.headers.authorization);
  }
}
