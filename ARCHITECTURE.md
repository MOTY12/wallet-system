# Architecture & Design Decisions

This document explains the key architectural choices and patterns used in the wallet system.

## Table of Contents

1. [Monorepo Strategy](#monorepo-strategy)
2. [Microservice Communication](#microservice-communication)
3. [Database Design](#database-design)
4. [Transaction Safety](#transaction-safety)
5. [Error Handling](#error-handling)
6. [Logging & Observability](#logging--observability)
7. [Code Organization](#code-organization)

---

## Monorepo Strategy

### Why Yarn Workspaces?

**Chosen**: Yarn Workspaces with separate npm packages

**Alternatives Considered**:
- Separate repositories (rejected: harder to coordinate changes)
- pnpm workspaces (rejected: less widely adopted)
- Lerna (rejected: yarn workspaces is sufficient)

**Benefits**:
- Single source of truth for shared dependencies
- Shared proto definitions and Prisma schema
- Atomic commits for related changes
- Simplified development workflow

### Workspace Structure

```
wallet-system/
├── apps/                    # Microservices  
│   ├── user-service/
│   └── wallet-service/
├── packages/                # Shared packages
│   ├── proto/              # gRPC contracts
│   └── prisma/             # Database schema & client
└── package.json            # Root workspace config
```

**Packages are published separately but developed together.**

---

## Microservice Communication

### Why gRPC?

**Chosen**: gRPC with Protocol Buffers

**Alternatives Considered**:
- REST/HTTP (rejected: less efficient, more verbose contracts)
- Message Queues (rejected: unsuitable for synchronous wallet operations)
- GraphQL (rejected: unnecessary complexity for microservices)

**Benefits**:
- Type-safe contracts via Protocol Buffers
- High performance (binary protocol, HTTP/2)
- Streaming capabilities (future enhancement)
- Language-agnostic
- Clear versioning (proto packages)

### Proto Design Philosophy

```protobuf
// Versioning
package wallet.v1;

// Clear, minimal contracts
message CreateWalletRequest {
  string user_id = 1;
  int64 initial_balance = 2;
}

// Services keep domain logic separate
service WalletService {
  rpc CreateWallet (CreateWalletRequest) returns (Wallet);
}
```

**Key Principles**:
- One service per domain (User, Wallet)
- Versioned packages (v1, v2, etc. for future compatibility)
- Simple, focused message definitions
- No business logic in proto definitions

### Inter-Service Calls

**Wallet Service → User Service** pattern:

```typescript
// User Service gRPC client in Wallet Service
const user = await this.userServiceClient.getUserById(userId)
  .pipe(
    firstValueFrom, // Convert Observable to Promise
    catchError(),    // Handle service failures
  );
```

**Why this pattern?**
- Ensures users exist before creating wallets
- Prevents orphaned wallets
- Validates data across service boundaries
- Single source of truth for user data

---

## Database Design

### Why Single Database Per Service?

**Chosen**: Shared Prisma schema, same PostgreSQL instance (development)

In production:
- **Separate databases per service** for true independence
- May share same PostgreSQL instance or separate instances
- Shared Prisma schema ensures consistency

**Benefits**:
- **Consistency**: Single schema source of truth
- **Migrations**: Coordinated schema changes
- **Type Safety**: Shared types across services
- **Scalability**: Easy to split to separate databases later

### Schema Design

#### User Table

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  wallets   Wallet[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([email])
}
```

**Design Decisions**:
- String IDs using CUID (sortable, collision-resistant)
- Email uniqueness enforced at database level
- Timestamps for audit trail
- Index on email for fast lookups

#### Wallet Table

```prisma
model Wallet {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(...)
  balance   BigInt   @default(0)  // Cents, not dollars
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([userId])  // One wallet per user
  @@index([userId])
}
```

**Design Decisions**:
- **One wallet per user** enforced with unique constraint
- **BigInt for balance** - avoids floating-point precision issues
  - $10.50 stored as 1050 cents
  - $1,000,000.00 stored as 100000000 cents
- **Cascade delete** - wallet deleted when user deleted
- **Index on userId** - fast lookups by user

### Why BigInt for Money?

**Example Problem with floats**:
```javascript
// Floating-point arithmetic is unsafe
0.1 + 0.2 === 0.3  // false!

// With integer cents:
10 + 20 === 30  // always true
```

**Solution across team**:
- Always store money as integer cents
- Convert to/from dollars in API layer
- Database level: integers only
- Business logic: integer arithmetic

---

## Transaction Safety

### Debit Operation Atomicity

**Critical Problem**: Race conditions in concurrent debits

```typescript
// ❌ UNSAFE without transaction:
const wallet = await db.wallet.findById(id);
if (wallet.balance >= amount) {
  await db.wallet.update({
    balance: wallet.balance - amount
  });
}
// Problem: Two concurrent requests can both pass the check
```

**Solution**: Prisma Transactions

```typescript
// ✅ SAFE with transaction:
const updated = await prisma.$transaction(async (tx) => {
  const wallet = await tx.wallet.findUnique({ where: { id } });
  
  if (wallet.balance < amount) {
    throw new BadRequestException('Insufficient balance');
  }
  
  return await tx.wallet.update({
    data: { balance: wallet.balance - BigInt(amount) }
  });
});
```

**Why this works**:
- Database lock (isolation level: READ_COMMITTED)
- All operations in transaction succeed or fail together
- No partial updates possible
- Safe under high concurrency

### Isolation Levels

**PostgreSQL Isolation Level: READ_COMMITTED** (default)

| Scenario | Behavior |
|----------|----------|
| Concurrent debits | Each sees committed balance |
| Balance check + update | Atomic, no leak |
| Transaction abort | Entire debit rolled back |

---

## Error Handling

### Strategy: Fail Fast with Clear Messages

**Error Categories**:

#### 1. Validation Errors (400 INVALID_ARGUMENT)

```typescript
// User Service
if (!email.includes('@')) {
  throw new BadRequestException('Invalid email format');
}

// Wallet Service
if (amount <= 0) {
  throw new BadRequestException('Amount must be positive');
}
```

**Handled by**: class-validator DTOs + service validation

#### 2. Not Found Errors (404 NOT_FOUND)

```typescript
const user = await prisma.user.findUnique(...)
if (!user) {
  throw new NotFoundException('User not found');
}
```

**Handled by**: Service layer before business logic

#### 3. Business Logic Errors (400 INVALID_ARGUMENT)

```typescript
if (wallet.balance < amount) {
  throw new BadRequestException('Insufficient balance');
}
```

**Handled by**: Transactional checks

#### 4. System Errors (500 INTERNAL)

```typescript
} catch (error) {
  this.logger.error(`Critical failure: ${error}`, error);
  throw new BadRequestException('Operation failed');
}
```

**Handled by**: Catch-all try/catch in controller

### gRPC Error Mapping

```typescript
// Service throws NestJS exception
throw new BadRequestException('User not found');

// Controller converts to gRPC error
throw new RpcException({
  code: status.INVALID_ARGUMENT,  // or NOT_FOUND, etc.
  message: 'User not found',
});

// Client receives: grpc error code + message
```

---

## Logging & Observability

### Structured Logging with Pino

**Format**:
```json
{
  "level": 20,
  "time": 1712232645123,
  "pid": 12345,
  "hostname": "laptop",
  "msg": "Wallet debited successfully",
  "balance": 150000
}
```

**Why Pino?**
- High performance (fast JSON serialization)
- Structured output (easy for log aggregation)
- Pretty printing in development
- Minimal overhead in production

### Logging Points

**Operation Start**:
```typescript
this.logger.log(`Creating wallet for user: ${userId}`);
```

**Important Milestones**:
```typescript
this.logger.log(`Wallet created with id: ${wallet.id}`);
```

**Warnings**:
```typescript
this.logger.warn(`Wallet not found: ${walletId}`);
```

**Errors**:
```typescript
this.logger.error(`Failed to debit wallet: ${error.message}`, error);
```

**Debug Info**:
```typescript
this.logger.debug(`Fetching wallet: ${walletId}`);
```

### Production Integration

```yaml
# ELK Stack example
filebeat → Elasticsearch ← Kibana

# Real-time dashboards for:
# - Error rates
# - Transaction latency
# - Service health
# - Financial operation tracking
```

---

## Code Organization

### Module Pattern

Each service follows NestJS module pattern:

```
user-service/src/
├── main.ts                 # Entry point
├── app.module.ts           # Root module
├── user/
│   ├── user.module.ts      # Feature module
│   ├── user.service.ts     # Business logic
│   ├── user.controller.ts  # gRPC handlers + mapping
│   └── dto/
│       └── user.dto.ts     # Data transfer objects
└── prisma/
    └── prisma.service.ts   # Database client
```

### Separation of Concerns

| Layer | Responsibility | Example |
|-------|---|---|
| **Controller** | gRPC handling, proto mapping | `CreateUser` proto → CreateUserDto |
| **Service** | Business logic, validation | Check email uniqueness, create user |
| **DTO** | Input validation | `@IsEmail()`, `@MinLength()` |
| **Prisma** | Database access | `user.create()`, `user.findUnique()` |

### Data Flow

```
gRPC Request (CreateUserRequest)
    ↓
Controller.createUser()
    - Validates existence of proto service
    - Maps proto to DTO
    ↓
Service.createUser(dto)
    - Validates business rules
    - Calls Prisma
    ↓
Prisma
    - Executes SQL
    - Returns User entity
    ↓
Controller maps User → proto
    ↓
gRPC Response (User)
```

---

## Scalability Considerations

### As Traffic Grows

1. **Database**: Use read replicas, connection pooling
2. **Services**: Horizontal scaling with Kubernetes
3. **gRPC**: Circuit breakers between services
4. **Monitoring**: Prometheus metrics + alerting
5. **Testing**: Load testing for debit operations

### As Features Grow

1. **Proto**: Add new services (LoanService, PaymentService)
2. **Schema**: Extend User, Wallet without breaking changes
3. **Modules**: Add new feature modules within services
4. **Transactions**: More complex multi-service transactions

### As Team Grows

1. **Ownership**: One team per service (User/Wallet)
2. **Contracts**: Proto files are formal contracts
3. **Testing**: Integration tests between services
4. **Documentation**: Keep proto and architecture docs current

---

## Testing Strategy

### Unit Tests (Services)

```typescript
describe('WalletService.debitWallet', () => {
  it('should debit wallet when balance sufficient', async () => {
    // Arrange
    const wallet = { balance: BigInt(10000) };
    
    // Act
    const result = await service.debitWallet({
      walletId: 'w1',
      amount: 5000,
    });
    
    // Assert
    expect(result.balance).toBe(BigInt(5000));
  });
});
```

### Integration Tests (gRPC)

```typescript
it('should create wallet and verify via GetWallet', async () => {
  const created = await client.CreateWallet(/* ... */);
  const fetched = await client.GetWallet({ wallet_id: created.id });
  expect(fetched.id).toBe(created.id);
});
```

### E2E Tests (Full Workflow)

```bash
# Create user → Create wallet → Credit → Debit → Verify
```

---

## Summary

**Key Principles**:
- ✅ Monorepo for coordinated development
- ✅ gRPC for efficient, type-safe communication
- ✅ Single schema, separate services
- ✅ Transactions for critical operations
- ✅ Structured logging for observability
- ✅ Clear error handling and validation
- ✅ Modular, testable code structure

**Production Readiness Checklist**:
- [ ] Separate databases per service
- [ ] mTLS for gRPC communication
- [ ] Circuit breakers between services
- [ ] Comprehensive monitoring & alerting
- [ ] Load testing & capacity planning
- [ ] Backup & disaster recovery
- [ ] Security audit (SQL injection, etc.)
- [ ] Compliance review (financial regulations)
