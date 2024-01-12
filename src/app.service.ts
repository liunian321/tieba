import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from './browser';
import { ConfigService } from '@nestjs/config';
import { isEmpty } from 'lodash';
import { TIEBA_URL } from './common/constant/base.constant';
import { CommonService } from './common/common.service';

@Injectable()
export class AppService {
  private readonly logger: Logger = new Logger(AppService.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly configService: ConfigService,
    private readonly commonService: CommonService,
  ) {}

  async signIn() {
    const accountId = await this.configService.get('accountId');
    const debug: boolean =
      ((await this.configService.get('DEBUG')) ?? 'false') === 'true';

    if (isEmpty(accountId)) {
      this.logger.error('账号id不能为空');
      return;
    }

    const browser = await this.browserService.launch({
      accountId,
    });
    const page = await browser.newPage();

    try {
      await this.commonService.gotoPage(TIEBA_URL, page);
    } catch (err) {
      this.logger.error('签到任务失败', {
        err,
      });
    } finally {
      if (!debug) {
        await page.close();
        await browser.close();
      }
    }
  }
}
