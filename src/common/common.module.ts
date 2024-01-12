import { CommonService } from './common.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [CommonService],
  exports: [CommonService],
})
export class CommonModule {}
