import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/security/public.decorator';

type HealthResponse = {
  status: 'ok';
  service: string;
  timestamp: string;
};

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'cimahiheritage-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
