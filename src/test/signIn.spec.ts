import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { BrowserModule, BrowserService } from '../browser';
import { ConfigModule } from '@nestjs/config';
import ms from 'ms';
import { SignInService } from '../signIn/signIn.service';
import { SignInModule } from '../signIn/signIn.module';
import { CommonModule } from '../common/common.module';

describe('AppController', () => {
  let app: INestApplication;
  let signInService: SignInService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [BrowserModule, CommonModule, ConfigModule.forRoot({ isGlobal: true }), SignInModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    signInService = await moduleRef.resolve<SignInService>(SignInService);
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    '签到 应该可以成功',
    async () => {
      const spy = jest.spyOn(signInService, 'main');
      await request(app.getHttpServer()).get('/signIn');
      expect(spy).toHaveBeenCalled();
    },
    ms('4h'),
  );
});
