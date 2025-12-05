#!/bin/bash

# Stop Hardhat node
# This script stops a Hardhat node that was started for testing

set -e

HARDHAT_NODE_PID_FILE=".hardhat-node.pid"

if [ ! -f "$HARDHAT_NODE_PID_FILE" ]; then
    echo "No Hardhat node PID file found. Node may not be running."
    exit 0
fi

PID=$(cat "$HARDHAT_NODE_PID_FILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "Hardhat node (PID: $PID) is not running."
    rm -f "$HARDHAT_NODE_PID_FILE"
    exit 0
fi

echo "Stopping Hardhat node (PID: $PID)..."
kill $PID 2>/dev/null || true

# Wait for process to terminate
for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Hardhat node stopped"
        rm -f "$HARDHAT_NODE_PID_FILE"
        rm -f ".hardhat-node.log"
        exit 0
    fi
    sleep 1
done

# Force kill if still running
if ps -p "$PID" > /dev/null 2>&1; then
    echo "Force killing Hardhat node..."
    kill -9 $PID 2>/dev/null || true
    rm -f "$HARDHAT_NODE_PID_FILE"
    rm -f ".hardhat-node.log"
fi

echo "✅ Hardhat node stopped"

