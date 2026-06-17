#!/bin/bash
# Run all tests and save the results to a timestamped log file.
# Usage: ./run-tests.sh

# Navigate to the project root (one level up from scripts/)
cd "$(dirname "$0")/.."

# Create the logs directory if it doesn't exist
mkdir -p logs

# Generate a timestamp for the log filename
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOGFILE="logs/test_${TIMESTAMP}.log"

echo "Running tests..."
echo "Results will be saved to: ${LOGFILE}"
echo ""

# Run Jest with verbose output.
# 'tee' prints to the terminal AND writes to the log file at the same time.
npx jest --verbose 2>&1 | tee "$LOGFILE"

# Capture the exit code from Jest (not from tee)
EXIT_CODE=${PIPESTATUS[0]}

# Append a footer to the log file
echo "" >> "$LOGFILE"
echo "--- Test run completed at $(date) ---" >> "$LOGFILE"

echo ""
echo "Log saved to: ${LOGFILE}"

exit $EXIT_CODE
