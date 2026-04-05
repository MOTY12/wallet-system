# Setup Guide

## System Requirements

- **Node.js** 20.9.0+ (use [Volta](https://docs.volta.sh/) for version management)
- **Yarn** 4.0.1+
- **PostgreSQL** 13+ (or Docker)
- **Docker** & **Docker Compose** (optional, for PostgreSQL)

### Check Versions

```bash
node --version    # v20.x.x
yarn --version    # 4.x.x
docker --version  # Docker version XX.x.x
```

## Installation Steps

### 1. Clone Repository

```bash
git clone <repo-url>
cd wallet-system
```

### 2. Install Dependencies

```bash
yarn install
```

This will install dependencies for all workspaces defined in `package.json`.

### 3. Start PostgreSQL

#### Option A: Using Docker Compose (Recommended)

```bash
# Start database in background
docker-compose up -d

# Verify it's running
docker-compose ps

# View logs
docker-compose logs -f postgres
```

Database will be available at: `postgresql://postgres:password@localhost:5432/wallet_system_dev`

#### Option B: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create database
createdb wallet_system_dev

# Update .env file with your connection string
# DATABASE_URL="postgresql://your_user:your_password@localhost:5432/wallet_system_dev"
```

### 4. Configure Database Connection

```bash
# Copy environment file
cp packages/prisma/.env.example packages/prisma/.env

# Edit if needed (default works with docker-compose setup)
# packages/prisma/.env
```

Example `.env`:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/wallet_system_dev"
```

### 5. Run Prisma Migrations

```bash
# This creates all tables and indexes
yarn workspace @wallet-system/prisma migrate:dev

# You'll see output like:
# Environment variables loaded from packages/prisma/.env
# Prisma schema loaded from packages/prisma/prisma/schema.prisma
# Datasource "db": PostgreSQL database at "localhost:5432/wallet_system_dev"
# ...migration successful messages...
```

### 6. Start Services

#### Terminal 1: User Service

```bash
cd apps/user-service
cp .env.example .env
yarn dev
```

You should see:
```
[Nest] ... - 04/04/2024, 10:30:00 AM     LOG [Bootstrap] User Service running on gRPC localhost:50051
```

#### Terminal 2: Wallet Service

```bash
cd apps/wallet-service
cp .env.example .env
yarn dev
```

You should see:
```
[Nest] ... - 04/04/2024, 10:30:05 AM     LOG [Bootstrap] Wallet Service running on gRPC localhost:50052
```

### 7. Verify Services

Open another terminal and test:

```bash
# Install grpcurl if you haven't already
brew install grpcurl  # macOS
# or
sudo apt-get install grpcurl  # Linux

# Test User Service
grpcurl -plaintext localhost:50051 list

# Test Wallet Service  
grpcurl -plaintext localhost:50052 list
```

Both should return available services.

---

## Troubleshooting

### Database Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
- Ensure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in `.env` file
- Restart PostgreSQL: `docker-compose restart postgres`

### Port Already in Use

```
Error: listen EADDRINUSE :::50051
```

**Solution:**
```bash
# Find and kill process using port
lsof -i :50051
kill -9 <PID>

# Or use different ports in .env files
```

### gRPC Connection Refused

```
Connection refused
```

**Solution:**
- Ensure both services are running
- Check correct ports (User: 50051, Wallet: 50052)
- Try restarting services

### Proto File Not Found

```
Error: Cannot find module '@wallet-system/proto'
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules
yarn install

# Rebuild package references
yarn workspace @wallet-system/proto build
```

---

## Development Commands

### Build All Services

```bash
yarn build
```

### Watch Mode (Auto-reload)

```bash
# Terminal 1
cd apps/user-service && yarn dev

# Terminal 2
cd apps/wallet-service && yarn dev
```

### Code Formatting

```bash
# Format all code
yarn workspaces foreach run format

# Or single service
cd apps/user-service && yarn format
```

### Linting

```bash
yarn workspaces foreach run lint
```

### Database Migrations

```bash
# Create new migration
yarn workspace @wallet-system/prisma migrate:dev --name add_new_feature

# Deploy migrations (production)
yarn workspace @wallet-system/prisma migrate:deploy

# View migration status
yarn workspace @wallet-system/prisma migrate:status

# Reset database (development only!)
yarn workspace @wallet-system/prisma migrate:reset
```

---

## Testing the System

### Quick Test

```bash
# Run provided test script
chmod +x test-workflow.sh
./test-workflow.sh
```

### Manual Testing

See [API Usage](README.md#-api-usage) in README.md for detailed examples.

---

## Environment Variables

### User Service (`apps/user-service/.env`)

```env
NODE_ENV=development
GRPC_HOST=localhost
GRPC_PORT=50051
DATABASE_URL=postgresql://postgres:password@localhost:5432/wallet_system_dev
LOG_LEVEL=debug
```

### Wallet Service (`apps/wallet-service/.env`)

```env
NODE_ENV=development
GRPC_HOST=localhost
GRPC_PORT=50052
USER_SERVICE_HOST=localhost
USER_SERVICE_PORT=50051
DATABASE_URL=postgresql://postgres:password@localhost:5432/wallet_system_dev
LOG_LEVEL=debug
```

### Prisma (`packages/prisma/.env`)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/wallet_system_dev
```

---

## Next Steps

1. Read the [README.md](README.md) for architecture overview
2. Run the example workflow with `test-workflow.sh`
3. Explore the codebase structure
4. Add more features following the architecture patterns

---

## Getting Help

Check the [README.md](README.md) for:
- Architecture overview
- API usage examples
- gRPC testing tools
- Error handling reference
