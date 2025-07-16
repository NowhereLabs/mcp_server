#!/usr/bin/env node

/**
 * Test Runner Script
 * 
 * This script runs the Alpine.js component tests and generates coverage reports.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

const args = process.argv.slice(2);

// Determine test mode
const isWatch = args.includes('--watch');
const isCoverage = args.includes('--coverage');
const isUI = args.includes('--ui');

// Build test command
let command = 'vitest';
let commandArgs = [];

if (isWatch) {
  commandArgs.push('--watch');
} else if (isCoverage) {
  commandArgs.push('--coverage', '--run');
} else if (isUI) {
  commandArgs.push('--ui');
} else {
  commandArgs.push('--run');
}

// Add any additional arguments
commandArgs.push(...args.filter(arg => 
  !['--watch', '--coverage', '--ui'].includes(arg)
));

console.log(`🧪 Running tests with: ${command} ${commandArgs.join(' ')}`);

// Run tests
const testProcess = spawn(command, commandArgs, {
  stdio: 'inherit',
  shell: true
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Tests completed successfully!');
    
    if (isCoverage && existsSync('./coverage/index.html')) {
      console.log('📊 Coverage report generated at: ./coverage/index.html');
    }
  } else {
    console.log(`❌ Tests failed with exit code ${code}`);
  }
  
  process.exit(code);
});

testProcess.on('error', (error) => {
  console.error('❌ Failed to run tests:', error);
  process.exit(1);
});