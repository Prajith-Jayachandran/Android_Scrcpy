#!/usr/bin/env bash
set -e

# Load user environment paths
export PATH="$HOME/.local/bin:$HOME/.local/lib/nodejs/node-v22.11.0-linux-x64/bin:$PWD/bin:$PATH"
PORT="${PORT:-3000}"

echo ""
echo "========================================================"
echo "  🚀 Starting Android Web Mirror"
echo "  Open your browser at: http://localhost:${PORT}"
echo "========================================================"
echo ""

npm start
