#!/bin/bash
cd "$(dirname "$0")"
echo "Starting the Interactive PDF Puzzle Generator..."
echo "Opening browser..."
open http://localhost:3000
echo "Starting the Next.js development server..."
npm run dev
