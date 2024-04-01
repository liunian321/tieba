import { Module } from '@nestjs/common';
import { SignInService } from './signIn.service';
import { SignInController } from './signIn.controller';
import { BrowserModule } from '../browser';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [BrowserModule, CommonModule],
  controllers: [SignInController],
  providers: [SignInService],
})
export class SignInModule {}
