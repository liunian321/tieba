import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { BrowserModule } from './browser';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import { SignInService } from './signIn/signIn.service';

@Module({
  imports: [BrowserModule, CommonModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [SignInService],
})
export class AppModule {}
