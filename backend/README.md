<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Routing Engine Dijkstra Matrix Cache

Routing Cimitage memakai graph jalan Sakoci dari QGIS/OSM yang disimpan pada
`road_node` dan `road_edge`. Backend memuat graph satu kali ke memory. Dijkstra
dijalankan ketika matrix dibangun ulang, sedangkan request pengguna hanya
mengambil sub-matrix dan menjalankan Held–Karp TSP. Jika ada pickup GPS, hanya
satu Dijkstra tambahan yang dijalankan dari pickup ke destinasi terpilih.

Simpan data besar lokal di:

```text
backend/private-data/routing/road_nodes.geojson
backend/private-data/routing/road_edges_cleaned.geojson
```

Folder tersebut diabaikan Git. Jangan memasukkan GeoJSON besar, cache `.pkl`,
atau data privat ke repository.

Validasi tanpa menulis database:

```bash
npm run routing:import-geojson -- --nodes private-data/routing/road_nodes.geojson --edges private-data/routing/road_edges_cleaned.geojson --dry-run
```

Pada npm 11, gunakan bentuk positional berikut agar tidak muncul peringatan
`Unknown cli config`:

```bash
npm run routing:import-geojson -- private-data/routing/road_nodes.geojson private-data/routing/road_edges_cleaned.geojson dry-run
```

Import graph dengan upsert aman berdasarkan `code`:

```bash
npm run routing:import-geojson -- --nodes private-data/routing/road_nodes.geojson --edges private-data/routing/road_edges_cleaned.geojson
```

Versi positional npm 11:

```bash
npm run routing:import-geojson -- private-data/routing/road_nodes.geojson private-data/routing/road_edges_cleaned.geojson
```

Bangun matrix aktif:

```bash
npm run routing:rebuild-matrix
```

Rebuild wajib dilakukan saat graph, biaya edge, aturan Sakoci, status aset,
atau koordinat heritage berubah. Build lama tetap aktif sampai build baru
selesai.

### Alur Kerja Data Routing

Sistem ini mengasumsikan data jaringan jalan sudah melalui pra-pemrosesan di software GIS seperti QGIS sebelum diimpor. Backend **tidak** melakukan operasi topologi kompleks seperti *Split Lines at Intersections* atau *Split Lines at Points*.
Backend mengasumsikan graph yang diimpor sudah valid secara topologis (misalnya, tidak ada garis yang saling bersilangan tanpa adanya node persimpangan).

Berikut adalah alur kerja data dari awal hingga visualisasi:

```mermaid
graph TD
    A[OSM Data] --> B{QGIS Preprocessing};
    B --> C[Split Lines at Intersections];
    C --> D[Export road_nodes.geojson];
    C --> E[Export road_edges_cleaned.geojson];
    
    subgraph Backend Import Process
        D --> F(npm run routing:import-geojson);
        E --> F;
    end

    subgraph Database
        F --> G[RoadNode Table];
        F --> H[RoadEdge Table];
    end

    subgraph Backend Runtime
        G --> I(In-Memory Graph Cache);
        H --> I;
        I --> J{Dijkstra Algorithm};
        J --> K[Destination Distance Matrix];
        K --> L{Held-Karp TSP Solver};
        L --> M[Optimized Route GeoJSON];
    end

    subgraph Frontend
        M --> N(Leaflet Map);
    end

    style B fill:#f9f,stroke:#333,stroke-width:2px
    style F fill:#ccf,stroke:#333,stroke-width:2px
    style J fill:#f96,stroke:#333,stroke-width:2px
    style L fill:#f96,stroke:#333,stroke-width:2px
```

Status build dapat dilihat oleh `super_admin` atau `admin_operasional` melalui:

```text
GET /api/graph/routing-status
```
