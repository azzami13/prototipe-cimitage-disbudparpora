import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RoutingMatrixBuilderService } from '../modules/routing-engine/routing-matrix-builder.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const result = await app
      .get(RoutingMatrixBuilderService)
      .rebuildActiveMatrix();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
