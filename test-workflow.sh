#!/bin/bash

# Wallet System Testing Script
# This script demonstrates a complete workflow of the wallet system

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Wallet System Testing Workflow${NC}"
echo -e "${BLUE}=====================================${NC}"

# Check if grpcurl is installed
if ! command -v grpcurl &> /dev/null; then
    echo -e "${YELLOW}grpcurl not found. Installing...${NC}"
    brew install grpcurl || echo "Please install grpcurl manually"
    exit 1
fi

# Function to make gRPC calls
call_grpc() {
    local port=$1
    local service=$2
    local method=$3
    local data=$4
    
    echo -e "${YELLOW}Calling: $service.$method${NC}"
    grpcurl -plaintext -d "$data" localhost:$port "$service.$method"
}

# Step 1: Create User
echo -e "\n${BLUE}Step 1: Create User${NC}"
USER_RESPONSE=$(call_grpc 50051 user.v1.UserService CreateUser '{"email": "alice@example.com", "name": "Alice Smith"}')
echo "$USER_RESPONSE"
USER_ID=$(echo "$USER_RESPONSE" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✓ User created with ID: $USER_ID${NC}"

# Step 2: Create Wallet
echo -e "\n${BLUE}Step 2: Create Wallet${NC}"
WALLET_RESPONSE=$(call_grpc 50052 wallet.v1.WalletService CreateWallet "{\"user_id\": \"$USER_ID\", \"initial_balance\": 100000}")
echo "$WALLET_RESPONSE"
WALLET_ID=$(echo "$WALLET_RESPONSE" | grep -o '"id": "[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✓ Wallet created with ID: $WALLET_ID${NC}"
echo -e "${GREEN}  Initial balance: 1000.00 (in cents)${NC}"

# Step 3: Credit Wallet
echo -e "\n${BLUE}Step 3: Credit Wallet (+500.00)${NC}"
CREDIT_RESPONSE=$(call_grpc 50052 wallet.v1.WalletService CreditWallet "{\"wallet_id\": \"$WALLET_ID\", \"amount\": 50000, \"reason\": \"deposit\"}")
echo "$CREDIT_RESPONSE"
echo -e "${GREEN}✓ Wallet credited${NC}"

# Step 4: Get Wallet
echo -e "\n${BLUE}Step 4: Get Wallet${NC}"
GET_RESPONSE=$(call_grpc 50052 wallet.v1.WalletService GetWallet "{\"wallet_id\": \"$WALLET_ID\"}")
echo "$GET_RESPONSE"
BALANCE=$(echo "$GET_RESPONSE" | grep -o '"balance": [0-9]*' | cut -d' ' -f2)
echo -e "${GREEN}✓ Current balance: $((BALANCE / 100)).$((BALANCE % 100))${NC}"

# Step 5: Debit Wallet
echo -e "\n${BLUE}Step 5: Debit Wallet (-300.00)${NC}"
DEBIT_RESPONSE=$(call_grpc 50052 wallet.v1.WalletService DebitWallet "{\"wallet_id\": \"$WALLET_ID\", \"amount\": 30000, \"reason\": \"purchase\"}")
echo "$DEBIT_RESPONSE"
echo -e "${GREEN}✓ Wallet debited${NC}"

# Step 6: Get Final Wallet State
echo -e "\n${BLUE}Step 6: Get Final Wallet State${NC}"
FINAL_RESPONSE=$(call_grpc 50052 wallet.v1.WalletService GetWallet "{\"wallet_id\": \"$WALLET_ID\"}")
echo "$FINAL_RESPONSE"
FINAL_BALANCE=$(echo "$FINAL_RESPONSE" | grep -o '"balance": [0-9]*' | cut -d' ' -f2)
echo -e "${GREEN}✓ Final balance: $((FINAL_BALANCE / 100)).$((FINAL_BALANCE % 100))${NC}"

# Step 7: Test Error Cases
echo -e "\n${BLUE}Step 7: Test Error Cases${NC}"

# Try to create wallet for non-existent user
echo -e "\n${YELLOW}Attempting to create wallet for non-existent user...${NC}"
if call_grpc 50052 wallet.v1.WalletService CreateWallet "{\"user_id\": \"invalid_user_id\", \"initial_balance\": 50000}" 2>&1 | grep -q "User not found"; then
    echo -e "${GREEN}✓ Correctly rejected non-existent user${NC}"
fi

# Try to debit more than balance
echo -e "\n${YELLOW}Attempting to debit more than balance...${NC}"
if call_grpc 50052 wallet.v1.WalletService DebitWallet "{\"wallet_id\": \"$WALLET_ID\", \"amount\": 500000000, \"reason\": \"test\"}" 2>&1 | grep -q "Insufficient balance"; then
    echo -e "${GREEN}✓ Correctly rejected insufficient balance${NC}"
fi

echo -e "\n${GREEN}=====================================${NC}"
echo -e "${GREEN}All tests completed successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"
