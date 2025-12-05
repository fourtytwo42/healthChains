#!/bin/bash

# Start Hardhat node in the background
# This script starts a Hardhat node for testing purposes

set -e

HARDHAT_NODE_PID_FILE=".hardhat-node.pid"
HARDHAT_NODE_LOG=".hardhat-node.log"

# Check if node is already running
if [ -f "$HARDHAT_NODE_PID_FILE" ]; then
    PID=$(cat "$HARDHAT_NODE_PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Hardhat node is already running (PID: $PID)"
        exit 0
    else
        # Remove stale PID file
        rm -f "$HARDHAT_NODE_PID_FILE"
    fi
fi

echo "Starting Hardhat node..."
npx hardhat node > "$HARDHAT_NODE_LOG" 2>&1 &
HARDHAT_PID=$!

# Save PID
echo $HARDHAT_PID > "$HARDHAT_NODE_PID_FILE"

# Wait for node to be ready (check if port 8545 is listening)
echo "Waiting for Hardhat node to be ready..."
for i in {1..30}; do
    # Try to connect to the node using curl or netcat
    if command -v nc >/dev/null 2>&1; then
        if nc -z localhost 8545 2>/dev/null; then
            echo "✅ Hardhat node is ready (PID: $HARDHAT_PID)"
            exit 0
        fi
    elif command -v curl >/dev/null 2>&1; then
        if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545 >/dev/null 2>&1; then
            echo "✅ Hardhat node is ready (PID: $HARDHAT_PID)"
            exit 0
        fi
    else
        # Fallback: just wait a bit
        sleep 2
        if [ $i -eq 15 ]; then
            echo "✅ Hardhat node started (PID: $HARDHAT_PID) - assuming ready"
            exit 0
        fi
    fi
    sleep 1
done

echo "❌ Hardhat node failed to start within 30 seconds"
kill $HARDHAT_PID 2>/dev/null || true
rm -f "$HARDHAT_NODE_PID_FILE"
exit 1

