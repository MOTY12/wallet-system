# API Reference

Complete API documentation for the Wallet System microservices.

## User Service

**Service**: `user.v1.UserService`  
**Port**: `50051`

### Methods

#### CreateUser

Creates a new user with the given email and name.

**Request**:
```protobuf
message CreateUserRequest {
  string email = 1;
  string name = 2;
}
```

**Response**:
```protobuf
message User {
  string id = 1;
  string email = 2;
  string name = 3;
  int64 created_at = 4; // Unix timestamp in milliseconds
}
```

**Example**:
```bash
grpcurl -plaintext -d '{
  "email": "alice@example.com",
  "name": "Alice Smith"
}' localhost:50051 user.v1.UserService.CreateUser
```

**Response**:
```json
{
  "id": "clvxyz123abc...",
  "email": "alice@example.com",
  "name": "Alice Smith",
  "created_at": 1712232645000
}
```

**Error Cases**:
- `INVALID_ARGUMENT`: Duplicate email
- `INVALID_ARGUMENT`: Invalid email format
- `INVALID_ARGUMENT`: Missing required fields

---

#### GetUserById

Retrieves user information by ID.

**Request**:
```protobuf
message GetUserByIdRequest {
  string user_id = 1;
}
```

**Response**:
```protobuf
message User {
  string id = 1;
  string email = 2;
  string name = 3;
  int64 created_at = 4;
}
```

**Example**:
```bash
grpcurl -plaintext -d '{
  "user_id": "clvxyz123abc..."
}' localhost:50051 user.v1.UserService.GetUserById
```

**Response**:
```json
{
  "id": "clvxyz123abc...",
  "email": "alice@example.com",
  "name": "Alice Smith",
  "created_at": 1712232645000
}
```

**Error Cases**:
- `NOT_FOUND`: User does not exist
- `INVALID_ARGUMENT`: Invalid user_id format

---

## Wallet Service

**Service**: `wallet.v1.WalletService`  
**Port**: `50052`

### Methods

#### CreateWallet

Creates a new wallet for an existing user.

**Request**:
```protobuf
message CreateWalletRequest {
  string user_id = 1;
  int64 initial_balance = 2; // Optional, defaults to 0, in cents
}
```

**Response**:
```protobuf
message Wallet {
  string id = 1;
  string user_id = 2;
  int64 balance = 3;       // Always in cents
  int64 created_at = 4;    // Unix timestamp in milliseconds
}
```

**Example**:
```bash
grpcurl -plaintext -d '{
  "user_id": "clvxyz123abc...",
  "initial_balance": 100000
}' localhost:50052 wallet.v1.WalletService.CreateWallet
```

**Response**:
```json
{
  "id": "clwxyz456def...",
  "user_id": "clvxyz123abc...",
  "balance": 100000,
  "created_at": 1712232650000
}
```

**Notes**:
- Balance of 100000 represents $1,000.00
- Wallet Service verifies user exists via gRPC call to User Service
- One wallet per user (enforced)

**Error Cases**:
- `NOT_FOUND`: User does not exist
- `INVALID_ARGUMENT`: User not found (service communication error)
- `INVALID_ARGUMENT`: Wallet already exists for user
- `INVALID_ARGUMENT`: Invalid user_id or balance

---

#### GetWallet

Retrieves wallet information by ID.

**Request**:
```protobuf
message GetWalletRequest {
  string wallet_id = 1;
}
```

**Response**:
```protobuf
message Wallet {
  string id = 1;
  string user_id = 2;
  int64 balance = 3;
  int64 created_at = 4;
}
```

**Example**:
```bash
grpcurl -plaintext -d '{
  "wallet_id": "clwxyz456def..."
}' localhost:50052 wallet.v1.WalletService.GetWallet
```

**Response**:
```json
{
  "id": "clwxyz456def...",
  "user_id": "clvxyz123abc...",
  "balance": 100000,
  "created_at": 1712232650000
}
```

**Error Cases**:
- `NOT_FOUND`: Wallet does not exist
- `INVALID_ARGUMENT`: Invalid wallet_id

---

#### CreditWallet

Adds funds to a wallet.

**Request**:
```protobuf
message CreditWalletRequest {
  string wallet_id = 1;
  int64 amount = 2;        // In cents, must be > 0
  string reason = 3;       // Optional, for audit trail
}
```

**Response**:
```protobuf
message Wallet {
  string id = 1;
  string user_id = 2;
  int64 balance = 3;
  int64 created_at = 4;
}
```

**Example**:
```bash
grpcurl -plaintext -d '{
  "wallet_id": "clwxyz456def...",
  "amount": 50000,
  "reason": "deposit"
}' localhost:50052 wallet.v1.WalletService.CreditWallet
```

**Response**:
```json
{
  "id": "clwxyz456def...",
  "user_id": "clvxyz123abc...",
  "balance": 150000,
  "created_at": 1712232650000
}
```

**Notes**:
- Amount added: $500.00 (50000 cents)
- New balance: $1,500.00 (150000 cents)
- No transaction needed (non-critical operation)

**Error Cases**:
- `NOT_FOUND`: Wallet does not exist
- `INVALID_ARGUMENT`: Amount <= 0
- `INVALID_ARGUMENT`: Invalid wallet_id

---

#### DebitWallet

Withdraws funds from a wallet (with balance validation).

**Request**:
```protobuf
message DebitWalletRequest {
  string wallet_id = 1;
  int64 amount = 2;        // In cents, must be > 0
  string reason = 3;       // Optional, for audit trail
}
```

**Response**:
```protobuf
message Wallet {
  string id = 1;
  string user_id = 2;
  int64 balance = 3;
  int64 created_at = 4;
}
```

**Example (Success)**:
```bash
grpcurl -plaintext -d '{
  "wallet_id": "clwxyz456def...",
  "amount": 30000,
  "reason": "purchase"
}' localhost:50052 wallet.v1.WalletService.DebitWallet
```

**Response**:
```json
{
  "id": "clwxyz456def...",
  "user_id": "clvxyz123abc...",
  "balance": 120000,
  "created_at": 1712232650000
}
```

**Notes**:
- Amount deducted: $300.00 (30000 cents)
- New balance: $1,200.00 (120000 cents)
- **Uses database transaction for atomicity**
- Safe under high concurrency

**Example (Insufficient Balance Failure)**:
```bash
grpcurl -plaintext -d '{
  "wallet_id": "clwxyz456def...",
  "amount": 500000,
  "reason": "unavailable"
}' localhost:50052 wallet.v1.WalletService.DebitWallet

# Error response:
# Code: 3 (INVALID_ARGUMENT)
# Message: "Insufficient balance"
```

**Error Cases**:
- `NOT_FOUND`: Wallet does not exist
- `INVALID_ARGUMENT`: Amount <= 0
- `INVALID_ARGUMENT`: Insufficient balance
- `INVALID_ARGUMENT`: Invalid wallet_id
- `INVALID_ARGUMENT`: Transaction failure

---

## Error Response Format

All gRPC errors follow this format:

```json
{
  "code": 3,
  "message": "error description",
  "details": []
}
```

### gRPC Status Codes

| Code | Name | When |
|------|------|------|
| 3 | `INVALID_ARGUMENT` | Bad input, validation error, or business logic violation |
| 5 | `NOT_FOUND` | Resource doesn't exist |
| 13 | `INTERNAL` | Server error |

---

## Testing Workflow

Complete workflow demonstrating all operations:

```bash
# 1. Create user
USER=$(grpcurl -plaintext -d '{
  "email": "test@example.com",
  "name": "Test User"
}' localhost:50051 user.v1.UserService.CreateUser)

USER_ID=$(echo $USER | jq -r '.id')
echo "Created user: $USER_ID"

# 2. Create wallet
WALLET=$(grpcurl -plaintext -d "{
  \"user_id\": \"$USER_ID\",
  \"initial_balance\": 100000
}" localhost:50052 wallet.v1.WalletService.CreateWallet)

WALLET_ID=$(echo $WALLET | jq -r '.id')
echo "Created wallet: $WALLET_ID with balance: $1000.00"

# 3. Credit wallet
grpcurl -plaintext -d "{
  \"wallet_id\": \"$WALLET_ID\",
  \"amount\": 50000,
  \"reason\": \"deposit\"
}" localhost:50052 wallet.v1.WalletService.CreditWallet
# Balance: $1500.00

# 4. Debit wallet
grpcurl -plaintext -d "{
  \"wallet_id\": \"$WALLET_ID\",
  \"amount\": 30000,
  \"reason\": \"purchase\"
}" localhost:50052 wallet.v1.WalletService.DebitWallet
# Balance: $1200.00

# 5. Get final balance
grpcurl -plaintext -d "{
  \"wallet_id\": \"$WALLET_ID\"
}" localhost:50052 wallet.v1.WalletService.GetWallet
```

---

## Balance Representation

All balances are stored and transmitted as **cents (integer)**:

| Display | Cents | Storage |
|---------|-------|---------|
| $10.50 | 1050 | 1050 |
| $1,000.00 | 100000 | 100000 |
| $0.01 | 1 | 1 |
| $1,234,567.89 | 123456789 | 123456789 |

**To convert**:
- Cents to dollars: `cents / 100`
- Dollars to cents: `dollars * 100`

---

## Service Dependencies

```
Wallet Service
    ↓ (depends on)
User Service

User Service (independent)
```

**Implication**: 
- User Service can be down and Wallet Service will fail wallet creation
- User Service data is authoritative
- Network latency between services adds to wallet creation time

---

## Rate & Scale

Designed for:
- **Throughput**: Thousands of concurrent requests
- **Latency**: Sub-100ms per operation (network dependent)
- **Consistency**: Guaranteed no balance corruption

### Performance Tips

1. Keep User Service nearby (low latency)
2. Use connection pooling for database
3. Monitor transaction times
4. Scale horizontally with load balancer

---

## Backward Compatibility

Proto versioning allows backward compatibility:

```protobuf
// v1 - Current
service WalletService {
  rpc DebitWallet (DebitWalletRequest) returns (Wallet);
}

// v2 Future - Can add without breaking v1
message DebitWalletRequestV2 {
  string wallet_id = 1;
  int64 amount = 2;
  string reason = 3;
  string currency = 4;  // NEW FIELD
}
```

Existing clients using v1 continue working while new clients use v2.
