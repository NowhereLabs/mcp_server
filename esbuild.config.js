// esbuild configuration for Alpine.js optimization
import { build } from 'esbuild';
import { resolve } from 'path';

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
  
  // Optimization settings
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
  
  // Optimize for size
  dropLabels: isDev ? [] : ['DEV'],
  
  // Banner to identify build
  banner: {
    js: `// MCP Dashboard Alpine.js Bundle - Built ${new Date().toISOString()}`,
  },
  
  // Plugins for additional optimization
  plugins: [
    {
      name: 'alpine-optimizer',
      setup(build) {
        // Log bundle size
        build.onEnd((result) => {
          if (result.metafile) {
            const outputSize = Object.values(result.metafile.outputs)[0]?.bytes || 0;
            console.log(`Bundle size: ${(outputSize / 1024).toFixed(1)}KB`);
          }
        });
      },
    },
  ],
};

export default config;

// Build function for package.json scripts
export async function buildProduction() {
  try {
    const result = await build(config);
    
    if (result.metafile) {
      // Write metafile for analysis
      const fs = await import('fs');
      fs.writeFileSync('static/js/bundle-meta.json', JSON.stringify(result.metafile, null, 2));
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