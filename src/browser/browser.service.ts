import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { type Browser } from 'puppeteer';
import { PROJECT_NAME } from '../common/constant/base.constant';

@Injectable()
export class BrowserService {
  private readonly logger: Logger = new Logger(BrowserService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 启动浏览器
   */
  async launch({ accountId }: { accountId: string }): Promise<Browser> {
    const browserEndpoint = this.configService.get('BROWSER_ENDPOINT');

    const windowWidth = this.configService.get('WINDOW_WIDTH') ? parseInt(this.configService.get('WINDOW_WIDTH') ?? '2560') : 2560;
    const windowHeight = this.configService.get('WINDOW_HEIGHT') ? parseInt(this.configService.get('WINDOW_HEIGHT') ?? '1440') : 1440;

    const userDataDir = `${this.configService.get<string>('LOCAL_PUPPETEER_DATA_DIR', './data')}${PROJECT_NAME}${
      this.configService.get('WINDOWS') === 'true' ? '\\' : '/'
    }${accountId}`;

    const headless = this.configService.get('HEADLESS')
      ? this.configService.get('HEADLESS') === 'true'
        ? true
        : this.configService.get('HEADLESS') === 'false'
          ? false
          : this.configService.get('HEADLESS')
      : false;
    console.log('headless', headless);

    // 启动浏览器实例，并设置 UA 和代理
    return typeof browserEndpoint !== 'undefined'
      ? await puppeteer.connect({
          browserWSEndpoint: (() => {
            const url = new URL(browserEndpoint);

            url.searchParams.set('stealth', 'true');
            // url.searchParams.set('timeout', `${timeout}`);
            url.searchParams.set('--disable-notifications', 'true');
            // url.searchParams.set('--user-agent', userAgent);
            url.searchParams.set('--window-size', `${windowWidth},${windowHeight}`);

            url.searchParams.set('--disable-logging', 'true');
            url.searchParams.set('--aggressive-cache-discard', 'true');
            url.searchParams.set('--disable-offline-load-stale-cache', 'true');
            url.searchParams.set('--disable-gpu-shader-disk-cache', 'true');
            url.searchParams.set('--media-cache-size=0', 'true');

            url.searchParams.set('--user-data-dir', userDataDir);
            url.searchParams.set('--user-data-id', accountId);

            return url.toString();
          })(),
          defaultViewport: { width: windowWidth, height: windowHeight },
        })
      : await puppeteer.launch({
          headless: headless,
          defaultViewport: { width: windowWidth, height: windowHeight },
          userDataDir: userDataDir,
          timeout: 0,
          args: [
            `--disable-notifications=true`,
            // `--user-agent=${userAgent}`,
            '--window-position=0,0',
            '--disable-features=IsolateOrigins,site-per-process',
            `--window-size=1920,1080`,
          ],
        });
  }

  async close(browser: Browser): Promise<void> {
    try {
      if (typeof browser !== 'undefined') {
        await browser.close();
        this.logger.log('关闭浏览器成功');
      } else {
        this.logger.warn('浏览器意外关闭');
      }
    } catch (err) {
      this.logger.error('关闭浏览器失败', { err });
    }
  }
}
