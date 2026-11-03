import Link from 'next/link';
import type { DriverTrip } from '@/lib/api';
import { formatDate, formatTime, tripStatusLabels, tripTitle } from './driver-utils';

export default function DriverTripCard({ trip }: { trip: DriverTrip }) {
  const destinations = trip.itinerary_items?.filter((item) => item.stop_type === 'DESTINATION').length ?? 0;
  const pickup = trip.itinerary_items?.find((item) => item.stop_type === 'PICKUP');
  const route = trip.route_snapshot;
  return (
    <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(26,58,46,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold leading-snug text-slate-900">{tripTitle(trip)}</h3>
          <p className="mt-1 text-xs font-bold tracking-wide text-emerald-700">{trip.booking_reference}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
          {tripStatusLabels[trip.trip_status]}
        </span>
      </div>
      <p className="mt-4 text-xs text-slate-400">{formatDate(trip.driver_ready_at)}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Info label="Driver Siap" value={formatTime(trip.driver_ready_at)} />
        <Info label="Jadwal Wisatawan" value={formatTime(trip.scheduled_user_pickup_at)} />
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Penjemputan</p>
        <p className="mt-1 text-sm font-semibold text-slate-700">{pickup?.name ?? '-'}</p>
      </div>
      {route && (
        <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="font-bold uppercase">Rute {route.route_status === 'final' ? 'final' : 'perlu diperbarui'}</p>
          <p className="mt-1">{route.total_distance_km ? `${Number(route.total_distance_km).toFixed(2)} km` : '-'} • {route.total_duration_minutes ? `${Math.round(Number(route.total_duration_minutes))} menit` : '-'}</p>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{destinations} destinasi</span>
        <span>{trip.sakoci?.code || trip.sakoci?.name} • {trip.sakoci?.plate_number || '-'}</span>
      </div>
      <Link href={`/driver/tasks/${trip.id}`} className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-[#1a3a2e] px-4 text-sm font-bold text-white">
        Buka Tugas
      </Link>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
