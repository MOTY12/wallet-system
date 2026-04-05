import { IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialBalance?: number;
}

export class GetWalletDto {
  @IsString()
  walletId: string;
}

export class CreditWalletDto {
  @IsString()
  walletId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class DebitWalletDto {
  @IsString()
  walletId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
