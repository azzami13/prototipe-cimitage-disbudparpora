import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { getFrontendOrigins } from './common/config/cors-origins';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  app.enableCors({
    origin: getFrontendOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');
  const publicUploadRoot = process.env.LOCAL_PUBLIC_UPLOAD_ROOT || 'uploads';
  app.use(`/${publicUploadRoot}/booking-payments`, (_request, response) => {
    response
      .status(404)
      .json({ statusCode: 404, message: 'File tidak ditemukan' });
  });
  app.useStaticAssets(join(process.cwd(), publicUploadRoot), {
    prefix: `/${publicUploadRoot}/`,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`\n🏛  CimHeritage Backend listening on port ${port}`);
  console.log(`📊  Endpoints:`);
  console.log(`    GET  /api/heritage/geojson   → GeoJSON peta`);
  console.log(`    POST /api/routing/optimize   → Dijkstra multi-destinasi`);
  console.log(`    POST /api/bookings           → Buat pemesanan\n`);
}
bootstrap();
