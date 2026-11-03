import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { getFrontendOrigins } from '../../common/config/cors-origins';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../common/entities/user.entity';
import { DriverTrip } from '../../common/entities/driver-trip.entity';

@WebSocketGateway({
  namespace: 'trip-monitoring',
  cors: {
    origin: getFrontendOrigins(),
    credentials: true,
  },
})
export class DriverTripGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(DriverTrip)
    private readonly tripRepository: Repository<DriverTrip>,
  ) {}

  async handleConnection(client: Socket) {
    const raw =
      client.handshake.auth?.token ?? client.handshake.headers.authorization;
    const token =
      typeof raw === 'string' && raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    try {
      const payload = this.jwt.verify(String(token ?? ''));
      const role = String(payload.role ?? '');
      const userId = Number(payload.sub);
      if (
        !['super_admin', 'admin_operasional', 'driver', 'tour_guide'].includes(
          role,
        ) ||
        !Number.isInteger(userId)
      ) {
        client.disconnect(true);
        return;
      }
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['role'],
      });
      if (
        !user ||
        !user.active ||
        user.account_status !== 'normal' ||
        user.role?.name !== role
      ) {
        client.disconnect(true);
        return;
      }
      client.data.user = { id: userId, role };
      if (['super_admin', 'admin_operasional'].includes(role))
        client.join('admin-monitoring');
      if (role === 'driver') client.join(`driver:${userId}`);
      if (role === 'tour_guide') client.join(`tour-guide:${userId}`);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join-trip')
  async joinTrip(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tripId?: number },
  ) {
    const tripId = Number(body?.tripId);
    const socketUser = client.data.user as
      { id: number; role: string } | undefined;
    if (!Number.isInteger(tripId) || tripId < 1 || !socketUser) {
      return { ok: false, message: 'Trip tidak ditemukan' };
    }

    const user = await this.userRepository.findOne({
      where: { id: socketUser.id },
      relations: ['role'],
    });
    if (
      !user ||
      !user.active ||
      user.account_status !== 'normal' ||
      user.role?.name !== socketUser.role
    ) {
      client.disconnect(true);
      return { ok: false, message: 'Trip tidak ditemukan' };
    }

    const trip = await this.tripRepository.findOne({ where: { id: tripId } });
    const allowed = Boolean(
      trip &&
      (['super_admin', 'admin_operasional'].includes(socketUser.role) ||
        (socketUser.role === 'driver' && trip.driver_id === socketUser.id) ||
        (socketUser.role === 'tour_guide' &&
          trip.tour_guide_id === socketUser.id)),
    );
    if (!allowed) return { ok: false, message: 'Trip tidak ditemukan' };

    await client.join(`trip:${tripId}`);
    return { ok: true, tripId };
  }

  emitTripUpdate(trip: any) {
    const payload = {
      tripId: trip.id,
      bookingId: trip.booking_id,
      driverId: trip.driver_id,
      tourGuideId: trip.tour_guide_id,
      trip,
    };
    this.server?.to('admin-monitoring').emit('trip-updated', payload);
    this.server?.to(`trip:${trip.id}`).emit('trip-updated', payload);
    this.server?.to(`driver:${trip.driver_id}`).emit('trip-updated', payload);
    if (trip.tour_guide_id)
      this.server
        ?.to(`tour-guide:${trip.tour_guide_id}`)
        .emit('trip-updated', payload);
  }

  emitLocationUpdate(payload: any) {
    this.server?.to('admin-monitoring').emit('trip-location', payload);
    if (payload.tripId)
      this.server?.to(`trip:${payload.tripId}`).emit('trip-location', payload);
    if (payload.driverId)
      this.server
        ?.to(`driver:${payload.driverId}`)
        .emit('trip-location', payload);
    if (payload.tourGuideId)
      this.server
        ?.to(`tour-guide:${payload.tourGuideId}`)
        .emit('trip-location', payload);
  }
}
