// esbuild configuration for Alpine.js optimization
import { build, BuildOptions, BuildResult, Plugin, Metafile } from 'esbuild';
import { resolve } from 'path';
import { statSync, writeFileSync } from 'fs';

const isDev = process.env.NODE_ENV === 'development';

// Types for bundle analysis
interface BundleInput {
  bytesInOutput: number;
}

interface BundleOutput {
  bytes: number;
  inputs?: Record<string, BundleInput>;
}

// Alpine.js optimizer plugin
const alpineOptimizerPlugin: Plugin = {
  name: 'alpine-optimizer',
  setup(build) {
    // Log bundle size and analysis
    build.onEnd((result: BuildResult) => {
      if (result.metafile) {
        const metafile = result.metafile;
        const outputSize = Object.values(metafile.outputs)[0]?.bytes || 0;
        console.log(`📦 Bundle size: ${(outputSize / 1024).toFixed(1)}KB`);
        
        // Show top contributors to bundle size
        const outputs = Object.values(metafile.outputs);
        if (outputs.length > 0 && outputs[0].inputs) {
          console.log('📊 Top bundle contributors:');
          const sortedInputs = Object.entries(outputs[0].inputs)
            .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
            .slice(0, 5);
          
          sortedInputs.forEach(([file, info]) => {
            const fileName = file.split('/').pop() || file;
            const size = (info.bytesInOutput / 1024).toFixed(1);
            const percentage = ((info.bytesInOutput / outputSize) * 100).toFixed(1);
            console.log(`  ${fileName}: ${size}KB (${percentage}%)`);
          });
        }
      }
    });
  },
};

const config: BuildOptions = {
  entryPoints: [isDev ? 'static/js/alpine-components.ts' : 'static/js/alpine-components-optimized.ts'],
  bundle: true,
  outfile: 'static/js/dashboard.min.js',
  minify: !isDev,
  sourcemap: isDev,
  target: ['es2020'],
  format: 'iife',
  platform: 'browser',
  
  // TypeScript loader configuration
  loader: {
    '.js': 'js',
    '.ts': 'ts',
    '.jsx': 'jsx',
    '.tsx': 'tsx',
  },
  
  // Path resolution for TypeScript aliases
  resolveExtensions: ['.ts', '.js', '.tsx', '.jsx'],
  alias: {
    '@components': resolve('static/js/components'),
    '@utils': resolve('static/js/utils'),
    '@': resolve('static/js'),
  },
  
  // Enhanced optimization settings
  treeShaking: true,
  metafile: true,
  
  // External dependencies (loaded via CDN)
  external: [],
  
  // Define global variables for production
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env.DEBUG': JSON.stringify(isDev ? 'true' : 'false'),
  },
  
  // Bundle splitting for better caching
  splitting: false, // Keep false for IIFE format
  
  // Enhanced size optimization
  dropLabels: isDev ? [] : ['DEV'],
  drop: isDev ? [] : ['console', 'debugger'],
  mangleProps: isDev ? undefined : /^_/,
  
  // Banner to identify build
  banner: {
    js: `// MCP Dashboard Alpine.js Bundle - Built ${new Date().toISOString()}`,
  },
  
  // Plugins for additional optimization
  plugins: [alpineOptimizerPlugin],
};

export default config;

/**
 * Get file size in human-readable format using Node.js fs
 * @param filePath - Path to the file
 * @returns Human-readable file size
 */
function getFileSize(filePath: string): string {
  try {
    const stats = statSync(filePath);
    const bytes = stats.size;
    
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'] as const;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  } catch (error) {
    return 'N/A';
  }
}

// Build function for package.json scripts
export async function buildProduction(): Promise<void> {
  try {
    const result = await build(config);
    
    if (result.metafile) {
      // Write metafile for analysis using Node.js fs
      writeFileSync('static/js/bundle-meta.json', JSON.stringify(result.metafile, null, 2));
      
      // Show bundle size using Node.js instead of shell commands
      const bundleSize = getFileSize('static/js/dashboard.min.js');
      console.log(`📦 Bundle size: ${bundleSize}`);
    }
    
    console.log('✅ Production build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    (process as any).exit(1);
  }
}

export async function buildDevelopment(): Promise<void> {
  try {
    const devConfig: BuildOptions = {
      ...config,
      minify: false,
      sourcemap: true,
      define: {
        ...config.define,
        'process.env.NODE_ENV': '"development"',
        'process.env.DEBUG': '"true"',
      },
    };
    
    const result = await build(devConfig);
    
    if (result.metafile) {
      const metafile = result.metafile;
      
      // Write metafile for development analysis
      writeFileSync('static/js/bundle-meta.json', JSON.stringify(metafile, null, 2));
      
      // Show detailed bundle information in development
      const bundleSize = getFileSize('static/js/dashboard.min.js');
      console.log(`📦 Bundle size: ${bundleSize}`);
      
      // Show component breakdown
      const outputs = Object.values(metafile.outputs);
      if (outputs.length > 0 && outputs[0].inputs) {
        console.log('📊 Component breakdown:');
        const sortedInputs = Object.entries(outputs[0].inputs)
          .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
          .slice(0, 5);
        
        sortedInputs.forEach(([file, info]) => {
          const fileName = file.split('/').pop() || file;
          const size = (info.bytesInOutput / 1024).toFixed(1);
          console.log(`  ${fileName}: ${size}KB`);
        });
      }
    }
    
    console.log('✅ Development build completed successfully');
  } catch (error) {
    console.error('❌ Development build failed:', error);
    (process as any).exit(1);
  }
}

// Auto-build based on NODE_ENV
if (process.env.NODE_ENV === 'development') {
  buildDevelopment();
} else {
  buildProduction();
}