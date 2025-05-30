#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Add Bun to the PATH
export PATH="/Users/jasonlaster/.bun/bin:$PATH"

# Load environment variables if .env exists
if [ -f .env ]; then
    source .env
fi

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/output/logs"

# Run the script with timestamped log file
bun ./rename.ts >> "$PROJECT_DIR/output/logs/rename-$(date +\%Y-\%m-\%dT\%H-\%M-\%S).log" 2>&1