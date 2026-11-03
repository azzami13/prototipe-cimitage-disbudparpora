import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DriverTripService } from './driver-trip.service';

describe('Driver and guide trip security', () => {
  let service: any;

  beforeEach(() => {
    service = Object.create(DriverTripService.prototype);
    service.findOne = jest.fn().mockResolvedValue({
      id: 7,
      driver_id: 22,
      tour_guide_id: 33,
      trip_status: 'ACCEPTED',
      incidents: [],
    });
  });

  it('hides Driver B trip from Driver A with 404', async () => {
    await expect(service.ownedTrip(7, 11)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hides Guide B trip from Guide A with 404', async () => {
    await expect(service.ownedGuideTrip(7, 12)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uses JWT identity for an incident and ignores reporter fields from body', async () => {
    service.requireDriver = jest
      .fn()
      .mockReturnValue({ userId: 22, role: 'driver' });
    service.ownedTrip = jest.fn().mockResolvedValue({
      id: 7,
      driver_id: 22,
      trip_status: 'ACCEPTED',
    });
    service.incidentRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 90, ...value })),
    };
    service.addHistory = jest.fn().mockResolvedValue(undefined);
    service.gateway = { emitTripUpdate: jest.fn() };

    await service.reportIncident('Bearer signed-token', 7, {
      issue_type: 'vehicle',
      description: 'Ban bocor',
      reported_by_user_id: 999,
      reporter_role: 'super_admin',
    });

    expect(service.incidentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reported_by_user_id: 22,
        reporter_role: 'driver',
        driver_id: 22,
      }),
    );
  });

  it('rejects driver incident reports for completed trips', async () => {
    service.requireDriver = jest
      .fn()
      .mockReturnValue({ userId: 22, role: 'driver' });
    service.ownedTrip = jest.fn().mockResolvedValue({
      id: 7,
      driver_id: 22,
      trip_status: 'COMPLETED',
    });
    service.incidentRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    await expect(
      service.reportIncident('Bearer signed-token', 7, {
        issue_type: 'vehicle',
        description: 'Ban bocor',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.incidentRepo.save).not.toHaveBeenCalled();
  });

  it('rejects driver location updates for completed trips', async () => {
    service.requireDriver = jest
      .fn()
      .mockReturnValue({ userId: 22, role: 'driver' });
    service.ownedTrip = jest.fn().mockResolvedValue({
      id: 7,
      booking_id: 70,
      sakoci_id: 5,
      driver_id: 22,
      trip_status: 'COMPLETED',
      tracking_active: false,
      booking: { status: 'completed' },
    });
    service.locationRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    await expect(
      service.location('Bearer signed-token', 7, {
        latitude: -6.8,
        longitude: 107.5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.locationRepo.save).not.toHaveBeenCalled();
  });

  it('rejects guide incident reports for cancelled trips', async () => {
    service.requireGuide = jest
      .fn()
      .mockReturnValue({ userId: 33, role: 'tour_guide' });
    service.ownedGuideTrip = jest.fn().mockResolvedValue({
      id: 7,
      tour_guide_id: 33,
      trip_status: 'CANCELLED',
    });
    service.incidentRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    await expect(
      service.guideIncident('Bearer signed-token', 7, {
        issue_type: 'Cuaca',
        description: 'Hujan deras',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.incidentRepo.save).not.toHaveBeenCalled();
  });

  it('does not expose route edge and node internals to driver or guide responses', () => {
    const trip = {
      id: 7,
      route_snapshot: {
        route_status: 'final',
        segments: [
          {
            label: 'Pickup ke destinasi',
            edgeSteps: [{ edgeId: 10 }],
            pathNodeIds: [1, 2, 3],
            alternatives: [{ edgeSteps: [] }],
          },
        ],
      },
      incidents: [],
    };

    const sanitized = service.sanitizeTripUsers(trip, 'driver');

    expect(sanitized.route_snapshot.segments[0]).toEqual({
      label: 'Pickup ke destinasi',
    });
  });

  it('does not mark booking in_progress while driver is only heading to pickup', async () => {
    const trip = {
      id: 7,
      booking_id: 70,
      driver_id: 22,
      trip_status: 'ACCEPTED',
      itinerary_items: [
        { id: 1, sequence: 1, stop_type: 'PICKUP', stop_status: 'PENDING' },
      ],
      incidents: [],
    };
    service.requireDriver = jest
      .fn()
      .mockReturnValue({ userId: 22, role: 'driver' });
    service.ownedTrip = jest.fn().mockResolvedValue(trip);
    service.itemRepo = { save: jest.fn(async (value) => value) };
    service.tripRepo = { save: jest.fn(async (value) => value) };
    service.bookingRepo = { update: jest.fn() };
    service.addHistory = jest.fn().mockResolvedValue(undefined);
    service.gateway = { emitTripUpdate: jest.fn() };

    await service.action('Bearer signed-token', 7, {
      action: 'START_TO_PICKUP',
    });

    expect(trip.trip_status).toBe('EN_ROUTE_TO_PICKUP');
    expect(service.bookingRepo.update).not.toHaveBeenCalled();
  });

  it('marks booking in_progress when the actual tour starts', async () => {
    const trip = {
      id: 7,
      booking_id: 70,
      driver_id: 22,
      trip_status: 'AT_PICKUP',
      itinerary_items: [
        { id: 1, sequence: 1, stop_type: 'PICKUP', stop_status: 'ARRIVED' },
        {
          id: 2,
          sequence: 2,
          stop_type: 'DESTINATION',
          stop_status: 'PENDING',
        },
      ],
      incidents: [],
    };
    service.requireDriver = jest
      .fn()
      .mockReturnValue({ userId: 22, role: 'driver' });
    service.ownedTrip = jest.fn().mockResolvedValue(trip);
    service.itemRepo = { save: jest.fn(async (value) => value) };
    service.tripRepo = { save: jest.fn(async (value) => value) };
    service.bookingRepo = { update: jest.fn() };
    service.addHistory = jest.fn().mockResolvedValue(undefined);
    service.gateway = { emitTripUpdate: jest.fn() };

    await service.action('Bearer signed-token', 7, { action: 'START_TOUR' });

    expect(trip.trip_status).toBe('EN_ROUTE_TO_DESTINATION');
    expect(service.bookingRepo.update).toHaveBeenCalledWith(70, {
      status: 'in_progress',
    });
  });

  it('requires a reason when skipping an itinerary destination', async () => {
    service.requireDriver = jest
      .fn()
      .mockReturnValue({ userId: 22, role: 'driver' });
    service.ownedTrip = jest.fn().mockResolvedValue({
      id: 7,
      driver_id: 22,
      trip_status: 'AT_DESTINATION',
      current_itinerary_item_id: 2,
      itinerary_items: [
        {
          id: 2,
          sequence: 2,
          stop_type: 'DESTINATION',
          stop_status: 'VISITING',
        },
      ],
      incidents: [],
    });

    await expect(
      service.action('Bearer signed-token', 7, { action: 'SKIP_STOP' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
