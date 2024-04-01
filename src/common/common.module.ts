import { CommonService } from './common.service';
import { Module } from '@nestjs/common';
import { BrowserModule } from '../browser';
import { PrismaService } from './prisma.service';

@Module({
  imports: [BrowserModule],
  providers: [CommonService, PrismaService],
  exports: [CommonService, PrismaService],
})
export class CommonModule {}
