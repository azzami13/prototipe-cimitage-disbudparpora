import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BookingService } from './booking.service';
import { ForbiddenException } from '@nestjs/common';
import { getFrontendOrigins } from '../../common/config/cors-origins';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/security/authenticated-user';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../common/entities/user.entity';

@WebSocketGateway({
  namespace: 'booking-monitoring',
  cors: {
    origin: getFrontendOrigins(),
    credentials: true,
  },
})
export class BookingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly bookingService: BookingService,
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      client.data.user = await this.socketUser(client);
      const bookingId = Number(client.handshake.query.bookingId);
      if (Number.isInteger(bookingId) && bookingId > 0) {
        await this.bookingService.assertBookingAccessById(
          bookingId,
          client.data.user,
        );
        await client.join(this.roomName(bookingId));
      }
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join-booking')
  async joinBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { bookingId?: number },
  ) {
    const bookingId = Number(body?.bookingId);
    if (Number.isInteger(bookingId) && bookingId > 0) {
      try {
        await this.assertCurrentSocketUser(client.data.user);
        await this.bookingService.assertBookingAccessById(
          bookingId,
          client.data.user,
        );
        await client.join(this.roomName(bookingId));
        return { ok: true, bookingId };
      } catch {
        return { ok: false, message: 'Booking tidak ditemukan' };
      }
    }
    return { ok: false, message: 'bookingId tidak valid' };
  }

  @SubscribeMessage('driver-location')
  async updateDriverLocation(
    @MessageBody()
    body: {
      bookingId?: number;
      latitude?: number;
      longitude?: number;
    },
  ) {
    throw new ForbiddenException(
      'Gunakan endpoint tracking trip Driver yang tervalidasi JWT',
    );
  }

  private roomName(bookingId: number) {
    return `booking:${bookingId}`;
  }

  private async socketUser(client: Socket): Promise<AuthenticatedUser> {
    const raw =
      client.handshake.auth?.token ?? client.handshake.headers.authorization;
    const token =
      typeof raw === 'string' && raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    const payload = this.jwtService.verify(String(token ?? ''));
    const id = Number(payload.sub);
    const role = (payload.role ?? UserRole.CUSTOMER) as UserRole;
    if (!Number.isInteger(id) || !Object.values(UserRole).includes(role))
      throw new Error();
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['role'],
    });
    const databaseRole = (user?.role?.name ?? UserRole.CUSTOMER) as UserRole;
    if (
      !user ||
      !user.active ||
      user.account_status !== 'normal' ||
      databaseRole !== role
    ) {
      throw new Error();
    }
    return {
      id,
      role,
      email: user.email,
      name: user.name,
    };
  }

  private async assertCurrentSocketUser(user: AuthenticatedUser | undefined) {
    if (!user) throw new Error();
    const current = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['role'],
    });
    const role = (current?.role?.name ?? UserRole.CUSTOMER) as UserRole;
    if (
      !current ||
      !current.active ||
      current.account_status !== 'normal' ||
      role !== user.role
    ) {
      throw new Error();
    }
  }
}
