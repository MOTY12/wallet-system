import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaService } from '../prisma/prisma.service';
import { UserServiceClient } from '../user-service/user-service.client';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.GRPC,
        options: {
          package: ['user.v1'],
          protoPath: [require.resolve('@wallet-system/proto/proto/user/v1/user.proto')],
          url: `${process.env.USER_SERVICE_HOST || 'localhost'}:${process.env.USER_SERVICE_PORT || 50051}`,
        },
      },
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService, PrismaService, UserServiceClient],
})
export class WalletModule {}
