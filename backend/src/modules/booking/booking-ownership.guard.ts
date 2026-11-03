import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/security/authenticated-user';
import { BookingService } from './booking.service';

@Injectable()
export class BookingOwnershipGuard implements CanActivate {
  constructor(private readonly bookingService: BookingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: { id?: string };
      user: AuthenticatedUser;
    }>();
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new NotFoundException('Booking tidak ditemukan');
    }
    await this.bookingService.assertBookingAccessById(id, request.user);
    return true;
  }
}
