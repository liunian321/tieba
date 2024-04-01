import { Test, TestingModule } from '@nestjs/testing';
import { BarModule } from '../bar/bar.module';
import { BarService } from '../bar/bar.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import ms from 'ms';

describe('BarService', () => {
  let barService: BarService;
  let configService: ConfigService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [BarModule, ConfigModule.forRoot({ isGlobal: true })],
    }).compile();

    barService = await module.resolve<BarService>(BarService);
    configService = await module.resolve<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    await module.close();
  });

  it(
    '收集个人数据',
    async () => {
      const accountId = configService.get<string>('ACCOUNT_ID');
      if (!accountId) {
        throw new Error('账号ID为空');
      }

      expect(await barService.collectPersonalInformation(accountId)).not.toBeNull();
    },
    ms('30m'),
  );
});
