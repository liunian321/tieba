import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from './browser';
import { ConfigService } from '@nestjs/config';
import {
  ONE_KEY_SIGN_RESULT_URL,
  TIEBA_URL,
} from './common/constant/base.constant';
import { CommonService } from './common/common.service';
import * as XPATH from './common/constant/xpath.constant';
import { delay } from 'bluebird';
import ms from 'ms';
import { Page } from 'puppeteer';

@Injectable()
export class AppService {
  private readonly logger: Logger = new Logger(AppService.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly configService: ConfigService,
    private readonly commonService: CommonService,
  ) {}

  async signIn(): Promise<void> {
    const accountId: string | undefined =
      await this.configService.get('accountId');
    if (!accountId || accountId == '') {
      this.logger.error('账号id不能为空');
      return;
    }

    const isLogin =
      ((await this.configService.get('IS_LOGIN')) ?? 'false') === 'true';
    if (!isLogin) {
      this.logger.error('请先手动登录');
      return;
    }

    const debug: boolean =
      ((await this.configService.get('DEBUG')) ?? 'false') === 'true';

    const browser = await this.browserService.launch({
      accountId,
    });
    const page = await browser.newPage();

    try {
      await this.commonService.gotoPage(TIEBA_URL, page);

      // 一键签到
      await this.oneKeySign(page);
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

  /**
   * 一键签到
   * @param page
   * @private
   */
  private async oneKeySign(page: Page): Promise<void> {
    await this.commonService.clickElementByXPath({
      xpath: XPATH.ONE_KEY_SIGN,
      page,
      businessType: '一键签到',
    });

    // 监听一键签到结果
    let oneKeySignResultStr: string | undefined;
    const oneKeySignResultPromise: Promise<void> = this.commonService
      .getResponseListenerByUrl(page, ONE_KEY_SIGN_RESULT_URL, 'data')
      .then((data) => {
        oneKeySignResultStr = data;
      });

    await this.commonService.clickElementByXPath({
      xpath: XPATH.ONE_KEY_SIGN_START,
      page,
      businessType: '一键签到-开始签到',
    });
    await Promise.any([oneKeySignResultPromise, delay(ms('1m'))]);

    if (oneKeySignResultStr) {
      const oneKeySignResult = JSON.parse(oneKeySignResultStr);
      if (Object.hasOwn(oneKeySignResult, 'err')) {
        this.logger.error('一键签到失败', {
          oneKeySignFailReason: oneKeySignResult.err,
        });
      }
    }
  }
}
