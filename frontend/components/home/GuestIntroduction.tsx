import Link from "next/link";
import PwaInstallButton from "@/components/pwa/PwaInstallButton";
import { backendAssetUrl } from "@/lib/runtime-config";

export default function GuestIntroduction() {
  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
      {/* Content */}
      <div>
        <span className="mb-3 inline-block rounded-full bg-sky-100 px-4 py-1 text-sm font-medium text-sky-700">
          Cimahi Military Heritage Tourism
        </span>

        <h3 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Jelajahi Warisan Sejarah Kota Cimahi
        </h3>

        <p className="mt-6 text-base leading-8 text-slate-600">
          Cimitage merupakan platform wisata heritage Kota Cimahi yang
          membantu wisatawan menjelajahi situs-situs bersejarah melalui
          peta interaktif, informasi destinasi, paket wisata, serta
          layanan perjalanan menggunakan kendaraan Sakoci.
        </p>

        <p className="mt-4 text-base leading-8 text-slate-600">
          Temukan bangunan bersejarah, rencanakan perjalanan, lihat
          rute wisata, dan nikmati pengalaman menjelajahi warisan
          sejarah Kota Cimahi dalam satu platform.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/heritage"
            className="
              rounded-xl
              bg-sky-500
              px-5
              py-3
              font-semibold
              text-white
              transition
              hover:bg-sky-600
            "
          >
            Jelajahi Situs
          </Link>

          <Link
            href="/peta"
            className="
              rounded-xl
              border
              border-slate-200
              px-5
              py-3
              font-semibold
              text-slate-700
              transition
              hover:bg-slate-100
            "
          >
            Lihat Peta
          </Link>

          <Link
            href="/my-orders"
            className="
              rounded-xl
              border
              border-sky-200
              px-5
              py-3
              font-semibold
              text-sky-700
              transition
              hover:bg-sky-50
            "
          >
            Pesanan Saya
          </Link>

          <PwaInstallButton />
        </div>
      </div>

      {/* Image */}
      <div>
        <img
          src={backendAssetUrl('/uploads/beranda/gedungsudirman.jpg')}
          alt="Cimahi Heritage"
          className="
            h-[420px]
            w-full
            rounded-3xl
            object-cover
          "
        />
      </div>
    </div>
  );
}
