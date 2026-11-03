import type { DriverTrip, TripItineraryItem, TripStatus } from '@/lib/api';

export const tripStatusLabels: Record<TripStatus, string> = {
  ASSIGNED: 'Ditugaskan',
  ACCEPTED: 'Tugas Diterima',
  EN_ROUTE_TO_PICKUP: 'Menuju Lokasi Penjemputan',
  AT_PICKUP: 'Tiba di Lokasi Penjemputan',
  EN_ROUTE_TO_DESTINATION: 'Menuju Destinasi',
  AT_DESTINATION: 'Sedang di Destinasi',
  EN_ROUTE_TO_ENDPOINT: 'Menuju Titik Akhir',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  ISSUE_REPORTED: 'Kendala Dilaporkan',
};

export function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    ...options,
  }).format(new Date(value));
}

export function formatTime(value?: string | null) {
  if (!value) return '-';
  return `${new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value)).replace('.', ':')} WIB`;
}

export function formatDuration(minutes?: number | null) {
  const value = Math.max(0, Number(minutes ?? 0));
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!hours) return `${rest} menit`;
  if (!rest) return `${hours} jam`;
  return `${hours} jam ${rest} menit`;
}

export function tripTitle(trip: DriverTrip) {
  return trip.booking?.tour_package?.name
    ?? trip.booking?.rental_option?.name
    ?? (trip.booking?.booking_type === 'private' ? 'Private Tour CimHeritage' : 'Perjalanan Sakoci');
}

export function activeItem(trip: DriverTrip) {
  return trip.itinerary_items?.find((item) => item.id === trip.current_itinerary_item_id)
    ?? trip.itinerary_items?.find((item) => item.stop_status === 'PENDING')
    ?? null;
}

export function actionForTrip(trip: DriverTrip): {
  label: string;
  action: 'ACCEPT_TASK' | 'START_TO_PICKUP' | 'CONFIRM_ARRIVAL_PICKUP' | 'START_TOUR' | 'CONFIRM_ARRIVAL_STOP' | 'START_NEXT_STOP' | 'COMPLETE_TRIP';
  itineraryItemId?: number;
  nextItineraryItemId?: number;
  confirm?: boolean;
} | null {
  const current = activeItem(trip);
  if (trip.trip_status === 'ASSIGNED') return { label: 'Terima Tugas', action: 'ACCEPT_TASK' };
  if (trip.trip_status === 'ACCEPTED') return { label: 'Mulai Menuju Lokasi Penjemputan', action: 'START_TO_PICKUP', confirm: true };
  if (trip.trip_status === 'EN_ROUTE_TO_PICKUP') return { label: 'Saya Sudah Tiba', action: 'CONFIRM_ARRIVAL_PICKUP', confirm: true };
  if (trip.trip_status === 'AT_PICKUP') return { label: 'Mulai Perjalanan', action: 'START_TOUR', confirm: true };
  if (trip.trip_status === 'EN_ROUTE_TO_DESTINATION') {
    return { label: `Saya Sudah Tiba di ${current?.name ?? 'Destinasi'}`, action: 'CONFIRM_ARRIVAL_STOP', itineraryItemId: current?.id, confirm: true };
  }
  if (trip.trip_status === 'AT_DESTINATION') {
    const next = nextPending(trip, current);
    if (next) return {
      label: next.stop_type === 'ENDPOINT' ? 'Menuju Titik Akhir' : `Lanjut ke ${next.name}`,
      action: 'START_NEXT_STOP',
      nextItineraryItemId: next.id,
      confirm: true,
    };
    return { label: 'Selesaikan Perjalanan', action: 'COMPLETE_TRIP', confirm: true };
  }
  if (trip.trip_status === 'EN_ROUTE_TO_ENDPOINT') {
    if (current?.stop_status === 'ARRIVED') return { label: 'Selesaikan Perjalanan', action: 'COMPLETE_TRIP', confirm: true };
    return { label: 'Saya Sudah Tiba di Titik Akhir', action: 'CONFIRM_ARRIVAL_STOP', itineraryItemId: current?.id, confirm: true };
  }
  return null;
}

function nextPending(trip: DriverTrip, current: TripItineraryItem | null) {
  return [...(trip.itinerary_items ?? [])]
    .filter((item) => item.sequence > Number(current?.sequence ?? -1) && item.stop_status === 'PENDING')
    .sort((a, b) => a.sequence - b.sequence)[0];
}
