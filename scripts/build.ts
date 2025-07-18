#!/usr/bin/env node

/**
 * Cross-platform build script for Rust MCP Server
 * Replaces build.sh with Node.js for better portability
 */

import { execSync } from 'child_process';
import { existsSync, statSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BUILD_MODE = process.env.BUILD_MODE || 'production';
const VERBOSE = process.env.VERBOSE === 'true';

// Color constants for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
} as const;

// Types
interface BundleOutput {
    bytes: number;
    inputs?: Record<string, { bytesInOutput: number }>;
}

interface BundleMeta {
    outputs: Record<string, BundleOutput>;
}

interface BuildTool {
    command: string;
    name: string;
}

type BuildMode = 'development' | 'production';
type Command = 'build' | 'clean' | 'watch' | 'help';

/**
 * Logger utility with colored output
 */
class Logger {
    static info(message: string): void {
        console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
    }
    
    static success(message: string): void {
        console.log(`${colors.green}✓${colors.reset} ${message}`);
    }
    
    static warning(message: string): void {
        console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
    }
    
    static error(message: string): void {
        console.log(`${colors.red}✗${colors.reset} ${message}`);
    }
    
    static step(message: string): void {
        console.log(`${colors.bright}→${colors.reset} ${message}`);
    }
}

/**
 * Execute command with cross-platform support
 * @param command - Command to execute
 * @param description - Description for logging
 * @returns Command output
 */
async function execCommand(command: string, description: string): Promise<string> {
    try {
        Logger.step(description);
        const result = execSync(command, { 
            encoding: 'utf8',
            cwd: __dirname,
            stdio: VERBOSE ? 'inherit' : 'pipe'
        });
        Logger.success(`${description} - completed`);
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error(`${description} - failed: ${errorMessage}`);
        throw error;
    }
}

/**
 * Get file size in a human-readable format
 * @param filePath - Path to the file
 * @returns Human-readable file size
 */
function getFileSize(filePath: string): string {
    if (!existsSync(filePath)) {
        return 'N/A';
    }
    
    const stats = statSync(filePath);
    const bytes = stats.size;
    
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'] as const;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Analyze bundle and show statistics
 */
async function analyzeBundleSize(): Promise<void> {
    const bundlePath = join(__dirname, 'static', 'js', 'dashboard.min.js');
    const metaPath = join(__dirname, 'static', 'js', 'bundle-meta.json');
    
    if (!existsSync(bundlePath)) {
        Logger.warning('Bundle file not found, skipping analysis');
        return;
    }
    
    Logger.info('Bundle analysis:');
    console.log(`  dashboard.min.js: ${getFileSize(bundlePath)}`);
    
    if (existsSync(metaPath)) {
        try {
            const metaContent = readFileSync(metaPath, 'utf8');
            const meta: BundleMeta = JSON.parse(metaContent);
            const outputs = Object.values(meta.outputs);
            
            if (outputs.length > 0) {
                const totalSize = outputs.reduce((sum, output) => sum + output.bytes, 0);
                console.log(`  Total bundle size: ${(totalSize / 1024).toFixed(1)}KB`);
                
                if (BUILD_MODE === 'development') {
                    console.log(`  Components breakdown:`);
                    const mainOutput = outputs[0];
                    if (mainOutput.inputs) {
                        const sortedInputs = Object.entries(mainOutput.inputs)
                            .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
                            .slice(0, 5);
                        
                        sortedInputs.forEach(([file, info]) => {
                            const fileName = file.split('/').pop() || file;
                            const size = (info.bytesInOutput / 1024).toFixed(1);
                            console.log(`    ${fileName}: ${size}KB`);
                        });
                    }
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.warning(`Failed to parse bundle metadata: ${errorMessage}`);
        }
    }
}

/**
 * Check if required tools are available
 */
function checkPrerequisites(): void {
    const requiredTools: BuildTool[] = [
        { command: 'node --version', name: 'Node.js' },
        { command: 'npm --version', name: 'npm' },
        { command: 'cargo --version', name: 'Rust/Cargo' }
    ];
    
    Logger.info('Checking prerequisites...');
    
    for (const tool of requiredTools) {
        try {
            const version = execSync(tool.command, { encoding: 'utf8', stdio: 'pipe' }).trim();
            Logger.success(`${tool.name}: ${version}`);
        } catch (error) {
            Logger.error(`${tool.name} not found or not working`);
            throw new Error(`Missing required tool: ${tool.name}`);
        }
    }
}

/**
 * Main build function
 */
async function build(): Promise<void> {
    try {
        Logger.info(`Starting build in ${BUILD_MODE} mode...`);
        
        // Check prerequisites
        checkPrerequisites();
        
        // Install dependencies
        await execCommand('npm install', 'Installing dependencies');
        
        // Build Tailwind CSS
        await execCommand('npm run build-css', 'Building Tailwind CSS');
        
        // Build Alpine.js components
        const jsCommand = BUILD_MODE === 'development' ? 'npm run build-js:dev' : 'npm run build-js:prod';
        await execCommand(jsCommand, 'Building Alpine.js components');
        
        // Build Rust project
        await execCommand('cargo build --release', 'Building Rust project');
        
        // Run linter
        await execCommand('cargo clippy -- -D warnings', 'Running linter');
        
        // Bundle analysis (only in development mode)
        if (BUILD_MODE === 'development') {
            await analyzeBundleSize();
        }
        
        Logger.success('Build completed successfully!');
        
    } catch (error) {
        Logger.error('Build failed');
        (process as any).exit(1);
    }
}

/**
 * Clean function to remove build artifacts
 */
async function clean(): Promise<void> {
    const pathsToClean = [
        'target',
        'static/css/output.css',
        'static/js/dashboard.min.js',
        'static/js/dashboard.min.js.map',
        'static/js/bundle-meta.json',
        'node_modules/.cache'
    ];
    
    Logger.info('Cleaning build artifacts...');
    
    for (const path of pathsToClean) {
        const fullPath = join(__dirname, path);
        if (existsSync(fullPath)) {
            try {
                rmSync(fullPath, { recursive: true, force: true });
                Logger.success(`Removed ${path}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                Logger.warning(`Failed to remove ${path}: ${errorMessage}`);
            }
        }
    }
    
    Logger.success('Clean completed!');
}

/**
 * Watch function for development
 */
async function watch(): Promise<void> {
    Logger.info('Starting development watch mode...');
    
    try {
        // Start CSS watcher
        execSync('npm run watch-css', { 
            stdio: 'inherit',
            cwd: __dirname
        });
        
        Logger.info('CSS watcher started. Press Ctrl+C to stop.');
        
    } catch (error) {
        Logger.error('Watch mode failed');
        (process as any).exit(1);
    }
}

/**
 * Show help information
 */
function showHelp(): void {
    console.log(`
${colors.bright}Rust MCP Server Build Script${colors.reset}

Usage: node build.ts [command] [options]

Commands:
  build     Build the project (default)
  clean     Clean build artifacts
  watch     Start development watch mode
  help      Show this help message

Options:
  BUILD_MODE=development|production  Set build mode (default: production)
  VERBOSE=true                       Enable verbose output

Examples:
  node build.ts
  BUILD_MODE=development node build.ts
  node build.ts clean
  node build.ts watch
`);
}

// Command line argument parsing
const command = ((process as any).argv[2] || 'build') as Command;

switch (command) {
    case 'build':
        build();
        break;
    case 'clean':
        clean();
        break;
    case 'watch':
        watch();
        break;
    case 'help':
        showHelp();
        break;
    default:
        Logger.error(`Unknown command: ${command}`);
        showHelp();
        (process as any).exit(1);
}