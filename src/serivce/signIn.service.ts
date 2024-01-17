import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from '../browser';
import { ConfigService } from '@nestjs/config';
import {
  ONE_KEY_SIGN_RESULT_URL,
  TIEBA_URL,
} from '../common/constant/base.constant';
import { CommonService } from '../common/common.service';
import * as XPATH from '../common/constant/xpath.constant';
import { delay } from 'bluebird';
import ms from 'ms';
import { Browser, ElementHandle, Page } from 'puppeteer';

@Injectable()
export class SignInService {
  private readonly logger: Logger = new Logger(SignInService.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly configService: ConfigService,
    private readonly commonService: CommonService,
  ) {}

  public browser: Browser;

  async main(): Promise<void> {
    const startTime = Date.now();

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

    this.browser = await this.browserService.launch({
      accountId,
    });
    const page = await this.browser.newPage();

    try {
      await this.commonService.gotoPage(TIEBA_URL, page);

      const pages = await this.browser.pages();
      await pages[0].close();

      // 一键签到
      await this.oneKeySign(page);

      // 签到
      await this.signIn(page);

      this.logger.log('签到任务完成', {
        duration: Date.now() - startTime,
      });
    } catch (err) {
      this.logger.error('签到任务失败', {
        err,
      });
    } finally {
      if (!debug) {
        try {
          await page.close();
          await this.browser.close();
          this.logger.log('关闭浏览器成功');
        } catch (err) {
          this.logger.error('关闭浏览器失败', {
            err,
          });
        }
      }
    }
  }

  /**
   * 一键签到 (0点到1点签到高峰期，本时段内无法一键签到)
   * @param page
   * @private
   */
  private async oneKeySign(page: Page): Promise<{
    message: string;
    success: boolean;
  }> {
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

    const element = await this.commonService.clickElementByXPath({
      xpath: XPATH.ONE_KEY_SIGN_START,
      page,
      businessType: '一键签到-开始签到',
    });

    if (!element) {
      // 检查是否已经签到过了
      const signedElement = await this.commonService.waitElementByXPath(
        XPATH.ONE_KEY_SIGN_SIGNED,
        page,
        '一键签到-已经签到',
      );

      if (signedElement) {
        this.logger.log('一键签到-已经签到');
        await page.keyboard.press('Escape');

        await this.commonService.clickElementByXPath({
          xpath: XPATH.ONE_KEY_SIGN_CLOSE,
          page,
          businessType: '关闭一键签到弹窗',
        });
        return {
          message: '一键签到-已经签到',
          success: true,
        };
      }
    }

    await Promise.any([oneKeySignResultPromise, delay(ms('1m'))]);

    let success = false;
    if (oneKeySignResultStr) {
      try {
        const oneKeySignResult = JSON.parse(oneKeySignResultStr);
        if (Object.hasOwn(oneKeySignResult, 'err')) {
          this.logger.error('一键签到失败', {
            oneKeySignFailReason: oneKeySignResult.err,
          });
        } else {
          this.logger.log('一键签到成功');
          success = true;
        }
      } catch (err) {
        this.logger.error('一键签到失败', {
          err,
        });
      }
    } else {
      this.logger.log('一键签到失败');
    }

    await page.keyboard.press('Escape');
    // 刷新页面
    await page.keyboard.press('F5');

    return {
      message: '一键签到' + (success ? '成功' : '失败'),
      success,
    };
  }

  private async signIn(page: Page): Promise<{
    message: string;
    success: boolean;
  }> {
    let element: ElementHandle | undefined;
    let successCount = 0;
    let hasFailed = false;
    // 爱逛的吧-签到完毕
    let isSignComplete = false;
    let loveBarClickCount = 0;
    let followBarClickCount = 0;

    for (;;) {
      if (!isSignComplete) {
        element = await this.commonService.clickElementByXPath({
          xpath: XPATH.RECENTLY_BAR_UN_SIGN,
          page,
          businessType: '签到',
          elementIndex: loveBarClickCount,
        });
        if (!element) {
          this.logger.log('爱逛的吧-签到完毕');
          isSignComplete = true;
        } else {
          loveBarClickCount++;
        }
      }

      if (isSignComplete) {
        // 查看更多
        try {
          const viewMoreElement = await page.waitForXPath(XPATH.VIEW_MORE, {
            timeout: ms('10s'),
          });

          await (viewMoreElement as ElementHandle).hover();

          element = await this.commonService.clickElementByXPath({
            xpath: XPATH.UN_SIGN_BAR,
            page,
            businessType: '签到',
            elementIndex: followBarClickCount,
          });

          if (!element) {
            this.logger.log('查看更多-签到完毕');
            break;
          } else {
            followBarClickCount++;
          }
        } catch (err) {
          this.logger.error('查看更多失败', {
            err,
          });
          break;
        }
      }

      await this.commonService.waitForNetwork(page);

      const pages = await this.browser.pages();
      if (pages.length < 2) {
        this.logger.error('签到失败，未打开新页面');

        return {
          message: '签到失败，未打开新页面',
          success: false,
        };
      } else {
        // this.logger.log('打开新页面成功');
      }

      const newPage = pages[pages.length - 1];
      page = pages[0];

      await this.commonService.waitForNetwork(newPage);

      const signedElement = await this.commonService.waitElementByXPath(
        XPATH.SIGN_COMPLETE,
        newPage,
      );
      if (signedElement) {
        this.logger.log('签到已完成');
        await this.closeNewPage(newPage);
        continue;
      }

      const unSignElement = await this.commonService.clickElementByXPath({
        xpath: XPATH.UN_SIGN,
        page: newPage,
      });

      if (unSignElement) {
        // this.logger.log('签到成功');
        successCount++;
      } else if (!hasFailed) {
        hasFailed = true;
        this.logger.error('签到失败');
      }

      const closeResult = await this.closeNewPage(newPage);
      if (!closeResult) {
        break;
      }
    }

    return {
      message:
        '签到' + (successCount > 0 ? '成功' : '失败') + successCount + '个',
      success: successCount > 0,
    };
  }

  private async closeNewPage(newPage: Page) {
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
