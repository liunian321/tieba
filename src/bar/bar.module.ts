import { Module } from '@nestjs/common';
import { BarService } from './bar.service';
import { BrowserModule } from '../browser';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [BrowserModule, CommonModule],
  providers: [BarService],
})
export class BarModule {}
