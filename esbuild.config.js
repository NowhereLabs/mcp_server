// esbuild configuration for Alpine.js optimization
import { build } from 'esbuild';
import { resolve } from 'path';
import { statSync, writeFileSync } from 'fs';

const isDev = process.env.NODE_ENV === 'development';

const config = {
  entryPoints: [isDev ? 'static/js/alpine-components.js' : 'static/js/alpine-components-optimized.js'],
  bundle: true,
  outfile: 'static/js/dashboard.min.js',
  minify: !isDev,
  sourcemap: isDev,
  target: ['es2020'],
  format: 'iife',
  platform: 'browser',
  
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
  plugins: [
    {
      name: 'alpine-optimizer',
      setup(build) {
        // Remove development-only code (disabled for now to avoid syntax errors)
        // Will rely on the 'drop' option instead
        // build.onLoad({ filter: /\.js$/ }, async (args) => {
        //   if (isDev) return null;
        //   // Code optimization disabled - using esbuild's drop option instead
        //   return null;
        // });
        
        // Log bundle size and analysis
        build.onEnd((result) => {
          if (result.metafile) {
            const outputSize = Object.values(result.metafile.outputs)[0]?.bytes || 0;
            console.log(`📦 Bundle size: ${(outputSize / 1024).toFixed(1)}KB`);
            
            // Show top contributors to bundle size
            const outputs = Object.values(result.metafile.outputs);
            if (outputs.length > 0 && outputs[0].inputs) {
              console.log('📊 Top bundle contributors:');
              const sortedInputs = Object.entries(outputs[0].inputs)
                .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
                .slice(0, 5);
              
              sortedInputs.forEach(([file, info]) => {
                const fileName = file.split('/').pop();
                const size = (info.bytesInOutput / 1024).toFixed(1);
                const percentage = ((info.bytesInOutput / outputSize) * 100).toFixed(1);
                console.log(`  ${fileName}: ${size}KB (${percentage}%)`);
              });
            }
          }
        });
      },
    },
  ],
};

export default config;

/**
 * Get file size in human-readable format using Node.js fs
 * @param {string} filePath - Path to the file
 * @returns {string} - Human-readable file size
 */
function getFileSize(filePath) {
  try {
    const stats = statSync(filePath);
    const bytes = stats.size;
    
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  } catch (error) {
    return 'N/A';
  }
}

// Build function for package.json scripts
export async function buildProduction() {
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
    process.exit(1);
  }
}

export async function buildDevelopment() {
  try {
    const devConfig = {
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
      // Write metafile for development analysis
      writeFileSync('static/js/bundle-meta.json', JSON.stringify(result.metafile, null, 2));
      
      // Show detailed bundle information in development
      const bundleSize = getFileSize('static/js/dashboard.min.js');
      console.log(`📦 Bundle size: ${bundleSize}`);
      
      // Show component breakdown
      const outputs = Object.values(result.metafile.outputs);
      if (outputs.length > 0 && outputs[0].inputs) {
        console.log('📊 Component breakdown:');
        const sortedInputs = Object.entries(outputs[0].inputs)
          .sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput)
          .slice(0, 5);
        
        sortedInputs.forEach(([file, info]) => {
          const fileName = file.split('/').pop();
          const size = (info.bytesInOutput / 1024).toFixed(1);
          console.log(`  ${fileName}: ${size}KB`);
        });
      }
    }
    
    console.log('✅ Development build completed successfully');
  } catch (error) {
    console.error('❌ Development build failed:', error);
    process.exit(1);
  }
}

// Auto-build based on NODE_ENV
if (process.env.NODE_ENV === 'development') {
  buildDevelopment();
} else {
  buildProduction();
}