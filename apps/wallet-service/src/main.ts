import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const grpcHost = process.env.GRPC_HOST || 'localhost';
  const grpcPort = parseInt(process.env.GRPC_PORT || '50052', 10);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: ['wallet.v1'],
      protoPath: [require.resolve('@wallet-system/proto/proto/wallet/v1/wallet.proto')],
      url: `${grpcHost}:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();
  logger.log(`Wallet Service running on gRPC ${grpcHost}:${grpcPort}`);
}

bootstrap();
