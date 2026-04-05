# Contributing Guide

Thank you for contributing to the Wallet System! This guide will help you understand how to work with the codebase effectively.

## Getting Started

1. Follow the [SETUP.md](SETUP.md) guide to get your environment ready
2. Read the [ARCHITECTURE.md](ARCHITECTURE.md) to understand design decisions
3. Review the [API.md](API.md) for service contracts

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/bug-name
```

**Naming Convention**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `chore/` - Maintenance tasks
- `refactor/` - Code improvements

### 2. Make Changes

#### Adding a New RPC Method

**Step 1**: Update proto file
```protobuf
// packages/proto/proto/wallet/v1/wallet.proto
service WalletService {
  rpc GetWalletHistory (GetWalletHistoryRequest) returns (WalletHistory);
}
```

**Step 2**: Implement service method
```typescript
// apps/wallet-service/src/wallet/wallet.service.ts
async getWalletHistory(dto: GetWalletHistoryDto): Promise<WalletHistory> {
  this.logger.log(`Fetching history for wallet: ${dto.walletId}`);
  // Implementation
}
```

**Step 3**: Add controller handler
```typescript
// apps/wallet-service/src/wallet/wallet.controller.ts
@GrpcMethod('WalletService', 'GetWalletHistory')
async getWalletHistory(data: any): Promise<any> {
  // Handle the request
}
```

**Step 4**: Create DTO and validation
```typescript
// apps/wallet-service/src/wallet/dto/wallet.dto.ts
export class GetWalletHistoryDto {
  @IsString()
  walletId: string;
}
```

#### Modifying Database Schema

**Step 1**: Update Prisma schema
```prisma
// packages/prisma/prisma/schema.prisma
model Wallet {
  // ... existing fields
  transactionHistory TransactionRecord[]  // NEW
}

model TransactionRecord {
  id        String   @id @default(cuid())
  walletId  String
  wallet    Wallet   @relation(fields: [walletId], references: [id])
  amount    BigInt
  type      String   // "credit" or "debit"
  createdAt DateTime @default(now())
}
```

**Step 2**: Create migration
```bash
cd packages/prisma
yarn migrate:dev --name add_transaction_records
```

**Step 3**: Update Prisma client usage in services
```typescript
// Both services regenerate automatically
```

### 3. Follow Code Style

#### TypeScript/JavaScript

```typescript
// ✅ DO
const user = await this.prisma.user.findUnique({
  where: { id: userId },
});

// ❌ DON'T
const user = await db.user.findUnique({where:{id:userId}});
```

#### Naming Conventions

```typescript
// Classes: PascalCase
class UserService {}
class UserController {}

// Methods: camelCase
async createUser() {}

// Constants: UPPER_SNAKE_CASE
const MAX_BALANCE = 1000000000;

// Private properties: camelCase with underscore prefix
private _userdb: PrismaClient;

// DTOs: suffix with "Dto"
class CreateUserDto {}
```

#### Imports

```typescript
// 1. External dependencies
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

// 2. Relative imports
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

// 3. Type imports (TypeScript)
import type { User } from '@prisma/client';
```

#### Comments

**Good comments** explain WHY, not WHAT:

```typescript
// ✅ GOOD - Explains intent
// Use transaction to ensure atomicity: both balance check and update
// happen atomically to prevent race conditions
await prisma.$transaction(async (tx) => {
  // ...
});

// ❌ BAD - Just restates the code
// Find user by ID
const user = await prisma.user.findUnique(...);
```

### 4. Logging

```typescript
// INFO: Important operations
this.logger.log(`User created with id: ${user.id}`);

// WARN: Unusual but recoverable
this.logger.warn(`Wallet not found: ${walletId}`);

// ERROR: System failures, exceptions
this.logger.error(`Failed to debit wallet: ${error.message}`, error);

// DEBUG: Detailed info for troubleshooting
this.logger.debug(`Fetching wallet: ${walletId}`);
```

### 5. Error Handling

```typescript
// ✅ DO: Throw NestJS exceptions
throw new NotFoundException('User not found');
throw new BadRequestException('Invalid email');

// Controller handles conversion to gRPC errors
catch (error) {
  throw new RpcException({
    code: status.NOT_FOUND,
    message: error.message,
  });
}

// ❌ DON'T: Generic errors
throw new Error('Something failed');
```

### 6. Testing Manually

```bash
# Terminal 1: User Service
cd apps/user-service && yarn dev

# Terminal 2: Wallet Service
cd apps/wallet-service && yarn dev

# Terminal 3: Test
chmod +x test-workflow.sh
./test-workflow.sh
```

### 7. Code Review Checklist

Before committing, ensure:

- [ ] Code follows style guide (2 spaces, single quotes)
- [ ] No unused variables or imports
- [ ] Proper error handling (no unhandled promises)
- [ ] DTOs validate input (class-validator rules)
- [ ] Logging added for important operations
- [ ] Comments explain WHY, not WHAT
- [ ] Database transactions used for critical operations
- [ ] BigInt used for financial amounts
- [ ] Proto files updated if needed
- [ ] Database migrations created if schema changed
- [ ] Manual testing completed

### 8. Commit Messages

Use clear, descriptive commit messages:

```bash
# ✅ GOOD
git commit -m "feat: add wallet transaction history to wallet service"
git commit -m "fix: prevent race condition in debit operation using transaction"
git commit -m "docs: add wallet API section to README"

# ❌ BAD
git commit -m "updates"
git commit -m "fix bug"
git commit -m "WIP"
```

**Format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build, dependencies

**Scope**:
- `user-service`, `wallet-service`, `proto`, `prisma`, etc.

**Example**:
```
feat(wallet-service): add debit operation with transaction safety

- Implements atomic debit using Prisma transaction
- Validates sufficient balance before debit
- Logs all debit operations for audit trail
- Handles race conditions under high concurrency

Closes #123
```

## Adding Tests

### Service Test Example

```typescript
// wallet.service.spec.ts
describe('WalletService.debitWallet', () => {
  describe('when balance is sufficient', () => {
    it('should debit wallet and return updated wallet', async () => {
      // Arrange
      const walletId = 'wallet123';
      const amount = 5000;
      const existingWallet = { balance: BigInt(10000) };
      
      // Act
      const result = await service.debitWallet({
        walletId,
        amount,
      });
      
      // Assert
      expect(result.balance).toBe(BigInt(5000));
    });
  });

  describe('when balance is insufficient', () => {
    it('should throw BadRequestException', async () => {
      // Arrange
      // Act & Assert
      await expect(
        service.debitWallet({
          walletId: 'wallet123',
          amount: 50000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
```

## Upgrading Dependencies

```bash
# Check outdated packages
yarn upgrade-interactive

# Update specific package
yarn workspace @wallet-system/user-service upgrade @nestjs/common@latest
```

## Performance Considerations

- **Database queries**: Use indexes on frequently filtered fields (email, userId)
- **BigInt operations**: Keep balance arithmetic simple and exact
- **gRPC calls**: Minimize inter-service calls where possible
- **Logging**: Use `debug` level for verbose output, keep `log` for important ops
- **Transactions**: Only use transactions where atomicity is critical (debit)

## Security Checklist

- [ ] No secrets in code or logs
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak internal details
- [ ] Database queries use parameterized queries (Prisma handles this)
- [ ] No SQL injection vectors
- [ ] Authentication/authorization planned for production

## Troubleshooting

### Port Conflicts

```bash
# Kill process using port
lsof -i :50051
kill -9 <PID>
```

### Prisma Cache Issues

```bash
# Regenerate Prisma client
yarn workspace @wallet-system/prisma generate

# Clear cache
rm -rf node_modules/.prisma
```

### Proto Changes Not Applied

```bash
# Rebuild proto dependencies
yarn workspace @wallet-system/proto build

# Reinstall services
yarn workspace @wallet-system/user-service install
yarn workspace @wallet-system/wallet-service install
```

## Getting Help

- **Architecture questions**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **API questions**: See [API.md](API.md)
- **Setup issues**: See [SETUP.md](SETUP.md)
- **Code patterns**: Look at existing service implementations

## Before Submitting PR

```bash
# Format code
yarn format

# Lint code
yarn lint

# Test manually
./test-workflow.sh

# Check for uncommitted changes
git status

# Write clear commit message
git commit -m "type(scope): clear description"
```

---

## Code Ownership

- **User Service**: User creation, retrieval, email uniqueness
- **Wallet Service**: Wallet operations (create, credit, debit)
- **Proto (packages/proto)**: gRPC service contracts
- **Prisma (packages/prisma)**: Database schema and migrations

Feel free to contribute to any area!

Happy coding! 🚀
