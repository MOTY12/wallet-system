import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { WalletService } from './wallet.service';
import {
  CreateWalletDto,
  GetWalletDto,
  CreditWalletDto,
  DebitWalletDto,
} from './dto/wallet.dto';
import { Wallet } from '@prisma/client';

@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @GrpcMethod('WalletService', 'CreateWallet')
  async createWallet(data: any): Promise<any> {
    try {
      const dto = new CreateWalletDto();
      dto.userId = data.user_id;
      dto.initialBalance = data.initial_balance || 0;

      const wallet = await this.walletService.createWallet(dto);
      return this.mapWalletToProto(wallet);
    } catch (error) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: error.message,
      });
    }
  }

  @GrpcMethod('WalletService', 'GetWallet')
  async getWallet(data: any): Promise<any> {
    try {
      const dto = new GetWalletDto();
      dto.walletId = data.wallet_id;

      const wallet = await this.walletService.getWallet(dto);
      return this.mapWalletToProto(wallet);
    } catch (error) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: error.message,
      });
    }
  }

  @GrpcMethod('WalletService', 'CreditWallet')
  async creditWallet(data: any): Promise<any> {
    try {
      const dto = new CreditWalletDto();
      dto.walletId = data.wallet_id;
      dto.amount = data.amount;
      dto.reason = data.reason || '';

      const wallet = await this.walletService.creditWallet(dto);
      return this.mapWalletToProto(wallet);
    } catch (error) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: error.message,
      });
    }
  }

  @GrpcMethod('WalletService', 'DebitWallet')
  async debitWallet(data: any): Promise<any> {
    try {
      const dto = new DebitWalletDto();
      dto.walletId = data.wallet_id;
      dto.amount = data.amount;
      dto.reason = data.reason || '';

      const wallet = await this.walletService.debitWallet(dto);
      return this.mapWalletToProto(wallet);
    } catch (error) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: error.message,
      });
    }
  }

  /**
   * Convert Wallet entity to gRPC proto format
   * Converts balance and createdAt to appropriate types
   */
  private mapWalletToProto(wallet: Wallet): any {
    return {
      id: wallet.id,
      user_id: wallet.userId,
      balance: Number(wallet.balance), // BigInt to number
      created_at: wallet.createdAt.getTime(),
    };
  }
}
