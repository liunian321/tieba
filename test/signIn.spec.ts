import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { SignInService } from '../src/serivce/signIn.service';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { BrowserService } from '../src/browser';
import { ConfigModule } from '@nestjs/config';
import { CommonService } from '../src/common/common.service';
import ms from 'ms';

describe('AppController', () => {
  let app: INestApplication;
  let signInService: SignInService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [AppController],
      providers: [SignInService, BrowserService, CommonService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    signInService = moduleRef.get<SignInService>(SignInService);
  });

  afterEach(async () => {
    await app.close();
  });

  it(
    'signIn',
    async () => {
      const spy = jest.spyOn(signInService, 'main');
      await request(app.getHttpServer()).get('/tieba/signIn');
      expect(spy).toHaveBeenCalled();
    },
    ms('4h'),
  );
});
