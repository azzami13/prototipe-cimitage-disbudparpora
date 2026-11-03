import type { DriverTrip, TripGuideSession, TripItineraryItem } from '@/lib/api';
import { activeItem, formatDate, formatDuration, formatTime, tripStatusLabels, tripTitle } from '@/components/driver/driver-utils';

export { activeItem, formatDate, formatDuration, formatTime, tripStatusLabels, tripTitle };

export const guideSessionLabels: Record<string, string> = {
  PENDING: 'Menunggu Sakoci Tiba',
  READY: 'Siap Dimulai',
  IN_PROGRESS: 'Sesi Penjelasan Berlangsung',
  COMPLETED: 'Sesi Destinasi Selesai',
  SKIPPED: 'Sesi Dilewati',
};

export function sessionForItem(trip: DriverTrip, item?: TripItineraryItem | null): TripGuideSession | null {
  if (!item) return null;
  return trip.guide_sessions?.find((session) => session.itinerary_item_id === item.id) ?? null;
}

export function currentGuideStatus(trip: DriverTrip) {
  const current = activeItem(trip);
  const session = sessionForItem(trip, current);
  if (!trip.tour_guide_id) return 'Tanpa Tour Guide';
  if (!session) return 'Belum Ada Sesi';
  return guideSessionLabels[session.session_status] ?? session.session_status;
}
