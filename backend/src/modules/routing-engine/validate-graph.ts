import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { GraphValidatorService } from './graph-validator.service';

async function main() {
  console.log('Bootstrapping application context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    console.log('Getting GraphValidatorService...');
    const validator = app.get(GraphValidatorService);

    console.log('Running graph validation...');
    const results = await validator.validate();
    console.log('========================================');
    console.log('         Graph Validation Report        ');
    console.log('========================================');

    if (results.length === 0) {
      console.log('✅ PASS: No issues found.');
    } else {
      results.forEach((res) => {
        const icon =
          res.level === 'PASS' ? '✅' : res.level === 'WARN' ? '⚠️' : '❌';
        console.log(`${icon} [${res.level}] ${res.message}: ${res.count}`);
        if (res.details && res.details.length > 0) {
          console.log(`   Examples: ${res.details.join(', ')}`);
        }
      });
    }
    console.log('========================================');
  } finally {
    await app.close();
  }
}

main().catch((err) => console.error(err));
