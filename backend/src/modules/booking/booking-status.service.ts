import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../../common/entities/booking.entity';
import { TripStatus } from '../../common/entities/driver-trip.entity';

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'assigned',
  'in_progress',
];

export const ACTIVE_TRIP_STATUSES: TripStatus[] = [
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'EN_ROUTE_TO_DESTINATION',
  'AT_DESTINATION',
  'EN_ROUTE_TO_ENDPOINT',
  'ISSUE_REPORTED',
];

export function businessConflict(
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  throw new ConflictException({
    code,
    message,
    ...(details ? { details } : {}),
  });
}

export function assertBookingPayable(booking: Booking) {
  if (['cancelled', 'completed'].includes(booking.status)) {
    throw new BadRequestException(
      'Booking sudah tidak dapat menerima pembayaran',
    );
  }
  if (
    !['unpaid', 'waiting_verification', 'rejected'].includes(
      booking.payment_status,
    )
  ) {
    throw new BadRequestException(
      'Status pembayaran tidak dapat diunggah ulang',
    );
  }
}

export function assertPaymentVerifiable(booking: Booking) {
  if (booking.payment_status !== 'waiting_verification') {
    throw new BadRequestException(
      'Hanya pembayaran menunggu verifikasi yang dapat diproses',
    );
  }
  if (['cancelled', 'completed'].includes(booking.status)) {
    throw new BadRequestException('Booking sudah tidak dapat diproses');
  }
}

export function assertBookingAssignable(booking: Booking) {
  if (booking.payment_status !== 'paid') {
    throw new BadRequestException('Booking belum lunas');
  }
  if (['cancelled', 'completed', 'in_progress'].includes(booking.status)) {
    throw new BadRequestException(
      'Booking tidak dapat di-assign dari status saat ini',
    );
  }
}

export function canCancelBooking(booking: Booking, byAdmin: boolean) {
  if (['cancelled', 'completed', 'in_progress'].includes(booking.status))
    return false;
  if (booking.status === 'assigned') return byAdmin;
  return byAdmin || booking.payment_status !== 'paid';
}

export function syncBookingStatusFromPayment(
  paymentStatus: PaymentStatus,
): BookingStatus {
  if (paymentStatus === 'paid') return 'confirmed';
  if (paymentStatus === 'waiting_verification') return 'pending';
  if (paymentStatus === 'rejected' || paymentStatus === 'unpaid')
    return 'pending';
  if (paymentStatus === 'expired' || paymentStatus === 'refunded')
    return 'cancelled';
  return 'pending';
}

export function syncBookingStatusFromTrip(
  tripStatus: TripStatus,
): BookingStatus | undefined {
  if (tripStatus === 'ASSIGNED' || tripStatus === 'ACCEPTED') return 'assigned';
  if (
    [
      'EN_ROUTE_TO_PICKUP',
      'AT_PICKUP',
      'EN_ROUTE_TO_DESTINATION',
      'AT_DESTINATION',
      'EN_ROUTE_TO_ENDPOINT',
      'ISSUE_REPORTED',
    ].includes(tripStatus)
  )
    return 'in_progress';
  if (tripStatus === 'COMPLETED') return 'completed';
  if (tripStatus === 'CANCELLED') return 'cancelled';
  return undefined;
}

export function assertBookingStatusTransition(
  booking: Booking,
  nextStatus: BookingStatus,
) {
  if (booking.status === nextStatus) return;
  if (['cancelled', 'completed'].includes(booking.status)) {
    throw new BadRequestException(
      'Booking terminal tidak dapat diubah kembali aktif',
    );
  }
  if (
    ['assigned', 'in_progress'].includes(nextStatus) &&
    booking.payment_status !== 'paid'
  ) {
    throw new BadRequestException(
      'Booking belum memiliki pembayaran terverifikasi',
    );
  }
  if (nextStatus === 'completed' && booking.status !== 'in_progress') {
    throw new BadRequestException(
      'Booking hanya dapat selesai dari perjalanan berlangsung',
    );
  }
}
