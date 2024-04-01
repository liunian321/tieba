import { Controller, Get, Scope } from '@nestjs/common';
import { SignInService } from './signIn.service';

@Controller({path:'signIn',scope:Scope.REQUEST})
export class SignInController {
  constructor(private readonly signInService: SignInService) {}

  @Get()
  async signIn(): Promise<void> {
    await this.signInService.main();
  }
}
