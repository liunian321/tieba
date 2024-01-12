import { Injectable, Logger } from '@nestjs/common';
import { now } from 'moment';
import { ElementHandle, HTTPRequest, HTTPResponse, Page } from 'puppeteer';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { PROXY_FAILED_FLAG_LIST } from './constant/error.constant';
import { blockedContentTypes, exceptionFlags } from './constant/block.constant';
import { EventEmitter } from 'events';
import { delay } from 'bluebird';
import { random } from 'lodash';

const eventEmitter = new EventEmitter();

@Injectable()
export class CommonService {
  private readonly logger: Logger = new Logger(CommonService.name);
  constructor(private readonly configService: ConfigService) {}

  /**
   * 跳转页面
   * @param url 页面地址
   * @param page
   * @param timeout 超时时间
   */
  async gotoPage(url: string, page: Page, timeout?: number) {
    let response: HTTPResponse | null = null;
    const gotoPageStartTime = Date.now();
    try {
      response = await page.goto(url, {
        waitUntil: 'load',
        timeout: timeout ?? ms('5m'),
      });
    } catch (err) {
      if (PROXY_FAILED_FLAG_LIST.some((flag) => err.message?.includes(flag))) {
        this.logger.error('代理失效', { err });
        throw new Error('代理失效');
      }

      if (err.message.includes('timeout')) {
        this.logger.error('跳转页面超时', { err });
        throw new Error('跳转页面超时');
      }

      this.logger.error(err.message ?? '打开页面失败', { err });
      throw new Error('打开页面失败');
    }

    if (response === null) {
      this.logger.error('跳转页面超时');
      throw new Error('跳转页面超时');
    }

    if (response.status() === 429) {
      this.logger.error('代理已被限流');
      throw new Error('代理已被限流');
    }

    this.logger.log('跳转页面成功', {
      gotoPageTime: Date.now() - gotoPageStartTime,
    });
  }

  /**
   * 如果当前页面在规定时间内没有请求和响应则返回
   * @param interval
   * @param page
   * @param timeout
   */
  async waitForNetwork(
    page: Page,
    interval?: number,
    timeout?: number,
  ): Promise<void> {
    try {
      const nowTime = now();

      await this.listenResponse(
        page,
        typeof interval === 'undefined' ? ms('1s') : interval,
        nowTime,
      );

      await Promise.any([
        new Promise((resolve) => {
          eventEmitter.on('waitNetworkOver' + nowTime, () => {
            resolve('');
          });
        }),
        timeout ?? delay(ms('30s')),
      ]);

      eventEmitter.removeAllListeners('waitNetworkOver' + nowTime);
    } catch (err) {
      if (this.configService.get('DEBUG') === 'True') {
        this.logger.error('等待网络失败', { err });
      }
    }
  }

  private async listenResponse(
    page: Page,
    interval: number = ms('1s'),
    key: string | number,
  ) {
    let i = 0;
    let j = 0;
    let hasRequest = false;
    const startTime = Date.now();
    const requestHandler = (request: HTTPRequest) => {
      if (
        !blockedContentTypes.includes(request.resourceType()) &&
        !['webSocket'].includes(request.resourceType()) &&
        !exceptionFlags.some((exceptionURL) =>
          request.url().includes(exceptionURL),
        )
      ) {
        if (!hasRequest) {
          hasRequest = true;
        }
        i--;
      }
    };

    const responseHandler = (response: HTTPResponse) => {
      const request = response.request();
      if (
        !blockedContentTypes.includes(request.resourceType()) &&
        !['webSocket'].includes(request.resourceType()) &&
        !exceptionFlags.some((exceptionURL) =>
          request.url().includes(exceptionURL),
        )
      ) {
        i++;
      }
    };

    new Promise<string>(() => {
      page.on('request', requestHandler);
    });

    new Promise<string>(() => {
      page.on('response', responseHandler);
    });

    const obj = setInterval(() => {
      if ((i <= 0 && j > 1) || (!hasRequest && j > 0)) {
        // 如果 连续两次单位时间内没有请求或者响应, 则返回
        clearInterval(obj);

        page.off('request', requestHandler);
        page.off('response', responseHandler);

        if (this.configService.get('DEBUG') === 'True') {
          console.log('等待网络结束: ' + (Date.now() - startTime) + 'ms');
        }

        eventEmitter.emit('waitNetworkOver' + key, 'waitNetworkOver');
      } else {
        j++;
      }
    }, interval);
  }

  /**
   * 根据所提供的 url 获取一个响应监听器(注意：如果一直没有符合的响应,它会一直阻塞下去)
   * @param browserPage
   * @param url 页面地址
   * @param flag 响应结果包含的关键性标志
   */
  async getResponseListenerByUrl(
    browserPage: Page,
    url?: string,
    flag?: string,
  ): Promise<string> {
    const responseHandler = async (response: HTTPResponse) => {
      if (response.status() >= 300 && response.status() < 400) {
        // 重定向的无法获取响应结果
        eventEmitter.emit('listenResponseOver' + url ?? '', '');
      }

      if (url === undefined) {
        // 如果 url 未定义, 则返回第一个响应结果
        try {
          eventEmitter.emit('listenResponseOver', await response.text());
        } catch (err) {
          eventEmitter.emit('listenResponseOver', '');
        }
      } else if (response.url().startsWith(url)) {
        let text = '';
        try {
          text = await response.text();
        } catch (err) {
          // 如果没有指定 flag, 并且响应结果为空, 则返回空字符串
          if (flag === undefined) {
            eventEmitter.emit('listenResponseOver' + url ?? '', '');
          }
        }

        if (flag === undefined || text.includes(flag)) {
          try {
            JSON.parse(text);
            try {
              eventEmitter.emit('listenResponseOver' + url ?? '', text);
            } catch (err) {
              this.logger.error('发送数据失败', { err });
              eventEmitter.emit('listenResponseOver' + url ?? '', '');
            }
          } catch (err) {
            try {
              text = text.replace('for (;;);', '');
              JSON.parse(text);
              try {
                eventEmitter.emit('listenResponseOver' + url ?? '', text);
              } catch (err) {
                this.logger.error('发送数据失败', { err });
                eventEmitter.emit('listenResponseOver' + url ?? '', '');
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
        browserPage.on('response', responseHandler);
      });

      return await new Promise<string>((resolve) => {
        eventEmitter.on('listenResponseOver' + url ?? '', (result) => {
          resolve(result);
        });
      });
    } finally {
      browserPage.off('response', responseHandler);
      eventEmitter.removeAllListeners('listenResponseOver' + url ?? '');
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
    const requestHandler = async (request: HTTPRequest) => {
      let req: HTTPRequest | undefined;

      if (url === undefined) {
        // 如果 url 未定义, 则返回第一个请求结果
        req = request;
      } else if (
        request.url().startsWith(url) &&
        (flag === undefined || request.postData()?.includes(flag))
      ) {
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
      >((resolve) => {
        eventEmitter.on('listenRequestOver' + url ?? '', (result) => {
          resolve(result);
        });
      });
    } finally {
      page.off('request', requestHandler);
      eventEmitter.removeAllListeners('listenRequestOver' + url ?? '');
    }
  }

  async inputText(
    page: Page,
    text: string,
    clearDefaults: boolean,
    needDelay?: boolean,
  ) {
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

  /**
   * 根据 XPath 点击元素
   * @param xpath 点击元素的 XPath
   * @param page
   * @param businessType 点击元素的业务类型
   * @param elementIndex 点击第几个元素(从 0 开始)
   * @param timeout
   * @param scroll
   */
  async clickElementByXPath({
    xpath,
    page,
    businessType,
    elementIndex,
    timeout,
    scroll,
  }: {
    xpath: string;
    page: Page;
    businessType?: string;
    elementIndex?: number;
    timeout?: number;
    scroll?: boolean;
  }): Promise<ElementHandle | undefined> {
    try {
      let element: ElementHandle = (await page.waitForXPath(xpath, {
        timeout: timeout ?? ms('5s'),
      })) as ElementHandle;

      if (elementIndex) {
        const elements = await page.$x(xpath);
        element = elements[
          elementIndex === -1 ? elements.length - 1 : elementIndex
        ] as ElementHandle;
      }

      // 有的隐藏元素是没有 boundingBox 的
      if (scroll) {
        try {
          // 将屏幕滚动到元素中间位置
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            await page.mouse.wheel({
              deltaY: boundingBox.y - 200,
            });
            await delay(ms('1s'));
          }
        } catch (e) {}
      }

      await element.click();

      return element;
    } catch (err) {
      if (this.configService.get('DEBUG') === 'True') {
        console.log(err);
      }
      if (businessType && this.configService.get('DEBUG') !== 'True') {
        this.logger.warn(businessType + '点击元素失败');
        // this.logger.assign({
        //   clickErrorType: businessType,
        // });
      } else {
        this.logger.log(businessType + '点击元素失败');
      }
    }
  }

  /**
   * 根据 XPath 等待元素
   * @param xpath
   * @param page
   * @param businessType
   * @param timeout
   */
  async waitElementByXPath(
    xpath: string,
    page: Page,
    businessType?: string,
    timeout?: number,
  ): Promise<ElementHandle<Node> | null> {
    try {
      return await page.waitForXPath(xpath, {
        timeout: timeout ?? ms('10s'),
      });
    } catch (err) {
      if (businessType) {
        this.logger.warn(businessType + '等待元素失败');
      }
      return null;
    }
  }

  async uploadFileByBuffer(
    page: Page,
    buffer: Buffer,
    fileName: string,
    fileType: string,
  ) {
    await page.evaluate(
      async (bufferFile, bufferFileName, mimeType) => {
        const inputElement = document.activeElement
          ?.closest('form')
          ?.querySelector<HTMLInputElement>('input[type=file]');

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
  async dragFile(
    page: Page,
    filePath: string,
    drop: ElementHandle<Element>,
    input?: ElementHandle<HTMLInputElement>,
  ): Promise<boolean> {
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
  enumToMap<T extends NonNullable<unknown>>(
    enumObj: T,
  ): Map<string, T[Extract<keyof T, string>]> {
    const map = new Map<string, T[Extract<keyof T, string>]>();
    for (const key in enumObj) {
      if (enumObj.hasOwnProperty(key)) {
        const value = enumObj[key];
        map.set(key, value);
      }
    }
    return map;
  }
}
