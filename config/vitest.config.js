/**
 * Vitest Configuration for Alpine.js Component Testing
 * 
 * This configuration sets up Vitest for testing Alpine.js components
 * in a browser-like environment using jsdom.
 */
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Use jsdom environment for browser-like testing
    environment: 'jsdom',
    
    // Global test settings
    globals: true,
    
    // Setup file for Alpine.js initialization
    setupFiles: ['./tests/setup.js'],
    
    // Test file patterns
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.js',
        'static/js/dashboard.min.js',
        'build.js'
      ],
      include: [
        'static/js/components/**/*.js',
        'static/js/utils/**/*.js'
      ]
    },
    
    // Test reporter
    reporters: ['verbose'],
    
    // Retry flaky tests
    retry: 0,
    
    // Test timeout
    testTimeout: 10000
  },
  
  // Resolve aliases for cleaner imports in tests
  resolve: {
    alias: {
      '@components': resolve(__dirname, './static/js/components'),
      '@utils': resolve(__dirname, './static/js/utils'),
      '@': resolve(__dirname, './static/js')
    }
  },
  
  // Define global variables for tests
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.DEBUG': '"false"'
  }
});