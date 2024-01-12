import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('tieba')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('signIn')
  async signIn(): Promise<void> {
    await this.appService.signIn();
  }
}
