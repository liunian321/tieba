import { Injectable, Logger, Scope } from '@nestjs/common';
import moment from 'moment';
import { Browser, ElementHandle, HTTPRequest, HTTPResponse, Page } from 'puppeteer';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { PROXY_FAILED_FLAG_LIST } from './constant/error.constant';
import { blockedContentTypes } from './constant/block.constant';
import { EventEmitter } from 'events';
import { delay } from 'bluebird';
import { isEmpty, random } from 'lodash';
import { BrowserService } from '../browser';
import { randomUUID } from 'crypto';
import { EXCEPTION_URLS, IMAGE_QUALITY, PROJECT_NAME, SAVE_IMAGE_FORMAT } from './constant/base.constant';
import * as fs from 'node:fs/promises';

const eventEmitter = new EventEmitter();

@Injectable({ scope: Scope.REQUEST })
export class CommonService {
  constructor(
    private readonly configService: ConfigService,
    private readonly browserService: BrowserService,
  ) {}

  browser!: Browser;

  browserPages!: Page[];

  private readonly logger: Logger = new Logger(CommonService.name);

  /**
   * 启动浏览器
   * @param id
   */
  async startBrowser(id: string): Promise<Browser> {
    try {
      // 如果浏览器未启动或者已经关闭,则重新启动浏览器
      if (isEmpty(this.browser) || isEmpty(this.browserPages) || !this.browser.connected) {
        this.browser = await this.browserService.launch({
          accountId: id,
        });

        this.browserPages = await this.browser.pages();
        if (this.browserPages.length === 0) {
          this.browserPages.push((await this.newPage()).page);
        }
      }

      return this.browser;
    } catch (err) {
      switch (err.message) {
        case err.message.includes('429'):
          this.logger.error('浏览器已被限流');
          throw new Error('浏览器已被限流');
        default:
          this.logger.error('启动浏览器失败', { err });
          throw new Error('启动浏览器失败');
      }
    }
  }

  /**
   * 创建新页面
   */
  async newPage(): Promise<{ page: Page; pageIndex: number }> {
    const browserPage = await this.browser.newPage();
    this.browserPages.push(browserPage);
    this.logger.log('创建新页面成功');
    return {
      page: browserPage,
      pageIndex: this.browserPages.length - 1,
    };
  }

  /**
   * 跳转页面
   * @param data
   */
  async gotoPage(data: { url: string; page?: Page; timeout?: number }): Promise<void> {
    let response: HTTPResponse | null = null;
    const startTime = Date.now();
    try {
      response = await (data.page ?? this.browserPages[0]).goto(data.url, {
        waitUntil: 'load',
        timeout: data.timeout ?? ms('5m'),
      });
    } catch (err) {
      if (PROXY_FAILED_FLAG_LIST.some(flag => err.message?.includes(flag))) {
        this.logger.error('代理失效', { err });
        throw new Error('代理失效');
      }

      if (err.message.includes('timeout')) {
        this.logger.error('跳转页面超时', { err });
        throw new Error('跳转页面超时');
      }

      const arr = data.url.split('//');

      this.logger.error(err.message ?? '打开页面失败', { failedUrl: arr.length > 1 ? arr[1] : data.url, err });

      throw new Error(err.message ?? '打开页面失败');
    }

    if (response === null) {
      throw new Error('跳转页面超时');
    }

    if (response.status() === 429) {
      this.logger.error('代理已被限流');
      throw new Error('代理已被限流');
    }

    this.logger.log('跳转页面成功', {
      gotoPageTime: Date.now() - startTime,
    });

    // 目前发现打开浏览器时会有一个空白页面, 所以这里判断如果页面数量大于1, 则关闭第一个空白页面
    if (this.browserPages.length > 1) {
      await this.browserPages[0].close();
    }
  }

  /**
   * 如果当前页面在规定时间内没有请求和响应则返回
   * @param page
   * @param interval
   */
  async waitForNetwork(page?: Page, interval?: number): Promise<void> {
    if (page === undefined) {
      if (this.browserPages[0] === undefined) {
        return;
      }
      page = this.browserPages[0];
    }

    const id = randomUUID();
    const key = 'waitNetworkOver:' + id;
    interval = interval ?? ms('1.5s');

    try {
      await this.listenResponse(page, interval, key);

      await Promise.any([
        new Promise(resolve => {
          eventEmitter.on(key, () => {
            resolve('');
          });
        }),
        delay(ms('30s')),
      ]);

      eventEmitter.removeAllListeners(key);
      await delay(interval ?? ms('1s'));
    } catch (err) {
      if (this.configService.get('DEBUG') === 'true') {
        this.logger.error('等待网络失败', { err });
      }
    }
  }

  private async listenResponse(page: Page, interval: number = ms('1s'), key: string) {
    let i = 0;
    let j = 0;
    let retryCount = 0;
    const startTime = Date.now();
    const requestHandler = (request: HTTPRequest) => {
      if (
        !blockedContentTypes.includes(request.resourceType()) &&
        !['other', 'webSocket'].includes(request.resourceType()) &&
        !EXCEPTION_URLS.some(exceptionURL => request.url().includes(exceptionURL))
      ) {
        i++;
      }
    };

    const responseHandler = (response: HTTPResponse) => {
      const request = response.request();
      if (
        !blockedContentTypes.includes(request.resourceType()) &&
        !['webSocket', 'other'].includes(request.resourceType()) &&
        !EXCEPTION_URLS.some(exceptionURL => request.url().includes(exceptionURL))
      ) {
        j++;
      }
    };

    new Promise<string>(() => {
      page.on('request', requestHandler);
    });

    new Promise<string>(() => {
      page.on('response', responseHandler);
    });

    const obj = setInterval(() => {
      if ((j - i <= 0 && retryCount > 1) || (i === 0 && j === 0 && retryCount > 0)) {
        // 如果 连续 2 次单位时间内没有请求或者响应, 则返回  如果 3 次循环后响应数大于或者等于请求数, 则返回
        clearInterval(obj);

        page.off('request', requestHandler);
        page.off('response', responseHandler);

        if (this.configService.get('DEBUG') === 'true') {
          console.log('等待网络结束: ' + (Date.now() - startTime) + 'ms');
        }

        eventEmitter.emit(key, 'OVER');
      } else {
        retryCount++;
      }
    }, interval);
  }

  /**
   * 根据所提供的 url 获取一个响应监听器(注意：如果一直没有符合的响应,它会一直阻塞下去)
   * @param data
   */
  async getResponseListenerByUrl(data: { page?: Page; url?: string; flag?: string }): Promise<string> {
    if (!data.page) {
      data.page = this.browserPages[0];
    }

    const responseHandler = async (response: HTTPResponse): Promise<void> => {
      if (response.status() >= 300 && response.status() < 400) {
        // 重定向的无法获取响应结果
        eventEmitter.emit('listenResponseOver' + data.url ?? '', '');
      }

      if (data.url === undefined) {
        // 如果 url 未定义, 则返回第一个响应结果
        try {
          eventEmitter.emit('listenResponseOver', await response.text());
        } catch (err) {
          eventEmitter.emit('listenResponseOver', '');
        }
      } else if (response.url().startsWith(data.url)) {
        let text = '';
        try {
          text = await response.text();
        } catch (err) {
          // 如果没有指定 flag, 并且响应结果为空, 则返回空字符串
          if (data.flag === undefined) {
            eventEmitter.emit('listenResponseOver' + data.url ?? '', '');
          }
        }

        if (data.flag === undefined || text.includes(data.flag)) {
          try {
            JSON.parse(text);
            try {
              eventEmitter.emit('listenResponseOver' + data.url ?? '', text);
            } catch (err) {
              this.logger.error('发送数据失败', { err });
              eventEmitter.emit('listenResponseOver' + data.url ?? '', '');
            }
          } catch (err) {
            try {
              text = text.replace('for (;;);', '');
              JSON.parse(text);
              try {
                eventEmitter.emit('listenResponseOver' + data.url ?? '', text);
              } catch (err) {
                this.logger.error('发送数据失败', { err });
                eventEmitter.emit('listenResponseOver' + data.url ?? '', '');
              }
            } catch (err) {
              this.logger.error('响应结果不是JSON格式', { text });
            }
          }
        }
      }
    };

    try {
      new Promise<void>(() => {
        data.page!.on('response', responseHandler);
      });

      return await new Promise<string>(resolve => {
        eventEmitter.on('listenResponseOver' + data.url ?? '', result => {
          resolve(result);
        });
      });
    } finally {
      data.page.off('response', responseHandler);
      eventEmitter.removeAllListeners('listenResponseOver' + data.url ?? '');
    }
  }

  /**
   * 根据所提供的 url 获取一个请求监听器(注意：如果一直没有符合的请求,它会一直阻塞下去)
   * @param page
   * @param url
   * @param flag
   */
  async getRequestsListenerByUrl(
    page: Page,
    url?: string,
    flag?: string,
  ): Promise<
    | {
        headers: Record<string, string>;
        payload: string | undefined;
      }
    | undefined
  > {
    const requestHandler = async (request: HTTPRequest): Promise<void> => {
      let req: HTTPRequest | undefined;

      if (url === undefined) {
        // 如果 url 未定义, 则返回第一个请求结果
        req = request;
      } else if (request.url().startsWith(url) && (flag === undefined || request.postData()?.includes(flag))) {
        req = request;
      }

      if (req !== undefined) {
        eventEmitter.emit('listenRequestOver' + url ?? '', {
          headers: req!.headers(),
          payload: decodeURIComponent(req!.postData() ?? ''),
        });
      }
    };

    try {
      new Promise<void>(() => {
        page.on('request', requestHandler);
      });

      return await new Promise<
        | {
            headers: Record<string, string>;
            payload: string | undefined;
          }
        | undefined
      >(resolve => {
        eventEmitter.on('listenRequestOver' + url ?? '', result => {
          resolve(result);
        });
      });
    } finally {
      page.off('request', requestHandler);
      eventEmitter.removeAllListeners('listenRequestOver' + url ?? '');
    }
  }

  async inputText(page: Page, text: string, clearDefaults: boolean, needDelay?: boolean): Promise<void> {
    if (clearDefaults) {
      await page.keyboard.down('Control');
      await delay(random(50, 100));
      await page.keyboard.down('A');
      await delay(random(50, 100));
      await page.keyboard.up('A');
      await delay(random(50, 100));
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace', {
        delay: random(50, 100),
      });
    }

    const options =
      needDelay === false
        ? undefined
        : {
            delay: random(50, 100),
          };

    await page.keyboard.type(text, options);
  }

  async screenshot({
    type,
    customImgBuffer,
    id,
    imageFormat,
    imageQuality,
    fullPage,
  }: {
    type?: string;
    customImgBuffer?: Buffer;
    id?: string;
    imageFormat?: 'png' | 'jpeg' | 'webp';
    imageQuality?: number;
    fullPage?: boolean;
  }): Promise<void> {
    const browserPage = this.browserPages[0];

    if (typeof browserPage === 'undefined' || typeof type === 'undefined') {
      return;
    }

    const currentDate = moment();
    const fileName = `${PROJECT_NAME}/${currentDate.format('YYYY')}/${currentDate.format('MM')}/${currentDate.format('DD')}/${type}/${id ?? randomUUID()}`;

    try {
      let pageImage: Buffer | undefined;
      if (!customImgBuffer) {
        this.logger.log('使用浏览器截图');
        pageImage = await browserPage.screenshot({
          type: typeof imageFormat === 'undefined' ? SAVE_IMAGE_FORMAT : imageFormat,
          quality: typeof imageQuality === 'undefined' ? IMAGE_QUALITY : imageQuality,
          fullPage: fullPage ?? false,
        });
      } else {
        this.logger.log('使用自定义图片');
        pageImage = customImgBuffer;
      }

      if (pageImage !== undefined) {
        // 将图片保存到本地
        const path = this.configService.get<string>('SCREENSHOT_PATH', './public');

        // 分隔符
        let separator = '/';
        if (path.includes('\\')) {
          separator = '\\';
        }

        await fs.writeFile(`${path}${separator}${fileName}.${SAVE_IMAGE_FORMAT}`, pageImage);
      } else {
        this.logger.error('pageImage为空');
      }
    } catch (err) {
      this.logger.error('截图上传失败', { err });
    }
  }

  /**
   * 根据 XPath 点击元素
   * @param data
   */
  async clickElementByXPath(data: {
    xpath: string;
    page?: Page;
    operationType?: string;
    elementIndex?: number;
    timeout?: number;
    scroll?: boolean;
  }): Promise<ElementHandle | undefined> {
    try {
      if (isEmpty(data.page)) {
        data.page = this.browserPages[0];
      }

      let element: ElementHandle = (await data.page.waitForSelector('xpath/' + data.xpath, {
        timeout: data.timeout ?? ms('5s'),
      })) as ElementHandle;

      if (data.elementIndex) {
        const elements = await data.page?.$$('xpath/' + data.xpath);
        element = elements[data.elementIndex === -1 ? elements.length - 1 : data.elementIndex] as ElementHandle;
      }

      // 有的隐藏元素是没有 boundingBox 的
      if (data.scroll) {
        try {
          // 将屏幕滚动到元素中间位置
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            await data.page.mouse.wheel({
              deltaY: boundingBox.y - 200,
            });
            await delay(ms('1s'));
          }
        } catch (e) {}
      }

      await element.click();

      return element;
    } catch (err) {
      if (this.configService.get('DEBUG') === 'true') {
        console.log(err);
      }
      if (data.operationType && this.configService.get('DEBUG') !== 'true') {
        this.logger.warn(data.operationType + '点击元素失败');
      } else {
        this.logger.log(data.operationType + '点击元素失败');
      }
    }
  }

  /**
   * 根据 XPath 等待元素
   * @param data
   */
  async waitElementByXPath(data: { xpath: string; page?: Page; operationType?: string; timeout?: number }): Promise<ElementHandle<Node> | null> {
    try {
      if (isEmpty(data.page)) {
        data.page = this.browserPages[0];
      }

      return await data.page?.waitForSelector('xpath/' + data.xpath, {
        timeout: data.timeout ?? ms('10s'),
      });
    } catch (err) {
      if (data.operationType) {
        this.logger.warn(data.operationType + '等待元素失败');
      }

      return null;
    }
  }

  async uploadFileByBuffer(page: Page, buffer: Buffer, fileName: string, fileType: string): Promise<void> {
    await page.evaluate(
      async (bufferFile, bufferFileName, mimeType) => {
        const inputElement = document.activeElement?.closest('form')?.querySelector<HTMLInputElement>('input[type=file]');

        const arrayBuffer = new Int8Array(bufferFile.data);

        const uploadFile = new File([arrayBuffer], bufferFileName, {
          type: mimeType,
        });

        const container = new DataTransfer();

        container.items.add(uploadFile);

        if (inputElement != null) {
          // eslint-disable-next-line no-param-reassign
          inputElement.files = container.files;

          inputElement.dispatchEvent(
            new Event('change', {
              bubbles: true,
            }),
          );
        }
      },
      buffer as any,
      fileName,
      fileType,
    );
  }

  /**
   * 拖拽文件
   * @param page
   * @param filePath 要拖拽的文件路径
   * @param drop 拖拽到的元素
   * @param input 文件输入框
   */
  async dragFile(page: Page, filePath: string, drop: ElementHandle<Element>, input?: ElementHandle<HTMLInputElement>): Promise<boolean> {
    try {
      if (!input) {
        input = (await page.evaluateHandle(() => {
          const _input = document.createElement('INPUT');
          _input.setAttribute('type', 'file');
          document.documentElement.appendChild(_input);
          return _input;
        })) as ElementHandle<HTMLInputElement>;
      }

      await input.uploadFile(filePath);

      //  拖拽文件到drop区域
      await page.evaluate(
        (_drop, _input) => {
          const _dataTransfer = new DataTransfer();
          const files: FileList | null = _input.files;
          if (!files) {
            return;
          }

          _dataTransfer.items.add(files[0]);
          const _event: DragEvent = new DragEvent('drop', {
            dataTransfer: _dataTransfer,
            bubbles: true,
            cancelable: true,
          });
          _drop.dispatchEvent(_event);
        },
        drop,
        input,
      );
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * 根据传入的对象和属性名遍历获取属性值
   */
  getPropertyValue(obj: any, propertyName: string): any | undefined {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        // 如果当前属性是要获取的属性,则返回
        if (key === propertyName) {
          return value;
        }

        // 如果当前属性是数组,则遍历数组
        if (Array.isArray(value)) {
          for (const item of value) {
            const result = this.getPropertyValue(item, propertyName);
            if (result !== undefined) {
              return result;
            }
          }
        } else if (typeof value === 'object' && value) {
          // 如果当前属性是对象，则递归调用
          const result = this.getPropertyValue(value, propertyName);
          if (result !== undefined) {
            return result;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * 枚举转Map , key和value包含了枚举的key和value的所有对应关系
   * @param enumObj
   */
  enumToMap<T extends NonNullable<unknown>>(enumObj: T): Map<string, T[Extract<keyof T, string>]> {
    const map = new Map<string, T[Extract<keyof T, string>]>();
    for (const key in enumObj) {
      if (enumObj.hasOwnProperty(key)) {
        const value = enumObj[key];
        map.set(key, value);
      }
    }
    return map;
  }

  async getTextByXPathList(data: { page?: Page; xpathList: string[] }): Promise<string[]> {
    if (isEmpty(data.page)) {
      data.page = this.browserPages[0];
    }

    return await data.page.evaluate(xpathList => {
      const result: string[] = [];
      for (const xpath of xpathList) {
        const element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (element) {
          result.push(element.textContent ?? '');
        }
      }
      return result;
    }, data.xpathList);
  }

  async closeBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (err) {
      this.logger.error('关闭浏览器失败', { err });
    }
  }
}
