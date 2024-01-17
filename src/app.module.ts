import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { SignInService } from './serivce/signIn.service';
import { BrowserModule } from './browser';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    BrowserModule,
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [SignInService],
})
export class AppModule {}
