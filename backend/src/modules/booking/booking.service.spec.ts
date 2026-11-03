import { BookingService } from './booking.service';

const createService = (bookings: any[] = []) => {
  const bookingRepo = {
    find: jest.fn(async () => bookings),
  };
  const pkgRepo = {
    findOne: jest.fn(async () => ({ id: 1, active: true, duration_hours: 2 })),
  };
  const sakociRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(async () => 1),
    })),
  };
  const driverTripRepo = {
    find: jest.fn(async () => []),
  };
  const settingsService = {
    getSettings: jest.fn(async () => ({ defaultCapacityLimit: 50 })),
  };

  const service = new BookingService(
    bookingRepo as any,
    pkgRepo as any,
    {} as any,
    {} as any,
    {} as any,
    sakociRepo as any,
    {} as any,
    driverTripRepo as any,
    {} as any,
    {} as any,
    {} as any,
    settingsService as any,
    {} as any,
    {} as any,
  );

  return { service, bookingRepo, settingsService };
};

describe('BookingService availability', () => {
  it('does not count bookings from another visit date at the same pickup time', async () => {
    const { service, bookingRepo } = createService([]);

    const availability = await service.checkAvailability({
      booking_type: 'package',
      tour_package_id: 1,
      visit_date: '2026-11-21',
      pickup_time: '12:00',
    });

    expect(availability.available).toBe(true);
    expect(availability.booked).toBe(0);
    expect(availability.maxParticipantsPerBooking).toBe(50);
    expect(bookingRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ visit_date: '2026-11-21' }),
      }),
    );
  });

  it('counts overlapping bookings only on the same visit date', async () => {
    const { service } = createService([
      {
        id: 10,
        booking_type: 'package',
        visit_date: '2026-11-21',
        pickup_time: '12:00',
        status: 'pending',
        payment_status: 'unpaid',
        tour_package: { duration_hours: 2 },
      },
    ]);

    const availability = await service.checkAvailability({
      booking_type: 'package',
      tour_package_id: 1,
      visit_date: '2026-11-21',
      pickup_time: '12:00',
    });

    expect(availability.available).toBe(false);
    expect(availability.booked).toBe(1);
  });

  it('marks a slot unavailable when participants exceed Sakoci capacity', async () => {
    const { service } = createService([]);

    const availability = await service.checkAvailability({
      booking_type: 'package',
      tour_package_id: 1,
      visit_date: '2026-11-21',
      pickup_time: '12:00',
      participants: 51,
    });

    expect(availability.available).toBe(false);
    expect(availability.maxParticipantsPerBooking).toBe(50);
  });
});
