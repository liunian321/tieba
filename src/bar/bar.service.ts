import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from '../common/base.service';
import { BrowserService } from '../browser';
import { ConfigService } from '@nestjs/config';
import { CommonService } from '../common/common.service';

@Injectable()
export class BarService extends BaseService {
  constructor(
    readonly browserService: BrowserService,
    readonly configService: ConfigService,
    readonly commonService: CommonService,
  ) {
    super(browserService, configService, commonService);
    this.logger = new Logger(BarService.name);
  }
}
