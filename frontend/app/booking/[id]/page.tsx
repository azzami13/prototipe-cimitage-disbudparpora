'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, Booking, HeritageSite, RentalOption, RouteSnapshot } from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu konfirmasi admin',
  confirmed: 'Dikonfirmasi',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export default function BookingConfirmationPage({ params }: { params: { id: string } }) {
  const bookingId = Number(params.id);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [rentalOptions, setRentalOptions] = useState<RentalOption[]>([]);
  const [sites, setSites] = useState<HeritageSite[]>([]);
  const [routeSnapshot, setRouteSnapshot] = useState<RouteSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isInteger(bookingId) || bookingId < 1) {
      setError('Nomor booking tidak valid');
      setLoading(false);
      return;
    }

    Promise.all([
      api.bookings.one(bookingId),
      api.rentalOptions.list(true).catch(() => []),
      api.heritage.list({ limit: '200' }).catch(() => ({ data: [] as HeritageSite[] })),
      api.bookings.route(bookingId).catch(() => null),
    ])
      .then(([bookingData, rentalData, heritageData, routeData]) => {
        setBooking(bookingData);
        setRentalOptions(rentalData);
        setSites(heritageData.data ?? []);
        setRouteSnapshot(routeData);
      })
      .catch((err: any) => setError(err.message ?? 'Gagal memuat pesanan'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const rental = rentalOptions.find((item) => item.id === booking?.rental_option_id);
  const privateSites = useMemo(() => {
    const ids = booking?.private_destination_ids ?? [];
    return ids
      .map((id) => sites.find((site) => site.id === id))
      .filter(Boolean) as HeritageSite[];
  }, [booking?.private_destination_ids, sites]);

  const fmtMoney = (value?: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value ?? 0));

  const fmtDate = (value?: string) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const serviceName = () => {
    if (!booking) return '-';
    if (booking.booking_type === 'package') return booking.tour_package?.name ?? 'Paket wisata';
    if (booking.booking_type === 'rental') return rental?.name ?? 'Sewa wisata';
    return 'Private tour';
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-12 text-gray-500">Memuat detail pesanan...</div>;
  }

  if (error || !booking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-[#1a3a2e] mb-2">Pesanan Tidak Ditemukan</h1>
        <p className="text-gray-500 mb-6">{error || 'Data booking tidak tersedia.'}</p>
        <a href="/booking" className="inline-block bg-[#1a3a2e] text-white px-5 py-2.5 rounded-lg font-semibold">
          Kembali ke Pemesanan
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm text-gray-500">Nomor Booking #{booking.id}</p>
          <h1 className="text-3xl font-bold text-[#1a3a2e]">Pesanan Berhasil Dibuat</h1>
        </div>
        <a
          href={`/booking/${booking.id}/receipt`}
          className="bg-[#1a3a2e] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#2d6a4f]"
        >
          Buka Receipt
        </a>
      </div>

      <section className="bg-white rounded-xl shadow p-6 mb-5 receipt-area">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b pb-5 mb-5">
          <div>
            <p className="text-sm text-gray-500">CimHeritage Receipt</p>
            <h2 className="text-2xl font-bold text-[#1a3a2e]">Booking #{booking.id}</h2>
            <p className="text-sm text-gray-500">Dibuat pada {fmtDate(booking.created_at)}</p>
          </div>
          <div className="text-left md:text-right">
            <span className="inline-block rounded-full bg-yellow-100 text-yellow-800 px-3 py-1 text-sm font-semibold">
              Pembayaran Belum Dibayar
            </span>
            <p className="text-sm text-gray-500 mt-2">{STATUS_LABEL[booking.status] ?? booking.status}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <InfoBlock title="Data Pemesan">
            <InfoRow label="Nama rombongan" value={booking.group_name} />
            <InfoRow label="Email" value={booking.contact_email ?? '-'} />
            <InfoRow label="No. HP / WhatsApp" value={booking.contact_phone ?? '-'} />
            <InfoRow label="Jumlah pengguna" value={`${booking.participants} orang`} />
          </InfoBlock>

          <InfoBlock title="Detail Layanan">
            <InfoRow label="Jenis layanan" value={booking.booking_type ?? 'package'} />
            <InfoRow label="Layanan" value={serviceName()} />
            <InfoRow label="Tanggal" value={fmtDate(booking.visit_date)} />
            <InfoRow label="Jam jemput" value={booking.pickup_time ?? '-'} />
            <InfoRow label="Total" value={fmtMoney(booking.total_price)} strong />
          </InfoBlock>
        </div>

        {(booking.pickup_location || booking.pickup_maps_url) && (
          <InfoBlock title="Titik Jemput" className="mt-5">
            <InfoRow label="Lokasi" value={booking.pickup_location ?? '-'} />
            <InfoRow label="Koordinat" value={booking.pickup_latitude && booking.pickup_longitude ? `${booking.pickup_latitude}, ${booking.pickup_longitude}` : '-'} />
            {booking.pickup_maps_url && (
              <a href={booking.pickup_maps_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline print:text-black">
                Buka titik jemput di Google Maps
              </a>
            )}
          </InfoBlock>
        )}

        {booking.tour_package && (
          <InfoBlock title="Detail Paket" className="mt-5">
            <InfoRow label="Kode paket" value={booking.tour_package.code} />
            <InfoRow label="Nama paket" value={booking.tour_package.name} />
            <InfoRow label="Durasi" value={booking.tour_package.duration_hours ? `${booking.tour_package.duration_hours} jam` : '-'} />
            {booking.tour_package.description && <p className="text-sm text-gray-600 mt-2">{booking.tour_package.description}</p>}
            {booking.tour_package.routes?.length > 0 && (
              <ol className="mt-3 space-y-2 text-sm text-gray-700 list-decimal list-inside">
                {booking.tour_package.routes
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((route) => (
                    <li key={route.id}>{route.heritage_site?.name ?? `Tujuan #${route.heritage_site_id}`}</li>
                  ))}
              </ol>
            )}
          </InfoBlock>
        )}

        {privateSites.length > 0 && (
          <InfoBlock title="Tujuan Private Tour" className="mt-5">
            <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
              {privateSites.map((site) => (
                <li key={site.id}>{site.name}</li>
              ))}
            </ol>
          </InfoBlock>
        )}

        <InfoBlock title="Pemantauan Pesanan" className="mt-5">
          <div className="grid md:grid-cols-3 gap-3">
            <StatusCard label="Status pesanan" value={STATUS_LABEL[booking.status] ?? booking.status} />
            <StatusCard label="Driver" value="Menunggu penugasan" />
            <StatusCard label="Tour guide" value="Menunggu penugasan" />
          </div>
        </InfoBlock>

        <InfoBlock title="Rute Perjalanan" className="mt-5">
          {routeSnapshot?.routeStatus === 'final' ? (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <StatusCard label="Total jarak" value={`${Number(routeSnapshot.totalDistanceKm ?? 0).toFixed(2)} km`} />
                <StatusCard label="Estimasi durasi" value={routeSnapshot.totalDurationMinutes ? `${Math.round(Number(routeSnapshot.totalDurationMinutes))} menit` : '-'} />
              </div>
              {routeSnapshot.orderedDestinationIds?.length ? (
                <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                  {routeSnapshot.orderedDestinationIds.map((id) => {
                    const site = [...privateSites, ...(booking.tour_package?.routes ?? []).map((route) => route.heritage_site)].find((candidate) => candidate?.id === id);
                    return <li key={id}>{site?.name ?? `Destinasi #${id}`}</li>;
                  })}
                </ol>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Urutan perjalanan dan rute optimal akan ditentukan setelah pesanan diverifikasi.</p>
          )}
        </InfoBlock>

        {booking.notes && (
          <InfoBlock title="Catatan" className="mt-5">
            <p className="text-sm text-gray-600">{booking.notes}</p>
          </InfoBlock>
        )}
      </section>

      <div className="flex gap-3 print:hidden">
        <a href="/booking" className="border border-[#1a3a2e] text-[#1a3a2e] px-5 py-2.5 rounded-lg font-semibold">
          Buat Booking Lain
        </a>
        <a href="/paket" className="text-gray-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-100">
          Lihat Paket
        </a>
      </div>
    </div>
  );
}

function InfoBlock({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      <h3 className="font-bold text-[#1a3a2e] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`text-right ${strong ? 'font-bold text-[#1a3a2e]' : 'font-medium text-gray-800'}`}>{value}</span>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  );
}
