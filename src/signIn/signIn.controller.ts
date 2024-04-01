import { Controller, Get } from '@nestjs/common';
import { SignInService } from './signIn.service';

@Controller('signIn')
export class SignInController {
  constructor(private readonly signInService: SignInService) {}

  @Get()
  async signIn(): Promise<void> {
    await this.signInService.main();
  }
}
