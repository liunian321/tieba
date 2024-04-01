import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../app.controller';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { BrowserService } from '../browser';
import { ConfigModule } from '@nestjs/config';
import { CommonService } from '../common/common.service';
import ms from 'ms';
import { SignInService } from '../signIn/signIn.service';

describe('AppController', () => {
  let app: INestApplication;
  let signInService: SignInService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [AppController],
      providers: [SignInService, BrowserService, CommonService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    signInService = moduleRef.get<SignInService>(SignInService);
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    '签到 应该可以成功',
    async () => {
      const spy = jest.spyOn(signInService, 'main');
      await request(app.getHttpServer()).get('/tieba/signIn');
      expect(spy).toHaveBeenCalled();
    },
    ms('4h'),
  );
});
