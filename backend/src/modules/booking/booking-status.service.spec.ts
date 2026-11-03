import { BadRequestException } from '@nestjs/common';
import { Booking } from '../../common/entities/booking.entity';
import {
  assertBookingAssignable,
  assertBookingPayable,
  assertPaymentVerifiable,
  canCancelBooking,
  syncBookingStatusFromTrip,
} from './booking-status.service';

const booking = (overrides: Partial<Booking>): Booking =>
  ({
    id: 1,
    status: 'pending',
    payment_status: 'unpaid',
    ...overrides,
  }) as Booking;

describe('booking operational status helpers', () => {
  it('allows rejected payment proof to be uploaded again', () => {
    expect(() =>
      assertBookingPayable(booking({ payment_status: 'rejected' })),
    ).not.toThrow();
  });

  it('allows verification only while waiting verification', () => {
    expect(() =>
      assertPaymentVerifiable(
        booking({ payment_status: 'waiting_verification' }),
      ),
    ).not.toThrow();
    expect(() =>
      assertPaymentVerifiable(booking({ payment_status: 'paid' })),
    ).toThrow(BadRequestException);
  });

  it('blocks assignment before paid or after terminal statuses', () => {
    expect(() =>
      assertBookingAssignable(
        booking({ payment_status: 'paid', status: 'confirmed' }),
      ),
    ).not.toThrow();
    expect(() =>
      assertBookingAssignable(
        booking({ payment_status: 'unpaid', status: 'confirmed' }),
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      assertBookingAssignable(
        booking({ payment_status: 'paid', status: 'cancelled' }),
      ),
    ).toThrow(BadRequestException);
  });

  it('syncs driver trip activity into booking operational status', () => {
    expect(syncBookingStatusFromTrip('ASSIGNED')).toBe('assigned');
    expect(syncBookingStatusFromTrip('EN_ROUTE_TO_PICKUP')).toBe('in_progress');
    expect(syncBookingStatusFromTrip('COMPLETED')).toBe('completed');
  });

  it('allows customer cancellation only before verified assignment flow', () => {
    expect(
      canCancelBooking(
        booking({ payment_status: 'unpaid', status: 'pending' }),
        false,
      ),
    ).toBe(true);
    expect(
      canCancelBooking(
        booking({ payment_status: 'paid', status: 'confirmed' }),
        true,
      ),
    ).toBe(true);
    expect(
      canCancelBooking(
        booking({ payment_status: 'paid', status: 'assigned' }),
        false,
      ),
    ).toBe(false);
    expect(
      canCancelBooking(
        booking({ payment_status: 'paid', status: 'assigned' }),
        true,
      ),
    ).toBe(true);
    expect(
      canCancelBooking(
        booking({ payment_status: 'paid', status: 'in_progress' }),
        true,
      ),
    ).toBe(false);
  });
});
