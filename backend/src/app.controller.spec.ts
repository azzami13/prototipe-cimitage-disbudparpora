import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return a health status object', () => {
      const result = appController.getHealth();

      expect(result.status).toBe('ok');
      expect(result.service).toBe('cimahiheritage-backend');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });
});
