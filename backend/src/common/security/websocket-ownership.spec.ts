import { BookingGateway } from '../../modules/booking/booking.gateway';
import { DriverTripGateway } from '../../modules/driver-trip/driver-trip.gateway';
import { UserRole } from '../enums/user-role.enum';

describe('WebSocket room ownership', () => {
  const activeUser = (id: number, role: UserRole) => ({
    id,
    active: true,
    account_status: 'normal',
    role: { name: role },
  });

  it('does not let Customer A join Customer B booking room', async () => {
    const gateway: any = Object.create(BookingGateway.prototype);
    gateway.userRepository = {
      findOne: jest.fn().mockResolvedValue(activeUser(1, UserRole.CUSTOMER)),
    };
    gateway.bookingService = {
      assertBookingAccessById: jest
        .fn()
        .mockRejectedValue(new Error('not owned')),
    };
    const client: any = {
      data: { user: { id: 1, role: UserRole.CUSTOMER } },
      join: jest.fn(),
    };

    await expect(
      gateway.joinBooking(client, { bookingId: 20 }),
    ).resolves.toEqual({
      ok: false,
      message: 'Booking tidak ditemukan',
    });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('does not let Driver A join Driver B trip room', async () => {
    const gateway: any = Object.create(DriverTripGateway.prototype);
    gateway.userRepository = {
      findOne: jest.fn().mockResolvedValue(activeUser(11, UserRole.DRIVER)),
    };
    gateway.tripRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 7, driver_id: 22, tour_guide_id: 33 }),
    };
    const client: any = {
      data: { user: { id: 11, role: UserRole.DRIVER } },
      join: jest.fn(),
      disconnect: jest.fn(),
    };

    await expect(gateway.joinTrip(client, { tripId: 7 })).resolves.toEqual({
      ok: false,
      message: 'Trip tidak ditemukan',
    });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('allows a driver to join only their assigned trip room', async () => {
    const gateway: any = Object.create(DriverTripGateway.prototype);
    gateway.userRepository = {
      findOne: jest.fn().mockResolvedValue(activeUser(11, UserRole.DRIVER)),
    };
    gateway.tripRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 7, driver_id: 11, tour_guide_id: 33 }),
    };
    const client: any = {
      data: { user: { id: 11, role: UserRole.DRIVER } },
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };

    await expect(gateway.joinTrip(client, { tripId: 7 })).resolves.toEqual({
      ok: true,
      tripId: 7,
    });
    expect(client.join).toHaveBeenCalledWith('trip:7');
  });

  it('does not let Guide A join Guide B trip room', async () => {
    const gateway: any = Object.create(DriverTripGateway.prototype);
    gateway.userRepository = {
      findOne: jest.fn().mockResolvedValue(activeUser(33, UserRole.TOUR_GUIDE)),
    };
    gateway.tripRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 7, driver_id: 11, tour_guide_id: 44 }),
    };
    const client: any = {
      data: { user: { id: 33, role: UserRole.TOUR_GUIDE } },
      join: jest.fn(),
      disconnect: jest.fn(),
    };

    await expect(gateway.joinTrip(client, { tripId: 7 })).resolves.toEqual({
      ok: false,
      message: 'Trip tidak ditemukan',
    });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects a booking socket when the handshake token is expired', async () => {
    const gateway: any = Object.create(BookingGateway.prototype);
    gateway.jwtService = {
      verify: jest.fn(() => {
        throw new Error('jwt expired');
      }),
    };
    const client: any = {
      handshake: { auth: { token: 'expired-token' }, headers: {}, query: {} },
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects a trip socket when handshake JWT verification fails', async () => {
    const gateway: any = Object.create(DriverTripGateway.prototype);
    gateway.jwt = {
      verify: jest.fn(() => {
        throw new Error('invalid');
      }),
    };
    const client: any = {
      handshake: { auth: {}, headers: {} },
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects an inactive account after a valid socket token', async () => {
    const gateway: any = Object.create(DriverTripGateway.prototype);
    gateway.jwt = {
      verify: jest.fn().mockReturnValue({ sub: 11, role: UserRole.DRIVER }),
    };
    gateway.userRepository = {
      findOne: jest.fn().mockResolvedValue({
        ...activeUser(11, UserRole.DRIVER),
        active: false,
      }),
    };
    const client: any = {
      handshake: { auth: { token: 'valid-token' }, headers: {} },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects when the JWT role no longer matches the database role', async () => {
    const gateway: any = Object.create(DriverTripGateway.prototype);
    gateway.jwt = {
      verify: jest.fn().mockReturnValue({ sub: 11, role: UserRole.DRIVER }),
    };
    gateway.userRepository = {
      findOne: jest.fn().mockResolvedValue(activeUser(11, UserRole.TOUR_GUIDE)),
    };
    const client: any = {
      handshake: { auth: { token: 'valid-token' }, headers: {} },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });
});
