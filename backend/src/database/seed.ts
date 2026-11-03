/**
 * FINAL SEED CIMITAGE - DATA CAGAR BUDAYA KOTA CIMAHI 2025
 *
 * Master data: DATA CAGAR BUDAYA 2025.xlsx (75 objek).
 * Koordinat:
 * - DMS resmi 2025 dinormalisasi ke decimal degrees jika valid;
 * - titik malformed/outlier dikoreksi dari sumber daring yang lebih konsisten
 *   dengan alamat (Pemkot/JDIH Cimahi, BIG, SIMAS Kemenag, OSM/Wikidata/Wikimedia).
 *
 * `source_note` adalah catatan audit di source code dan tidak disimpan ke database.
 */

/**
 * Development lokal: npm run seed
 * UAT/production manual: npm run seed:uat (memerlukan flag dan password dari env)
 */
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getDatabaseOptions } from './database.config';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const isUatSeed = process.argv.includes('--uat');
const localDatabaseUrl =
  'postgresql://postgres:postgres@localhost:5432/cimahiheritage';

function getSeedPassword(): string {
  if (isUatSeed) {
    if (process.env.ALLOW_PRODUCTION_SEED !== 'true') {
      throw new Error(
        'Seed UAT ditolak: ALLOW_PRODUCTION_SEED=true wajib diberikan secara eksplisit',
      );
    }

    const password = process.env.UAT_SEED_PASSWORD?.trim();
    if (!password) {
      throw new Error('Seed UAT ditolak: UAT_SEED_PASSWORD wajib diisi');
    }

    return password;
  }

  if (isProduction) {
    throw new Error(
      'Seed production ditolak. Gunakan npm run seed:uat dengan konfirmasi dan kredensial eksplisit',
    );
  }

  return 'admin123';
}

const AppDataSource = new DataSource({
  ...getDatabaseOptions({
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || localDatabaseUrl,
  }),
  // Mempertahankan kemudahan setup database lokal. Production selalu false.
  synchronize: !isProduction && !isUatSeed,
  logging: false,
});

interface RoadGraphSeedNode {
  code: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
}

interface RoadGraphSeedEdge {
  code: string;
  fromCode: string;
  toCode: string;
  distanceKm: number;
  roadName: string;
  oneway: boolean;
  vehicleAccessible: boolean;
}

interface RoadGraphSeedData {
  nodes: RoadGraphSeedNode[];
  edges: RoadGraphSeedEdge[];
}

const heritage75 = [
  {
    name: 'GEDUNG RIO X.NTER',
    category: 'BG',
    address: 'Jl. Pabrik aci',
    kelurahan: 'Cimahi',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8728101,
    lng: 107.5430465,
    no_register: 'PO2019041500002',
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/Kep.2186-Disbudparpora/2023 Tanggal 12 Juli 2023 Tentang Bangunan Gedung Eks Bioskop Rio sebagai Bangunan Cagar Budaya Kota Cimahi',
    source_note: 'Wikidata/Wikimedia Rio X\'Nter',
  },
  {
    name: 'GEDUNG THE HISTORICH',
    category: 'BG',
    address: 'Jl Gatot Subroto No 19',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8858917,
    lng: 107.5375694,
    no_register: 'PO2019041000016',
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/Kep.1691-Disbudparpora/2022 Tentang Bangunan Gedung Sudirman Sebagai Bangunan Cagar Budaya Kota Cimahi\nTanggal 10 Mei 2022',
    source_note: 'Wikimedia Commons Gedung Sudirman/The Historich',
  },
  {
    name: 'GEREJA IMMANUEL',
    category: 'BG',
    address: 'Jl Pasir Kumeli No 149 A',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.88925,
    lng: 107.5416083,
    no_register: 'PO2020071500001',
    sk_penetapan: null,
    source_note: 'BIG Gazeter 2023 - GPIB Imanuel Cimahi',
  },
  {
    name: 'GEREJA SANTO IGNATIUS',
    category: 'BG',
    address: 'Jl Raya Baros No 8',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8905528,
    lng: 107.5363167,
    no_register: 'PO2019041100482',
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/2185-Disbudparpora/2023 Tanggal 12 Juli 2023 Tentang Bangunan Gereja Santo Ignatius sebagai Bangunan Cagar Budaya Kota Cimahi',
    source_note: 'BIG Gazeter 2023 - Santo Ignatius',
  },
  {
    name: 'HOTEL TJIMAHI',
    category: 'BG',
    address: 'Jl Jend. H Amir Machmud No 465',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8775,
    lng: 107.5486111,
    no_register: 'PO2020090300003',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'KOLAM RENANG BERKLEUS',
    category: 'BG',
    address: 'Jl. Sukimun Rt 01 Rw 04',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.887496,
    lng: 107.5382,
    no_register: 'PO2019041600003',
    sk_penetapan: null,
    source_note: 'Alamat Jl. Sukimun; koreksi longitude malformed, sekitar kompleks Baros/Berkleus',
  },
  {
    name: 'KOLAM RENANG KATAK RIANG',
    category: 'BG',
    address: 'Jl Pasir Kumeli No 39',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8890083,
    lng: 107.5420556,
    no_register: 'PO2020072700002',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'LOJI',
    category: 'BG',
    address: 'Jl Alun - alun timur No 634',
    kelurahan: 'Cimahi',
    kecamatan: 'Cimahi Tengah',
    lat: -6.87354,
    lng: 107.54256,
    no_register: 'PO2019052900058',
    sk_penetapan: null,
    source_note: 'Sadayapadu 2025 - Loji',
  },
  {
    name: 'MAKAM EMBAH NURKARIM',
    category: 'SI',
    address: 'Jl Cigugur Tengah RT 02 RW 05',
    kelurahan: 'Cimahi',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8921605,
    lng: 107.5544532,
    no_register: 'PO2020091600004',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'MAKAM EMBAH TUMPANG',
    category: 'SI',
    address: 'Jl Gandawijaya',
    kelurahan: 'Pasar Antri',
    kecamatan: 'Cimahi Selatan',
    lat: -6.8766667,
    lng: 107.5402778,
    no_register: 'PO2020090400001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'MAKAM KEHORMATAN BELANDA',
    category: 'BG',
    address: 'Jl kekhof Gg. Kurba Miharja Luewigajag',
    kelurahan: 'Leuwigajah',
    kecamatan: 'Cimahi Selatan',
    lat: -6.905558,
    lng: 107.5293457,
    no_register: 'PO2019111100001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'MASJID AGUNG CIMAHI',
    category: 'BG',
    address: 'Jl Kaum No 3',
    kelurahan: 'Cimahi',
    kecamatan: 'Cimahi Tengah',
    lat: -6.873079,
    lng: 107.541654,
    no_register: 'PO2019082100008',
    sk_penetapan: null,
    source_note: 'SIMAS Kemenag - Masjid Agung Kota Cimahi',
  },
  {
    name: 'MASJID USMAN DHOMIRI',
    category: 'BG',
    address: 'Jl. KH Rd Usman Dhomiri No 133 RT 04 Rw 08',
    kelurahan: 'Padasuka',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8784375,
    lng: 107.5308125,
    no_register: 'PO2019053100010',
    sk_penetapan: null,
    source_note: 'OpenStreetMap/Google place area Masjid Baiturrahman KH Usman Dhomiri',
  },
  {
    name: 'PENJARA PONCOL',
    category: 'BG',
    address: 'Jl Poncol Selatan No 24',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8838889,
    lng: 107.5413889,
    no_register: 'PO2019041100637',
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/1172-Disbudparpora/2021 Tentang Bangunan Pemasyarakatan Militer Sebagai Bangunan Cagar Budaya Kota Cimahi\nTanggal 14 Juni 2021',
    source_note: 'JDIH Kota Cimahi SK 430/1172/2021',
  },
  {
    name: 'PESAWAT DAKOTA',
    category: 'BD',
    address: 'Jl Gatot Subroto No 6',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.88472,
    lng: 107.53806,
    no_register: 'PO202009300002',
    sk_penetapan: null,
    source_note: 'Pusdikbekang/Pusdikhub Jl. Gatot Subroto No.6; official site has no coordinate',
  },
  {
    name: 'RUMAH KEDIAMAN AMIR MACHMUD',
    category: 'BG',
    address: 'Jl Ibu sangki RT 3 RW 13',
    kelurahan: 'Cibeber',
    kecamatan: 'Cimahi Selatan',
    lat: -6.8971875,
    lng: 107.5238125,
    no_register: 'PO2020071300003',
    sk_penetapan: null,
    source_note: 'Google place area Jl. Ibu Sangki/Cibeber (plus-code recovery)',
  },
  {
    name: 'RUMAH PEMOTONGAN HEWAN',
    category: 'BG',
    address: 'Jl sukiman RT 3 RW 4',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8890625,
    lng: 107.5406875,
    no_register: 'PO2019053100011',
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/Kep.2342-Disbudparpora/2024 Tanggal 18 September 2024 Tentang Rumah Pemotongan Hewan sebagai Bangunan Cagar Budaya Kota Cimahi',
    source_note: 'Google/OSM Abattoir in Tjimahi Regentschap (plus-code recovery)',
  },
  {
    name: 'RUMAH PETINGGI BELANDA',
    category: 'BG',
    address: 'Jl Sriwijaya No 11',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8840081,
    lng: 107.5355,
    no_register: 'PO2020072700003',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'RUMAH SAKIT DUSTIRA',
    category: 'BG',
    address: 'Jl Dr Dustira No 1',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.88645,
    lng: 107.53402,
    no_register: 'PO2015061200050',
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/1171-Disbudparpora/2021 Tentang Bangunan Rumah Sakit Dustira Sebagai Bangunan Cagar Budaya Kota Cimahi\nTanggal 14 Juni 2021',
    source_note: 'OpenStreetMap/Mapcarta RS Dustira',
  },
  {
    name: 'RUMAH VAN BLOMMEISTEIN',
    category: 'BG',
    address: 'Jl Jend H Amir Machmud No 89',
    kelurahan: 'Cibeureum',
    kecamatan: 'Cimahi Selatan',
    lat: -6.9004,
    lng: 107.5628,
    no_register: 'PO2019082100014',
    sk_penetapan: null,
    source_note: 'Alamat Jl. Amir Machmud No.89 Cibeureum; dikoreksi agar sesuai kawasan Cibeureum',
  },
  {
    name: 'SDN KARANG MEKAR MANDIRI 1',
    category: 'BG',
    address: 'Jl Jend H Amir Machmud No 505',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8763889,
    lng: 107.5455556,
    no_register: 'PO2020091700001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'SDN BAROS MANDIRI 4',
    category: 'BG',
    address: 'Jl Baros No 06 RT 01 RW 15',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8897222,
    lng: 107.5361111,
    no_register: 'PO2020100600001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'SMPN 1 CIMAHI',
    category: 'BG',
    address: 'Jl Rd Embang Artawidjaja No 12',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.876955,
    lng: 107.5441667,
    no_register: 'PO2020072700001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'SMPN 2 CIMAHI',
    category: 'BG',
    address: 'Jl Sudirman No 152',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8895111,
    lng: 107.5341389,
    no_register: 'PO2020072400002',
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/Kep.2340-Disbudparpora/2024 Tanggal 18 September 2024 Tentang Banguna SMP Negeri 2 Cimahi sebagai Bangunan Cagar Budaya Kota Cimahi',
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'STASIUN CIMAHI',
    category: 'BG',
    address: 'Jl stasiun No 1',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.88583,
    lng: 107.54056,
    no_register: 'PO2019041100637',
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/Kep.1692-Disbudparpora/2022 Tentang Bangunan Stasiun Kereta Api Cimahi Sebagai Bangunan Cagar Budaya Kota Cimahi\nTanggal 10 Mei 2022',
    source_note: 'Stasiun Cimahi - published station coordinates',
  },
  {
    name: 'GEDUNG MAKO KODIM 0609',
    category: 'BG',
    address: 'Jl Gatot Subroto No 248',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8802778,
    lng: 107.5427778,
    no_register: 'CB.6161.20250304.00018',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'GEDUNG STAFF KODIM 0609',
    category: 'BG',
    address: 'Jl Gatot Subroto No 249',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8802778,
    lng: 107.5427778,
    no_register: 'CB.6161.20250304.00019',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'MENARA AIR KODIM 0609',
    category: 'SI',
    address: 'Jl Gatot Subroto No 250',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8802778,
    lng: 107.5427778,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'TUGU KECAP PUSDIKPAL',
    category: 'SI',
    address: 'Jl Poncol Selatan No 24',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8872222,
    lng: 107.5438889,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'CENTRAL WASSHERY PUSDIKPAL',
    category: 'SI',
    address: 'Jl Poncol Selatan No 25',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8872222,
    lng: 107.5438889,
    no_register: 'CB.6161.20250313.00002',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'BANGUNAN PUSDIKPAL',
    category: 'BG',
    address: 'Jl Poncol Selatan No 26',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8872222,
    lng: 107.5438889,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'PANSER STUART PUSDIKPAL',
    category: 'BD',
    address: 'Jl Poncol Selatan No 27',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8872222,
    lng: 107.5438889,
    no_register: 'CB.6161.20250313.00003',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'MERIAM QF 2 POUNDER',
    category: 'BD',
    address: 'Jl Poncol Selatan No 28',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8872222,
    lng: 107.5438889,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'TANK SHERMAN RECOVERY',
    category: 'BD',
    address: 'Jl Poncol Selatan No 29',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8872222,
    lng: 107.5438889,
    no_register: 'CB.6161.20250309.00004',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'LONCENG PUSDIK BEKANG',
    category: 'BD',
    address: 'Jl Gatot Subroto',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8666667,
    lng: 107.5391667,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'BANGUNAN PUSDIK BEKANG',
    category: 'BG',
    address: 'Jl Gatot Subroto',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8666667,
    lng: 107.5391667,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'KAMPUNG CIREUNDEU',
    category: 'SI',
    address: 'RW 10 Leuwigajah',
    kelurahan: 'Leuwigajah',
    kecamatan: 'Cimahi Selatan',
    lat: -6.9133333,
    lng: 107.5216667,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'LONCENG PUSDIKHUB',
    category: 'BD',
    address: 'Jl Gatot Subroto No 5',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8847222,
    lng: 107.5380556,
    no_register: 'CB.6161.20250315.00003',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'BANGUNAN PUSDIKHUB',
    category: 'BG',
    address: 'Jl Gatot Subroto No 6',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8847222,
    lng: 107.5380556,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'LONCENG YONARMED',
    category: 'BD',
    address: 'Jl Gatot Subroto no 51',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8846389,
    lng: 107.5392222,
    no_register: 'CB.6161.20250316.00002',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'GARDOE ANIEM GATOT SUBROTO',
    category: 'BG',
    address: 'Jl. Dustira',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8858611,
    lng: 107.5378333,
    no_register: 'CB.6161.20250304.00020',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'GARDU LISTRIK ZAMAN BELANDA',
    category: 'BG',
    address: 'Jl. Gatot Subroto',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8858611,
    lng: 107.5378333,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'EKS GEBOUW VAN DE HOEFSMIDSCHOOL TE TJIMAHI',
    category: 'BG',
    address: 'JL. Baros',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8920278,
    lng: 107.5368889,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'MAKAM MBAH DALEM WIRASUTA WIDJAYA',
    category: 'SI',
    address: 'Jl. Kolonel Masturi',
    kelurahan: 'Cipageran',
    kecamatan: 'Cimahi Utara',
    lat: -6.8530625,
    lng: 107.5441875,
    no_register: null,
    sk_penetapan: null,
    source_note: 'TPU Muslim Cipageran / Makam Sembah Dalem Wirasuta (plus-code recovery)',
  },
  {
    name: 'MAKAM KERAMAT MBAH MUYUK, MBAH ARI, MBAH AGENG',
    category: 'SI',
    address: 'JL. Gang Keramat',
    kelurahan: 'Cibeber',
    kecamatan: 'Cimahi Selatan',
    lat: -6.8970278,
    lng: 107.5295278,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'BANGUNAN PECINAN',
    category: 'BG',
    address: 'Jl. Pasar Atas No 33',
    kelurahan: 'Cimahi',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8713889,
    lng: 107.5430556,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'TUGU KARTINI',
    category: 'SI',
    address: 'Jl. Baros No 06',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8884722,
    lng: 107.5367222,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'TOKO DJAMU DJATI WALUYO',
    category: 'BG',
    address: 'Jl. Gedung Empat No.90',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8788889,
    lng: 107.54,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'SUMUR BOR POJOK',
    category: 'BG',
    address: 'Gg. Sumur Bor II',
    kelurahan: 'Setiamanah',
    kecamatan: 'Cimahi Tengah',
    lat: -6.87775,
    lng: 107.5340556,
    no_register: 'CB.6161.20250309.00002',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'RUMAH GADJAH MADA CIMAHI',
    category: 'BG',
    address: 'Jl. Taman Gajah Mada No 27E',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8873056,
    lng: 107.5383333,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'SUB DETASEMEN POLISI MILITER III/5-1 CIMAHI',
    category: 'BG',
    address: 'Jl Gatot subroto no 76',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8799167,
    lng: 107.5431667,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'RUMAH DINAS RS. DUSTIRA',
    category: 'BG',
    address: 'Jl. Sriwijaya Raya No.E 18',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.882993,
    lng: 107.537173,
    no_register: 'CB.6061.20250316.00001',
    sk_penetapan: null,
    source_note: 'Sadayapadu 2025 - Rumah Dinas RS Dustira',
  },
  {
    name: 'MENARA AIR RS. DUSTIRA',
    category: 'BG',
    address: 'Jalan Dustira',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8872222,
    lng: 107.5360556,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'MENARA AIR STASION TJIMAHI',
    category: 'BG',
    address: 'Jl. Gatot Subroto No.53',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8870556,
    lng: 107.5373611,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'HERITAGE EKS PERNIAGAAN',
    category: 'BG',
    address: 'Jl. Pabrik Aci',
    kelurahan: 'Cimahi',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8704444,
    lng: 107.5426944,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'MAKAM  KH. RADEN USMAN DHOMIRI',
    category: 'BG',
    address: 'Jl. Kyai H. Usman Dhomiri',
    kelurahan: 'Padasuka',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8785,
    lng: 107.530957,
    no_register: 'CB.6061.20250316.00002',
    sk_penetapan: null,
    source_note: 'Sadayapadu 2025 - Makam KH Raden Usman Dhomiri',
  },
  {
    name: 'TAMAN KARTINI',
    category: 'BG',
    address: 'Jl. Baros No.6,',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8885,
    lng: 107.53675,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'PURA WIRA LOKA NATHA',
    category: 'BG',
    address: 'Jl. Sriwijaya Raya',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8839722,
    lng: 107.5355278,
    no_register: null,
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'PENDOPO CIMAHI',
    category: 'BG',
    address: 'Jl. Dra. Hj. Djulaeha Karmita No.5',
    kelurahan: 'Cimahi',
    kecamatan: 'Cimahi Tengah',
    lat: -6.872457,
    lng: 107.542519,
    no_register: null,
    sk_penetapan: null,
    source_note: 'Sadayapadu 2025 - Pendopo Cimahi',
  },
  {
    name: 'GERBANG KERKHOF LEUWIGAJAH',
    category: 'BG',
    address: 'Jl Kerkhof No. 68A',
    kelurahan: 'Leuwigajah',
    kecamatan: 'Cimahi Selatan',
    lat: -6.9044444,
    lng: 107.5288889,
    no_register: null,
    sk_penetapan: 'SK. WALI KOTA CIMAHI NOMOR 430/Kep.2341-Disbudparpora/2024 Tanggal 18 September 2024 Tentang Bangunan Kerkhof Leuwigajah sebagai Bangunan Cagar Budaya Kota Cimahi',
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Bangunan Sumur Bor Kodim 0609/Cimahi',
    category: 'BG',
    address: 'Jalan Gatot Subroto 248',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.891625,
    lng: 107.536517,
    no_register: 'CB.6161.20250304.00021',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Gardu Aniem Taman Kartini',
    category: 'BG',
    address: 'Jalan Dustira',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.887984,
    lng: 107.537217,
    no_register: 'CB.6061.20250304.00001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Bangunan Gudang Subdenzibang 02.1/III',
    category: 'BG',
    address: 'Jalan HMS Mintaredja no 1',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.892132,
    lng: 107.536944,
    no_register: 'CB.6161.20250309.00001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Menara Granat Pusdikpal',
    category: 'BG',
    address: 'Jalan Poncol Selatan',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.887223,
    lng: 107.543888,
    no_register: 'CB.6161.20250309.00003',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Lonceng SMP Negeri 2 Cimahi',
    category: 'BD',
    address: 'Jalan Jenderal Sudirman 152',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.89008,
    lng: 107.53417,
    no_register: 'CB.6161.20250311.00002',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Rumah Dinas Wadan Pusdikhub',
    category: 'BG',
    address: 'Jalan Taman Kartini E-48',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.888167,
    lng: 107.536296,
    no_register: 'CB.6161.20250315.00002',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Bangunan Barak Pusdikhub',
    category: 'BG',
    address: 'Jalan Gatot Subroto No 5',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.88114,
    lng: 107.537249,
    no_register: 'CB.161.20250315.00001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Sumur Bor Pusdikarmed',
    category: 'BG',
    address: 'Jalan Baros',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.891625,
    lng: 107.536517,
    no_register: 'CB.6161.20250316.00001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Rumah Dinas Pusdikarmed',
    category: 'BG',
    address: 'Jalan Baros',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.891935,
    lng: 107.536373,
    no_register: 'CB.6161.20250316.00002',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Kantor Penjagaan Yon Armed 4/105 GS',
    category: 'BG',
    address: 'Jalan Gatot Subroto 51',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.88472,
    lng: 107.5394,
    no_register: 'CB.6161.20250316.00004',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Barak Pusdikbekang',
    category: 'BG',
    address: 'Jalan Gatot Subroto',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8848,
    lng: 107.5388,
    no_register: 'CB.6161.20250316.00005',
    sk_penetapan: null,
    source_note: 'Koreksi typo official -6.5253,107.3229; lokasi Pusdikbekang Jl Gatot Subroto No.4',
  },
  {
    name: 'Meriam QF-2 Pounder Pusdikpal',
    category: 'BD',
    address: 'Jalan Poncol Selatan',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.88391,
    lng: 107.54167,
    no_register: 'CB.6161.20250316.00006',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Dapur Pusdikhub',
    category: 'BG',
    address: 'Jalan Gatot Subroto',
    kelurahan: 'Karangmekar',
    kecamatan: 'Cimahi Tengah',
    lat: -6.8814,
    lng: 107.537249,
    no_register: 'CB.6161.20250316.00007',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Lonceng RS Dustira',
    category: 'BD',
    address: 'Jalan Dustira',
    kelurahan: 'Baros',
    kecamatan: 'Cimahi Tengah',
    lat: -6.88391,
    lng: 107.54167,
    no_register: 'CB.6161.20250316.00008',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
  {
    name: 'Gedong Anom Kebon Kopi',
    category: 'BG',
    address: 'Jalan Amir Machmud',
    kelurahan: 'Cibeureum',
    kecamatan: 'Cimahi Selatan',
    lat: -6.904409,
    lng: 107.564629,
    no_register: 'CB.6161.20250322.00001',
    sk_penetapan: null,
    source_note: 'DATA CAGAR BUDAYA 2025',
  },
];

async function seedRoadGraph(q: DataSource['query']) {
  console.log('🛣 Seed demo road graph...');

  const seedPath = join(__dirname, 'seeds', 'road-graph.seed.json');
  const seedData = JSON.parse(
    readFileSync(seedPath, 'utf8'),
  ) as RoadGraphSeedData;

  for (const node of seedData.nodes) {
    await q(
      `
      INSERT INTO road_node (code, name, type, latitude, longitude)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        updated_at = NOW()
    `,
      [node.code, node.name, node.type, node.latitude, node.longitude],
    );
  }

  const roadNodeRows = await q(
    `
    SELECT id, code
    FROM road_node
    WHERE code = ANY($1::text[])
  `,
    [seedData.nodes.map((node) => node.code)],
  );
  const roadNodeIdByCode = new Map<string, number>(
    roadNodeRows.map((row: { id: number; code: string }) => [row.code, row.id]),
  );

  for (const edge of seedData.edges) {
    const fromNodeId = roadNodeIdByCode.get(edge.fromCode);
    const toNodeId = roadNodeIdByCode.get(edge.toCode);

    if (!fromNodeId || !toNodeId) {
      throw new Error(
        `Road edge ${edge.code} memiliki fromCode/toCode yang tidak ditemukan`,
      );
    }

    await q(
      `
      INSERT INTO road_edge (
        code,
        from_node_id,
        to_node_id,
        distance_km,
        road_name,
        oneway,
        vehicle_accessible
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (code) DO UPDATE SET
        from_node_id = EXCLUDED.from_node_id,
        to_node_id = EXCLUDED.to_node_id,
        distance_km = EXCLUDED.distance_km,
        road_name = EXCLUDED.road_name,
        oneway = EXCLUDED.oneway,
        vehicle_accessible = EXCLUDED.vehicle_accessible,
        updated_at = NOW()
    `,
      [
        edge.code,
        fromNodeId,
        toNodeId,
        edge.distanceKm,
        edge.roadName,
        edge.oneway,
        edge.vehicleAccessible,
      ],
    );
  }

  console.log(
    `   Road graph: ${seedData.nodes.length} nodes, ${seedData.edges.length} edges`,
  );
}

async function seed() {
  const seedPassword = getSeedPassword();
  console.log('🌱 Menghubungkan ke database...');
  await AppDataSource.initialize();
  const q = AppDataSource.query.bind(AppDataSource);

  // Roles
  console.log('👥 Seed roles...');
  await q(`
    INSERT INTO role (name) VALUES ('customer'),('super_admin'),('admin_operasional'),('tour_guide'),('driver')
    ON CONFLICT (name) DO NOTHING
  `);

  // Demo users
  console.log('👤 Seed demo users...');
  const hash = await bcrypt.hash(seedPassword, 10);
  const demoUsers = [
    ['Super Admin', 'admin@cimahiheritage.id', 'super_admin'],
    ['Admin Operasional', 'operasional@cimahiheritage.id', 'admin_operasional'],
    ['Tour Guide', 'guide@cimahiheritage.id', 'tour_guide'],
    ['Driver', 'driver@cimahiheritage.id', 'driver'],
  ];

  for (const [name, email, role] of demoUsers) {
    await q(`
      INSERT INTO "user" (name, email, password, role_id, active)
      SELECT $1::text,$2::text,$3::text,(SELECT id FROM role WHERE name=$4::text), true
      ON CONFLICT (email) DO NOTHING
    `, [name, email, hash, role]);
  }

  // Heritage sites
  // Upsert by name so seed dapat dijalankan ulang dengan aman.
  // point_geom selalu disinkronkan dengan longitude/latitude.
  console.log(`🏛 Seed ${heritage75.length} situs heritage...`);
  for (const s of heritage75) {
    const existing = await q(
      `SELECT id FROM heritage_site WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [s.name],
    );

    if (existing.length > 0) {
      await q(
        `
        UPDATE heritage_site
        SET
          category = $2,
          address = $3,
          kelurahan = $4,
          kecamatan = $5,
          latitude = $6::numeric,
          longitude = $7::numeric,
          point_geom = ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326),
          no_register = $8,
          sk_penetapan = $9,
          status = 'aktif'
        WHERE id = $1
        `,
        [
          existing[0].id,
          s.category,
          s.address,
          s.kelurahan,
          s.kecamatan,
          s.lat,
          s.lng,
          s.no_register ?? null,
          s.sk_penetapan ?? null,
        ],
      );
    } else {
      await q(
        `
        INSERT INTO heritage_site (
          name,
          category,
          address,
          kelurahan,
          kecamatan,
          latitude,
          longitude,
          point_geom,
          no_register,
          sk_penetapan,
          status
        )
        VALUES (
          $1,$2,$3,$4,$5,$6::numeric,$7::numeric,
          ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326),
          $8,$9,'aktif'
        )
        `,
        [
          s.name,
          s.category,
          s.address,
          s.kelurahan,
          s.kecamatan,
          s.lat,
          s.lng,
          s.no_register ?? null,
          s.sk_penetapan ?? null,
        ],
      );
    }
  }

  // Tour packages
  console.log('📦 Seed tour packages...');
  await q(`
    INSERT INTO tour_package (code, name, description, price_per_person, duration_hours, active)
    VALUES
      ('PKG-MILITER','Wisata Heritage Militer','Jelajahi jejak sejarah militer kolonial Kota Cimahi: dari Rumah Sakit Dustira, Stasiun Cimahi, hingga Gedung The Historich',150000,4,true),
      ('PKG-RELIGI','Wisata Heritage Religi','Kunjungi tempat ibadah bersejarah Kota Cimahi yang memiliki nilai arsitektur dan budaya tinggi',100000,3,true),
      ('PKG-FULLDAY','Paket Full Day Heritage Cimahi','Paket lengkap seharian mengunjungi 7 situs cagar budaya terpilih dengan panduan lokal',250000,8,true)
    ON CONFLICT (code) DO NOTHING
  `);

  // Package routes (militer)
  console.log('🗺 Seed package routes...');
  const militerSites = ['RUMAH SAKIT DUSTIRA','STASIUN CIMAHI','PENJARA PONCOL','GEDUNG THE HISTORICH','PESAWAT DAKOTA'];
  for (let i = 0; i < militerSites.length; i++) {
    await q(`
      INSERT INTO package_route (tour_package_id, heritage_site_id, sequence)
      SELECT tp.id, hs.id, $1
      FROM tour_package tp, heritage_site hs
      WHERE tp.code='PKG-MILITER' AND hs.name=$2
      ON CONFLICT DO NOTHING
    `, [i + 1, militerSites[i]]);
  }

  // Package routes (religi)
  const religiSites = ['GEREJA IMMANUEL','GEREJA SANTO IGNATIUS','MASJID AGUNG CIMAHI'];
  for (let i = 0; i < religiSites.length; i++) {
    await q(`
      INSERT INTO package_route (tour_package_id, heritage_site_id, sequence)
      SELECT tp.id, hs.id, $1
      FROM tour_package tp, heritage_site hs
      WHERE tp.code='PKG-RELIGI' AND hs.name=$2
      ON CONFLICT DO NOTHING
    `, [i + 1, religiSites[i]]);
  }

  // Package routes (fullday)
  const fulldaySites = ['LOJI','MASJID AGUNG CIMAHI','PENDOPO CIMAHI','STASIUN CIMAHI','RUMAH SAKIT DUSTIRA','GEREJA IMMANUEL','MAKAM KEHORMATAN BELANDA'];
  for (let i = 0; i < fulldaySites.length; i++) {
    await q(`
      INSERT INTO package_route (tour_package_id, heritage_site_id, sequence)
      SELECT tp.id, hs.id, $1
      FROM tour_package tp, heritage_site hs
      WHERE tp.code='PKG-FULLDAY' AND hs.name=$2
      ON CONFLICT DO NOTHING
    `, [i + 1, fulldaySites[i]]);
  }

  await seedRoadGraph(q);

  console.log('\n✅ Seed selesai!');
  if (!isUatSeed) {
    console.log('   🔑 Password semua akun demo lokal: admin123');
  }
  console.log('   📧 Super Admin       : admin@cimahiheritage.id');
  console.log('   📧 Admin Operasional : operasional@cimahiheritage.id');
  console.log('   📧 Tour Guide        : guide@cimahiheritage.id');
  console.log('   📧 Driver            : driver@cimahiheritage.id');
  await AppDataSource.destroy();
}

seed().catch(err => {
  console.error('❌ Seed gagal:', err.message);
  process.exit(1);
});
