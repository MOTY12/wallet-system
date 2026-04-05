import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserServiceClient } from '../user-service/user-service.client';
import {
  CreateWalletDto,
  GetWalletDto,
  CreditWalletDto,
  DebitWalletDto,
} from './dto/wallet.dto';
import { Wallet } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userServiceClient: UserServiceClient,
  ) {}

  async createWallet(createWalletDto: CreateWalletDto): Promise<Wallet> {
    const { userId, initialBalance = 0 } = createWalletDto;

    this.logger.log(`Creating wallet for user: ${userId}`);

    // Verify user exists by calling User Service
    try {
      await firstValueFrom(this.userServiceClient.getUserById(userId));
    } catch (error) {
      this.logger.error(
        `User verification failed for id: ${userId}`,
        error.message,
      );
      throw new NotFoundException('User not found');
    }

    // Check if wallet already exists for this user
    const existingWallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (existingWallet) {
      this.logger.warn(`Wallet already exists for user: ${userId}`);
      throw new BadRequestException(
        'Wallet already exists for this user',
      );
    }

    try {
      const wallet = await this.prisma.wallet.create({
        data: {
          userId,
          balance: BigInt(initialBalance),
        },
      });

      this.logger.log(`Wallet created successfully for user: ${userId}`);
      return wallet;
    } catch (error) {
      this.logger.error(`Failed to create wallet: ${error.message}`, error);
      throw new BadRequestException('Failed to create wallet');
    }
  }

  async getWallet(getWalletDto: GetWalletDto): Promise<Wallet> {
    const { walletId } = getWalletDto;

    this.logger.debug(`Fetching wallet: ${walletId}`);

    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      this.logger.warn(`Wallet not found: ${walletId}`);
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async creditWallet(creditWalletDto: CreditWalletDto): Promise<Wallet> {
    const { walletId, amount, reason } = creditWalletDto;

    this.logger.log(`Crediting wallet ${walletId} with amount: ${amount} (reason: ${reason || 'N/A'})`);

    // Verify wallet exists
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      this.logger.warn(`Wallet not found for credit: ${walletId}`);
      throw new NotFoundException('Wallet not found');
    }

    try {
      const updatedWallet = await this.prisma.wallet.update({
        where: { id: walletId },
        data: {
          balance: wallet.balance + BigInt(amount),
        },
      });

      this.logger.log(
        `Wallet ${walletId} credited successfully. New balance: ${updatedWallet.balance}`,
      );
      return updatedWallet;
    } catch (error) {
      this.logger.error(`Failed to credit wallet: ${error.message}`, error);
      throw new BadRequestException('Failed to credit wallet');
    }
  }

  /**
   * Debit wallet with transactional guarantee
   * Uses database transaction to ensure atomicity
   */
  async debitWallet(debitWalletDto: DebitWalletDto): Promise<Wallet> {
    const { walletId, amount, reason } = debitWalletDto;

    this.logger.log(`Debiting wallet ${walletId} with amount: ${amount} (reason: ${reason || 'N/A'})`);

    if (amount <= 0) {
      this.logger.warn(`Invalid debit amount: ${amount}`);
      throw new BadRequestException('Debit amount must be greater than 0');
    }

    try {
      // Use transaction to ensure atomicity
      const updatedWallet = await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { id: walletId },
        });

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        // Check sufficient balance
        const newBalance = wallet.balance - BigInt(amount);
        if (newBalance < 0n) {
          this.logger.warn(
            `Insufficient balance for wallet ${walletId}. Current: ${wallet.balance}, Requested: ${amount}`,
          );
          throw new BadRequestException('Insufficient balance');
        }

        // Perform debit
        return await tx.wallet.update({
          where: { id: walletId },
          data: { balance: newBalance },
        });
      });

      this.logger.log(
        `Wallet ${walletId} debited successfully. New balance: ${updatedWallet.balance}`,
      );
      return updatedWallet;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Failed to debit wallet: ${error.message}`, error);
      throw new BadRequestException('Failed to debit wallet');
    }
  }
}
