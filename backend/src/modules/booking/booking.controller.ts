import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Req,
  BadRequestException,
  UseGuards,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  BookingService,
  CreateBookingDto,
  UpdateBookingTravelDto,
} from './booking.service';
import {
  BookingStatus,
  PaymentStatus,
} from '../../common/entities/booking.entity';
import { Public } from '../../common/security/public.decorator';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/security/authenticated-user';
import { createUploadOptions } from '../../common/upload/upload-options';
import { Throttle } from '@nestjs/throttler';
import { BookingOwnershipGuard } from './booking-ownership.guard';
import type { Response } from 'express';
import { StorageService } from '../../common/storage/storage.service';

@Controller('bookings')
export class BookingController {
  constructor(
    private readonly service: BookingService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      status,
      date_from,
      date_to,
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
    });
  }

  @Get('stats')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  getStats(@Req() req: any) {
    return this.service.getStats();
  }

  @Get('availability')
  @Public()
  availability(@Query() query: Record<string, any>) {
    return this.service.checkAvailability(query);
  }

  @Get('staff')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  staff(@Req() req: any, @Query('role') role?: 'tour_guide' | 'driver') {
    return this.service.findAssignableStaff(role);
  }

  @Get('me')
  @Roles(UserRole.CUSTOMER)
  findMine(@Req() req: any) {
    return this.service.findMyBookings((req.user as AuthenticatedUser).id);
  }

  @Get(':id/route')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  getRoute(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.getRouteForUser(id, req.user);
  }

  @Get(':id/payment/proof/:kind')
  @UseGuards(BookingOwnershipGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  async paymentProof(
    @Req() req: any,
    @Res() response: Response,
    @Param('id', ParseIntPipe) id: number,
    @Param('kind') kind: string,
  ) {
    const file = await this.service.getPaymentProofFile(id, req.user, kind);
    response.type(file.mimetype);
    return response.redirect(file.url);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOneForUser(id, req.user);
  }

  @Post()
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  create(@Body() dto: CreateBookingDto) {
    return this.service.create(dto);
  }

  @Post('me')
  @Roles(UserRole.CUSTOMER)
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  createMine(@Req() req: any, @Body() dto: CreateBookingDto) {
    return this.service.createForAuthenticatedCustomer(dto, req.user);
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  updateStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: BookingStatus; notes?: string },
  ) {
    return this.service.updateStatus(id, body.status, body.notes);
  }

  @Put(':id/assignment')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  updateAssignment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      assigned_tour_guide_id?: number | null;
      assigned_driver_id?: number | null;
      sakoci_id?: number | null;
      vehicle_name?: string | null;
      vehicle_plate_number?: string | null;
    },
  ) {
    return this.service.updateAssignment(id, body);
  }

  @Put(':id/payment')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  updatePayment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      payment_status?: PaymentStatus;
      payment_method?: string | null;
      paid_amount?: number | null;
      payment_proof_url?: string | null;
      admin_payment_proof_url?: string | null;
      payment_notes?: string | null;
    },
  ) {
    return this.service.updatePayment(id, body);
  }

  @Put(':id/travel')
  @Roles(UserRole.CUSTOMER)
  updateMyTravelDetails(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBookingTravelDto,
  ) {
    return this.service.updateMyTravelDetails(id, req.user, body);
  }

  @Post(':id/payment/verify')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  verifyPayment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { paid_amount?: number | null; payment_method?: string | null },
  ) {
    return this.service.verifyPayment(id, req.user, body);
  }

  @Post(':id/payment/reject')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  rejectPayment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
  ) {
    return this.service.rejectPayment(id, req.user, body);
  }

  @Post(':id/cancel')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  cancelBooking(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
  ) {
    return this.service.cancelBooking(id, req.user, body.reason);
  }

  @Post(':id/finalize-route')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  finalizeRoute(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      endpoint?: {
        name?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
      } | null;
      vehicleProfile?: string;
    },
  ) {
    return this.service.finalizeRoute(id, req.user, body);
  }

  @Post(':id/reoptimize-route')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  reoptimizeRoute(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string; mode?: string },
  ) {
    return this.service.reoptimizeRoute(id, req.user, body);
  }

  @Put(':id/location')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  updateVehicleLocation(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { latitude?: number; longitude?: number },
  ) {
    return this.service.updateVehicleLocation(id, body);
  }

  @Post(':id/payment/upload')
  @UseGuards(BookingOwnershipGuard)
  @UseInterceptors(
    FileInterceptor('file', createUploadOptions('booking-payments', true)),
  )
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  async uploadPaymentProof(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file)
      throw new BadRequestException('File bukti pembayaran wajib diunggah');
    const kind = req.user.role === UserRole.CUSTOMER ? 'customer' : 'admin';
    const privateUrl = `${req.protocol}://${req.get('host')}/api/bookings/${id}/payment/proof/${kind}?file=${file.originalname}`;
    const stored = await this.storage.fromUploadedFile(
      req,
      'booking-payments',
      file,
      { privateUrl },
    );
    const booking = await this.service.savePaymentProof(
      id,
      req.user,
      stored.url,
    );
    return {
      url: stored.url,
      filename: stored.filename,
      mimetype: stored.mimetype,
      booking,
    };
  }
}
