import { NotFoundException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { UserRole } from '../../common/enums/user-role.enum';

describe('Booking ownership', () => {
  const service = Object.create(BookingService.prototype) as BookingService;

  it('hides Customer B booking from Customer A with 404', () => {
    expect(() =>
      service.assertBookingAccess({ id: 20, user_id: 2 } as any, {
        id: 1,
        email: 'a@example.test',
        name: 'A',
        role: UserRole.CUSTOMER,
      }),
    ).toThrow(NotFoundException);
  });

  it('allows a customer to read their own booking', () => {
    expect(() =>
      service.assertBookingAccess({ id: 20, user_id: 1 } as any, {
        id: 1,
        email: 'a@example.test',
        name: 'A',
        role: UserRole.CUSTOMER,
      }),
    ).not.toThrow();
  });
});
