import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { UserModule } from './user/user.module';

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
    UserModule,
  ],
})
export class AppModule {}
