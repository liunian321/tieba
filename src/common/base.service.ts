import { BrowserService } from '../browser';
import { ConfigService } from '@nestjs/config';
import { CommonService } from './common.service';
import { Browser, Page } from 'puppeteer';
import { Logger } from '@nestjs/common';

export class BaseService {
  constructor(
    readonly browserService: BrowserService,
    readonly configService: ConfigService,
    readonly commonService: CommonService,
  ) {}

  logger: Logger = new Logger(BaseService.name);

  browser: Browser;

  async closeNewPage(newPage: Page) {
    try {
      await this.commonService.waitForNetwork(newPage);
      await newPage.close();
      // this.logger.log('关闭页面成功');
      return true;
    } catch (err) {
      this.logger.error('关闭页面失败', {
        err,
      });
      return false;
    }
  }
}
