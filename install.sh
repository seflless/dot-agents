#!/bin/bash

# Idempotent install script for dot-agents CLI
set -e

AGENTS_DIR="$HOME/.agents"

echo "Installing dot-agents CLI..."

# Navigate to .agents directory
cd "$AGENTS_DIR"

# Install dependencies
echo "Installing dependencies..."
npm install

# Link globally
echo "Linking globally..."
npm link

echo ""
echo "Installation complete!"
echo "Run 'dot-agents status' to verify installation"
