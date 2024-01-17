import { Controller, Get } from '@nestjs/common';
import { SignInService } from './serivce/signIn.service';

@Controller('tieba')
export class AppController {
  constructor(private readonly signInService: SignInService) {}

  @Get('signIn')
  async signIn(): Promise<void> {
    await this.signInService.main();
  }
}
