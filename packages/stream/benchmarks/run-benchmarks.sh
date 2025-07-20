#!/bin/bash

echo -e "==============================="
echo "Running Throughput Benchmark"
echo "==============================="
echo ""
npx tsx benchmarks/throughput.ts

echo -e "\n\n==============================="
echo "Running Memory Benchmark"
echo "==============================="
echo ""
npx tsx --expose-gc benchmarks/memory.ts