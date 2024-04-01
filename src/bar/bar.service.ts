import { Injectable, Logger, Scope } from '@nestjs/common';
import { BaseService } from '../common/base.service';
import { BrowserService } from '../browser';
import { ConfigService } from '@nestjs/config';
import { CommonService } from '../common/common.service';
import { TIEBA_URL } from '../common/constant/base.constant';
import * as BAR_XPATH from './constant/bar-xpath.constant';
import { MY_BAR_ENTRANCE } from './constant/bar-xpath.constant';
import { PrismaService } from '../common/prisma.service';
import { User } from '@prisma/client';
import * as BAR_URL from './constant/bar-url.constant';
import { Page } from 'puppeteer';

@Injectable({ scope: Scope.REQUEST })
export class BarService extends BaseService {
  constructor(
    readonly browserService: BrowserService,
    readonly configService: ConfigService,
    readonly commonService: CommonService,
    private readonly prisma: PrismaService,
  ) {
    super(browserService, configService, commonService);
    this.logger = new Logger(BarService.name);
  }

  /**
   * 收集个人信息
   */
  async collectPersonalInformation(id: string): Promise<User | null> {
    try {
      this.logger.log('开始收集个人信息');
      const browser = await this.commonService.startBrowser(id);

      // 由于目前不清楚home页面的url参数中id的含义，所以暂时通过手动操作进入我的主页
      await this.commonService.gotoPage({ url: TIEBA_URL });

      await this.commonService.waitForNetwork();

      await this.commonService.waitElementByXPath({ xpath: MY_BAR_ENTRANCE, operationType: '等待我的主页入口' });

      const firstPage = (await browser.pages())[0];
      const newPagePromise: Promise<Page | null> = new Promise(resolve => {
        firstPage.on('popup', async page => {
          resolve(page);
        });
      });

      await this.commonService.clickElementByXPath({ xpath: MY_BAR_ENTRANCE, operationType: '点击我的主页入口' });

      // 手动进入我的主页会打开新的tab，所以需要切换到新的tab
      let page = await newPagePromise;

      if (!page) {
        const pages = await browser.pages();
        page = pages[pages.length - 1];
      }

      let userId = '';
      this.commonService
        .getResponseListenerByUrl({
          url: BAR_URL.USER_ID_URL,
          flag: 'user_id',
          page,
        })
        .then(response => {
          const obj = JSON.parse(response);
          userId = this.commonService.getPropertyValue(obj, 'user_id');
        });

      let userPortrait = '';
      let userName = '';
      this.commonService
        .getResponseListenerByUrl({
          url: BAR_URL.USER_PORTRAIT_URL,
          flag: 'user_portrait',
          page,
        })
        .then(response => {
          const obj = JSON.parse(response);
          userPortrait = this.commonService.getPropertyValue(obj, 'user_portrait');
          userName = this.commonService.getPropertyValue(obj, 'show_nickname');
        });

      await this.commonService.waitForNetwork(page);

      // 用户名、吧龄、发贴数量、IP属地、性别男、性别女
      const textList = await this.commonService.getTextByXPathList({
        xpathList: [BAR_XPATH.PERSONAL_INFO_USERNAME, BAR_XPATH.PERSONAL_INFO_BAR_AGE, BAR_XPATH.PERSONAL_INFO_POST_NUM, BAR_XPATH.PERSONAL_INFO_IP_LOCATION],
        page,
      });

      const maleElement = await this.commonService.waitElementByXPath({ xpath: BAR_XPATH.PERSONAL_INFO_MALE, page });
      const femaleElement = await this.commonService.waitElementByXPath({ xpath: BAR_XPATH.PERSONAL_INFO_FEMALE, page });

      return this.prisma.user.upsert({
        create: {
          userId: String(userId),
          portrait: userPortrait,
          name: userName,
          barAge: parseFloat(textList[1].split(':')[1].slice(0, -1)),
          postCount: Number(textList[2].split(':')[1]),
          ipLocation: textList[3].split(':')[1],
          gender: maleElement ? '男' : femaleElement ? '女' : '未知',
        },
        update: {
          portrait: userPortrait,
          name: userName,
          barAge: parseFloat(textList[1].split(':')[1].slice(0, -1)),
          postCount: Number(textList[2].split(':')[1]),
          ipLocation: textList[3].split(':')[1],
          gender: maleElement ? '男' : femaleElement ? '女' : '未知',
        },
        where: {
          userId: String(userId),
        },
      });
    } catch (err) {
      this.logger.error('收集个人信息失败', { err });
      return null;
    } finally {
      // void this.commonService.closeBrowser();
    }
  }
}
