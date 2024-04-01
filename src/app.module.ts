import { Module } from '@nestjs/common';
import { BrowserModule } from './browser';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import { SignInModule } from './signIn/signIn.module';

@Module({
  imports: [BrowserModule, CommonModule, SignInModule, ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
