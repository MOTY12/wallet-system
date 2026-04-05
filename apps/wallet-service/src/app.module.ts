import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: false,
            colorize: true,
          },
        },
      },
    }),
    WalletModule,
  ],
})
export class AppModule {}
