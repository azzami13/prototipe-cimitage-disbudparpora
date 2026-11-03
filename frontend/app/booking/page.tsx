'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, AuthUser, BookingAvailability, CreateBookingBody, HeritageSite, OptimizeRouteV2Result, RentalOption, TourPackage } from '@/lib/api';
import PickupMapPicker from '@/components/maps/PickupMapPicker';
import RoutePreviewMap from '@/components/maps/RoutePreviewMap';
import { useBackendReadiness } from '@/components/providers/BackendReadinessProvider';

type BookingMode = 'package' | 'rental' | 'private';

type FormState = {
  group_name: string;
  contact_email: string;
  password: string;
  nik: string;
  birth_place: string;
  birth_date: string;
  domicile: string;
  ktp_address: string;
  contact_phone: string;
  notes: string;
  tour_package_id?: number;
  rental_option_id?: number;
  visit_date: string;
  pickup_time: string;
  pickup_location: string;
  pickup_maps_url: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  participants: number;
  private_destination_ids: number[];
};

const EMPTY_FORM: FormState = {
  group_name: '',
  contact_email: '',
  password: '',
  nik: '',
  birth_place: '',
  birth_date: '',
  domicile: '',
  ktp_address: '',
  contact_phone: '',
  notes: '',
  visit_date: '',
  pickup_time: '',
  pickup_location: '',
  pickup_maps_url: '',
  participants: 1,
  private_destination_ids: [],
};
const BOOKING_DRAFT_KEY = 'cimitage.bookingDraft.v1';

function jakartaTodayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-10" />}>
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const { status: backendStatus } = useBackendReadiness();
  const backendReady = backendStatus === 'ready';
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('package');

  const [mode, setMode] = useState<BookingMode | null>(null);
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [rentalOptions, setRentalOptions] = useState<RentalOption[]>([]);
  const [sites, setSites] = useState<HeritageSite[]>([]);
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    tour_package_id: packageId ? Number(packageId) : undefined,
  });
  const [siteSearch, setSiteSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [routePreview, setRoutePreview] = useState<OptimizeRouteV2Result | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [availability, setAvailability] = useState<BookingAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [fixedEndId, setFixedEndId] = useState<number | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const todayKey = useMemo(() => jakartaTodayKey(), []);

  useEffect(() => {
    Promise.all([
      api.packages.listActive(),
      api.rentalOptions.list(true),
      api.heritage.list({ limit: '200' }),
    ]).then(([pkgRes, rentalRes, heritageRes]) => {
      const pkgs = Array.isArray(pkgRes) ? pkgRes : pkgRes.data ?? [];
      setPackages(pkgs);
      setRentalOptions(rentalRes);
      setSites(heritageRes.data ?? []);

      if (packageId) {
        const pkg = pkgs.find((p) => p.id === Number(packageId));
        if (pkg) {
          setMode('package');
          setForm((f) => ({ ...f, tour_package_id: pkg.id }));
        }
      }
    });
  }, [packageId]);

  useEffect(() => {
    api.auth.me()
      .then((user) => {
        setCurrentUser(user);
        const rawDraft = sessionStorage.getItem(BOOKING_DRAFT_KEY);
        if (rawDraft) {
          const draft = JSON.parse(rawDraft) as { mode?: BookingMode; form?: Partial<FormState> };
          if (draft.mode) setMode(draft.mode);
          if (draft.form) setForm((current) => ({ ...current, ...draft.form, password: '' }));
          sessionStorage.removeItem(BOOKING_DRAFT_KEY);
        } else {
          setForm((current) => ({
            ...current,
            contact_email: current.contact_email || user.email || '',
            group_name: current.group_name || user.name || '',
          }));
        }
      })
      .catch(() => setCurrentUser(null));
  }, []);

  const selectedPackage = packages.find((p) => p.id === form.tour_package_id);
  const selectedRental = rentalOptions.find((r) => r.id === form.rental_option_id);
  const packageDestinationIds = useMemo(
    () =>
      (selectedPackage?.routes ?? [])
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((route) => route.heritage_site_id)
        .filter(Boolean),
    [selectedPackage],
  );
  const previewDestinationIds =
    mode === 'package' ? packageDestinationIds : form.private_destination_ids;
  const previewDestinationOptions = previewDestinationIds
    .map((id) => sites.find((site) => site.id === id) ?? selectedPackage?.routes?.find((route) => route.heritage_site_id === id)?.heritage_site)
    .filter(Boolean) as HeritageSite[];
  const filteredSites = siteSearch
    ? sites.filter((s) => s.name.toLowerCase().includes(siteSearch.toLowerCase()))
    : sites;

  const totalPrice = useMemo(() => {
    if (mode === 'package' && selectedPackage) {
      return Number(selectedPackage.price_per_person) * form.participants;
    }
    if (mode === 'rental' && selectedRental) {
      return Number(selectedRental.base_price) + Number(selectedRental.price_per_person) * form.participants;
    }
    return 0;
  }, [form.participants, mode, selectedPackage, selectedRental]);

  const estimatedDurationMinutes = useMemo(() => {
    if (mode === 'package') return Math.max(1, Math.round(Number(selectedPackage?.duration_hours ?? 2) * 60));
    if (mode === 'private') return Math.max(120, form.private_destination_ids.length * 60);
    return 120;
  }, [form.private_destination_ids.length, mode, selectedPackage?.duration_hours]);

  useEffect(() => {
    setAvailability(null);
    setAvailabilityError('');
    if (!backendReady || !mode || !form.visit_date || !form.pickup_time) return;
    if (mode === 'package' && !form.tour_package_id) return;
    if (mode === 'private' && form.private_destination_ids.length < 1) return;

    const timer = window.setTimeout(() => {
      setAvailabilityLoading(true);
      api.bookings.availability({
        booking_type: mode,
        tour_package_id: form.tour_package_id ? String(form.tour_package_id) : undefined,
        visit_date: form.visit_date,
        pickup_time: form.pickup_time,
        duration_minutes: String(estimatedDurationMinutes),
        destination_count: String(form.private_destination_ids.length || 1),
        participants: String(form.participants || 0),
      })
        .then(setAvailability)
        .catch((err) => setAvailabilityError(err.message ?? 'Gagal mengecek jadwal'))
        .finally(() => setAvailabilityLoading(false));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [backendReady, estimatedDurationMinutes, form.participants, form.pickup_time, form.private_destination_ids.length, form.tour_package_id, form.visit_date, mode]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setRoutePreview(null);
    setPreviewError('');
    setAvailability(null);
    setAvailabilityError('');
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  const switchMode = (nextMode: BookingMode) => {
    setMode(nextMode);
    setErrors({});
    setRoutePreview(null);
    setPreviewError('');
    setFixedEndId('');
  };

  const toggleDestination = (id: number) => {
    setForm((f) => ({
      ...f,
      private_destination_ids: f.private_destination_ids.includes(id)
        ? f.private_destination_ids.filter((x) => x !== id)
        : [...f.private_destination_ids, id],
    }));
    setRoutePreview(null);
    setPreviewError('');
    setFixedEndId((current) => (current === id ? '' : current));
  };

  const previewRoute = async () => {
    setRoutePreview(null);
    setPreviewError('Urutan perjalanan dan rute optimal akan ditentukan setelah pesanan diverifikasi.');
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.group_name.trim()) e.group_name = 'Nama rombongan wajib diisi';
    if (!form.contact_email.trim()) e.contact_email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) e.contact_email = 'Format email tidak valid';
    if (!currentUser) {
      if (!form.password.trim()) e.password = 'Password wajib diisi';
      else if (form.password.trim().length < 6) e.password = 'Password minimal 6 karakter';
      if (!form.nik.trim()) e.nik = 'NIK wajib diisi';
      if (!form.birth_place.trim()) e.birth_place = 'Tempat lahir wajib diisi';
      if (!form.birth_date) e.birth_date = 'Tanggal lahir wajib diisi';
      if (!form.domicile.trim()) e.domicile = 'Domisili saat ini wajib diisi';
      if (!form.ktp_address.trim()) e.ktp_address = 'Alamat sesuai KTP wajib diisi';
    }
    if (!form.participants || form.participants < 1) e.participants = 'Minimal 1 pengguna';
    if (availability?.maxParticipantsPerBooking && form.participants > availability.maxParticipantsPerBooking) {
      e.participants = `Maksimal ${availability.maxParticipantsPerBooking} peserta sesuai kapasitas Sakoci`;
    }

    if (mode === 'package') {
      if (!form.tour_package_id) e.tour_package_id = 'Pilih paket wisata';
    }
    if (mode === 'rental') {
      if (!form.rental_option_id) e.rental_option_id = 'Pilih opsi sewa';
      if (!form.pickup_location.trim()) e.pickup_location = 'Tempat jemput wajib diisi';
      if (!form.pickup_maps_url.trim()) e.pickup_maps_url = 'Tag/link maps wajib diisi';
      if (!form.pickup_latitude || !form.pickup_longitude) e.pickup_maps_url = 'Pilih titik jemput di peta';
    }
    if (mode === 'private') {
      if (!form.pickup_location.trim()) e.pickup_location = 'Tempat jemput wajib diisi';
      if (!form.pickup_maps_url.trim()) e.pickup_maps_url = 'Tag/link maps wajib diisi';
      if (!form.pickup_latitude || !form.pickup_longitude) e.pickup_maps_url = 'Pilih titik jemput di peta';
      if (form.private_destination_ids.length < 1) e.private_destination_ids = 'Pilih minimal 1 tempat tujuan';
    }
    if (!form.visit_date) e.visit_date = 'Tanggal keberangkatan wajib dipilih';
    else if (form.visit_date < todayKey) e.visit_date = 'Tanggal perjalanan tidak boleh tanggal lampau';
    if (!form.pickup_time.trim()) e.pickup_time = 'Jam keberangkatan wajib diisi';
    if (availability && !availability.available) e.pickup_time = 'Jadwal keberangkatan sudah penuh';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!mode) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      const body: CreateBookingBody = {
        booking_type: mode,
        group_name: form.group_name.trim(),
        participants: Number(form.participants),
        password: form.password.trim(),
        nik: form.nik.trim(),
        birth_place: form.birth_place.trim(),
        birth_date: form.birth_date,
        domicile: form.domicile.trim(),
        ktp_address: form.ktp_address.trim(),
        contact_email: form.contact_email.trim().toLowerCase(),
        contact_phone: form.contact_phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (mode === 'package') {
        body.tour_package_id = form.tour_package_id;
        body.visit_date = form.visit_date;
        body.pickup_time = form.pickup_time;
        body.pickup_location = form.pickup_location.trim() || undefined;
        body.pickup_maps_url = form.pickup_maps_url.trim() || undefined;
        body.pickup_latitude = form.pickup_latitude;
        body.pickup_longitude = form.pickup_longitude;
      } else if (mode === 'rental') {
        body.rental_option_id = form.rental_option_id;
        body.visit_date = form.visit_date;
        body.pickup_time = form.pickup_time;
        body.pickup_location = form.pickup_location.trim();
        body.pickup_maps_url = form.pickup_maps_url.trim();
        body.pickup_latitude = form.pickup_latitude;
        body.pickup_longitude = form.pickup_longitude;
      } else if (mode === 'private') {
        body.visit_date = form.visit_date;
        body.pickup_time = form.pickup_time;
        body.pickup_location = form.pickup_location.trim();
        body.pickup_maps_url = form.pickup_maps_url.trim();
        body.pickup_latitude = form.pickup_latitude;
        body.pickup_longitude = form.pickup_longitude;
        body.private_destination_ids = form.private_destination_ids;
      }

      const booking = currentUser
        ? await api.bookings.createMine({ ...body, contact_email: currentUser.email })
        : await api.bookings.create(body);
      router.push(`/booking/${booking.id}`);
    } catch (err: any) {
      if (err.code === 'ACCOUNT_AUTHENTICATION_REQUIRED') {
        const { password, ...safeForm } = form;
        sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({ mode, form: safeForm }));
        alert('Email sudah terdaftar. Silakan login, lalu draft booking akan dilanjutkan otomatis.');
        router.push('/login?callbackUrl=/booking');
        return;
      }
      alert(err.message ?? 'Gagal membuat pesanan');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-[#1a3a2e] mb-2">Pemesanan Wisata</h1>
      <p className="text-gray-500 mb-6">Pilih jenis layanan terlebih dahulu.</p>

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <ModeButton active={mode === 'package'} title="Paket" desc="Pilih paket wisata yang sudah tersedia" onClick={() => switchMode('package')} />
        <ModeButton active={mode === 'rental'} title="Sewa" desc="Sewa kendaraan/layanan dengan jemput" onClick={() => switchMode('rental')} />
        <ModeButton active={mode === 'private'} title="Private" desc="Pilih sendiri tujuan heritage" onClick={() => switchMode('private')} />
      </div>

      {!mode && (
        <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
          Pilih salah satu layanan untuk mulai mengisi form.
        </div>
      )}

      {mode && <div className="bg-white rounded-2xl shadow p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nama Rombongan *" error={errors.group_name}>
            <input value={form.group_name} onChange={e => set('group_name', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Jumlah Pengguna *" error={errors.participants}>
            <input type="number" min={1} max={availability?.maxParticipantsPerBooking ?? undefined} value={form.participants} onChange={e => set('participants', Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Email *" error={errors.contact_email}>
            <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          {!currentUser && (
            <Field label="Password Akun *" error={errors.password}>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
          )}
          <Field label="No. HP / WhatsApp">
            <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
        </div>

        {!currentUser && <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
          <Field label="NIK *" error={errors.nik}>
            <input value={form.nik} onChange={e => set('nik', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Tempat Lahir *" error={errors.birth_place}>
            <input value={form.birth_place} onChange={e => set('birth_place', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Tanggal Lahir *" error={errors.birth_date}>
            <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Domisili Saat Ini *" error={errors.domicile}>
            <input value={form.domicile} onChange={e => set('domicile', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Alamat Saat Ini Sesuai KTP *" error={errors.ktp_address}>
              <textarea rows={3} value={form.ktp_address} onChange={e => set('ktp_address', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>
        </div>}

        {mode === 'package' && (
          <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
            <Field label="Paket Wisata *" error={errors.tour_package_id}>
              <select value={form.tour_package_id ?? ''} onChange={e => set('tour_package_id', Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Pilih paket</option>
                {packages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
              </select>
            </Field>
            <Field label="Tanggal Kunjungan *" error={errors.visit_date}>
              <input type="date" min={todayKey} value={form.visit_date} onChange={e => set('visit_date', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Jam Keberangkatan *" error={errors.pickup_time}>
              <input type="time" value={form.pickup_time} onChange={e => set('pickup_time', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <AvailabilityNotice
              loading={availabilityLoading}
              error={availabilityError}
              availability={availability}
              durationMinutes={estimatedDurationMinutes}
            />
            <div className="md:col-span-2">
              <Field label="Tempat Jemput" error={errors.pickup_location}>
                <input value={form.pickup_location} onChange={e => set('pickup_location', e.target.value)}
                  placeholder="Contoh: Stasiun Cimahi"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Pilih Titik Jemput di Peta" error={errors.pickup_maps_url}>
                <PickupMapPicker
                  value={{ lat: form.pickup_latitude, lng: form.pickup_longitude }}
                  onChange={(point) => {
                    setForm((f) => ({
                      ...f,
                      pickup_latitude: point.lat,
                      pickup_longitude: point.lng,
                      pickup_maps_url: point.mapsUrl,
                    }));
                    setRoutePreview(null);
                    setPreviewError('');
                    setErrors((e) => {
                      const next = { ...e };
                      delete next.pickup_maps_url;
                      return next;
                    });
                  }}
                />
                {form.pickup_maps_url && (
                  <a href={form.pickup_maps_url} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    Buka titik jemput di Google Maps
                  </a>
                )}
              </Field>
            </div>
          </div>
        )}

        {mode === 'rental' && (
          <div className="grid md:grid-cols-2 gap-4 pt-2 border-t">
            <Field label="Opsi Sewa *" error={errors.rental_option_id}>
              <select value={form.rental_option_id ?? ''} onChange={e => set('rental_option_id', Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Pilih opsi sewa</option>
                {rentalOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
              </select>
            </Field>
            <Field label="Tanggal Keberangkatan *" error={errors.visit_date}>
              <input type="date" min={todayKey} value={form.visit_date} onChange={e => set('visit_date', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Jam Keberangkatan *" error={errors.pickup_time}>
              <input type="time" value={form.pickup_time} onChange={e => set('pickup_time', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <AvailabilityNotice
              loading={availabilityLoading}
              error={availabilityError}
              availability={availability}
              durationMinutes={estimatedDurationMinutes}
            />
            <div className="md:col-span-2">
              <Field label="Tempat Jemput *" error={errors.pickup_location}>
                <input value={form.pickup_location} onChange={e => set('pickup_location', e.target.value)}
                  placeholder="Contoh: Stasiun Cimahi"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Pilih Titik Jemput di Peta *" error={errors.pickup_maps_url}>
                <PickupMapPicker
                  value={{ lat: form.pickup_latitude, lng: form.pickup_longitude }}
                  onChange={(point) => {
                    setForm((f) => ({
                      ...f,
                      pickup_latitude: point.lat,
                      pickup_longitude: point.lng,
                      pickup_maps_url: point.mapsUrl,
                    }));
                    setRoutePreview(null);
                    setPreviewError('');
                    setErrors((e) => {
                      const next = { ...e };
                      delete next.pickup_maps_url;
                      return next;
                    });
                  }}
                />
                {form.pickup_maps_url && (
                  <a href={form.pickup_maps_url} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    Buka titik jemput di Google Maps
                  </a>
                )}
              </Field>
            </div>
          </div>
        )}

        {mode === 'private' && (
          <div className="pt-2 border-t">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <Field label="Tanggal Keberangkatan *" error={errors.visit_date}>
                <input type="date" min={todayKey} value={form.visit_date} onChange={e => set('visit_date', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Jam Keberangkatan *" error={errors.pickup_time}>
                <input type="time" value={form.pickup_time} onChange={e => set('pickup_time', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <Field label="Tempat Jemput *" error={errors.pickup_location}>
                <input value={form.pickup_location} onChange={e => set('pickup_location', e.target.value)}
                  placeholder="Contoh: Stasiun Cimahi"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
              <AvailabilityNotice
                loading={availabilityLoading}
                error={availabilityError}
                availability={availability}
                durationMinutes={estimatedDurationMinutes}
              />
            </div>
            <Field label="Pilih Titik Jemput di Peta *" error={errors.pickup_maps_url}>
              <PickupMapPicker
                value={{ lat: form.pickup_latitude, lng: form.pickup_longitude }}
                onChange={(point) => {
                  setForm((f) => ({
                    ...f,
                    pickup_latitude: point.lat,
                    pickup_longitude: point.lng,
                    pickup_maps_url: point.mapsUrl,
                  }));
                  setRoutePreview(null);
                  setPreviewError('');
                  setErrors((e) => {
                    const next = { ...e };
                    delete next.pickup_maps_url;
                    return next;
                  });
                }}
              />
              {form.pickup_maps_url && (
                <a href={form.pickup_maps_url} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  Buka titik jemput di Google Maps
                </a>
              )}
            </Field>
            <Field label="Pilih Tempat Tujuan *" error={errors.private_destination_ids}>
              <input value={siteSearch} onChange={e => setSiteSearch(e.target.value)}
                placeholder="Cari situs heritage..."
                className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
              <div className="border rounded-lg max-h-64 overflow-y-auto divide-y">
                {filteredSites.slice(0, 80).map(site => {
                  const checked = form.private_destination_ids.includes(site.id);
                  const order = form.private_destination_ids.indexOf(site.id) + 1;
                  return (
                    <button key={site.id} type="button" onClick={() => toggleDestination(site.id)}
                      className={`w-full px-3 py-2 text-left flex gap-3 items-center ${checked ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${checked ? 'bg-[#1a3a2e] text-white' : 'border text-gray-400'}`}>
                        {checked ? order : '+'}
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{site.name}</span>
                        <span className="block text-xs text-gray-400">{site.category} · {site.kecamatan}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}

        {(mode === 'package' || mode === 'private') && (
          <div className="pt-2 border-t">
            <div className="bg-gray-50 border rounded-xl p-4 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="font-bold text-[#1a3a2e]">Finalisasi Rute</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Urutan perjalanan final dihitung admin setelah pembayaran diverifikasi.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={fixedEndId}
                    onChange={(e) => {
                      setFixedEndId(e.target.value ? Number(e.target.value) : '');
                      setRoutePreview(null);
                      setPreviewError('');
                    }}
                    className="border rounded-lg px-3 py-2 text-sm bg-white min-w-56"
                  >
                    <option value="">Destinasi akhir bebas</option>
                    {previewDestinationOptions.map((site) => (
                      <option key={site.id} value={site.id}>
                        Akhiri di {site.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={previewRoute}
                    className="bg-[#1a3a2e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2d6a4f]"
                  >
                    Info Finalisasi Rute
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                {previewDestinationIds.length} destinasi siap dihitung
              </div>

              {previewError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {previewError}
                </div>
              )}

              {routePreview && (
                <RoutePreviewResult
                  result={routePreview}
                  pickup={{
                    id: 'PICKUP',
                    name: form.pickup_location.trim() || 'Titik Jemput',
                    latitude: Number(form.pickup_latitude),
                    longitude: Number(form.pickup_longitude),
                  }}
                />
              )}
            </div>
          </div>
        )}

        <Field label="Catatan">
          <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Catatan tambahan untuk admin"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </Field>

        {(mode === 'package' || mode === 'rental') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex justify-between">
            <span className="text-sm text-gray-600">Estimasi Total</span>
            <strong className="text-[#1a3a2e]">{fmt(totalPrice)}</strong>
          </div>
        )}
        {mode === 'private' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            Private tour akan dikonfirmasi admin setelah tujuan dipilih.
          </div>
        )}

        {!backendReady && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Layanan pemesanan sedang dipersiapkan. Form tetap dapat Anda lihat sementara menunggu.</p>}
        <button onClick={submit} disabled={submitting || !backendReady || Boolean(availability && !availability.available)}
          className="w-full bg-[#1a3a2e] text-white py-3 rounded-xl font-semibold hover:bg-[#2d6a4f] disabled:opacity-50">
          {submitting ? 'Memproses...' : !backendReady ? 'Menyiapkan layanan…' : 'Konfirmasi Pesanan'}
        </button>
      </div>}
    </div>
  );
}

function ModeButton({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`text-left border-2 rounded-xl p-4 transition ${active ? 'border-[#1a3a2e] bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <span className="block font-bold text-[#1a3a2e]">{title}</span>
      <span className="block text-xs text-gray-500 mt-1">{desc}</span>
    </button>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function AvailabilityNotice({
  loading,
  error,
  availability,
  durationMinutes,
}: {
  loading: boolean;
  error: string;
  availability: BookingAvailability | null;
  durationMinutes: number;
}) {
  if (loading) {
    return <p className="md:col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">Mengecek ketersediaan jadwal...</p>;
  }
  if (error) {
    return <p className="md:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }
  if (!availability) {
    return <p className="md:col-span-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">Isi tanggal dan jam untuk mengecek slot Sakoci.</p>;
  }
  const participantOverCapacity = Boolean(
    availability.maxParticipantsPerBooking &&
    availability.remaining > 0 &&
    !availability.available,
  );

  return (
    <div className={`md:col-span-2 rounded-lg border px-3 py-2 text-sm ${availability.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
      {availability.available
        ? `Jadwal tersedia. Sisa ${availability.remaining} dari ${availability.capacity} Sakoci, maksimal ${availability.maxParticipantsPerBooking ?? '-'} peserta untuk durasi sekitar ${durationMinutes} menit.`
        : participantOverCapacity
          ? `Jumlah peserta melebihi kapasitas Sakoci. Maksimal ${availability.maxParticipantsPerBooking} peserta untuk satu booking.`
          : `Jadwal penuh. ${availability.booked} dari ${availability.capacity} Sakoci sudah terisi pada rentang waktu ini.`}
    </div>
  );
}

function RoutePreviewResult({
  result,
  pickup,
}: {
  result: OptimizeRouteV2Result;
  pickup: { id: string; name: string; latitude: number; longitude: number };
}) {
  const mapPoints = [
    pickup,
    ...result.orderedDestinations.map((destination) => ({
      id: destination.id,
      name: destination.name,
      latitude: Number(destination.latitude),
      longitude: Number(destination.longitude),
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-white border rounded-lg p-3">
          <p className="text-xs text-gray-400">Total Jarak</p>
          <p className="text-xl font-bold text-[#1a3a2e]">
            {formatKm(result.totalDistanceKm)}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <p className="text-xs text-gray-400">Estimasi Waktu</p>
          <p className="text-xl font-bold text-[#1a3a2e]">
            {result.totalDurationMinutes ? `${Math.round(result.totalDurationMinutes)} menit` : '-'}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <p className="text-xs text-gray-400">Jumlah Destinasi</p>
          <p className="text-sm font-semibold text-[#1a3a2e] break-words">
            {result.orderedDestinations.length}
          </p>
        </div>
      </div>

      <RoutePreviewMap geojson={result.geojson} points={mapPoints} />

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-[#1a3a2e] mb-3">Urutan Kunjungan</h3>
        <div className="space-y-2">
          {result.orderedDestinations.map((destination, index) => (
            <div key={destination.id} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-[#1a3a2e] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{destination.name}</p>
                <p className="text-xs text-gray-400">{destination.category ?? '-'} · {destination.address ?? '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-[#1a3a2e] mb-3">Segmen Rute</h3>
        <div className="space-y-3">
          {result.segments.map((segment, index) => (
            <div key={`${segment.from.id}-${segment.to.id}-${index}`} className="border rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {segment.from.name} → {segment.to.name}
                  </p>
                  <p className="text-xs text-gray-400">Estimasi segmen perjalanan</p>
                </div>
                <span className="text-sm font-bold text-[#1a3a2e] whitespace-nowrap">
                  {formatKm(segment.distanceKm)}
                </span>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatKm(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
  return `${Number(value).toFixed(2)} km`;
}
