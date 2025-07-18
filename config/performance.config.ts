// Performance Budget Configuration
// This file defines size limits and performance thresholds for the application

export interface PerformanceBudget {
    // Bundle size limits (in KB)
    maxBundleSize: number;
    maxBundleSizeGzipped: number;
    
    // Individual asset limits
    maxJsFileSize: number;
    maxCssFileSize: number;
    maxImageSize: number;
    
    // Runtime performance thresholds
    maxLoadTime: number;        // milliseconds
    maxFirstPaint: number;      // milliseconds  
    maxInteractive: number;     // milliseconds
    maxParseTime: number;       // milliseconds
    
    // Memory limits
    maxMemoryUsage: number;     // MB
    maxHeapSize: number;        // MB
    
    // Network limits
    maxRequests: number;        // count
    maxRequestSize: number;     // KB
}

export const performanceBudgets: PerformanceBudget = {
    // Bundle size limits
    maxBundleSize: 100,         // 100KB raw
    maxBundleSizeGzipped: 35,   // 35KB gzipped
    
    // Individual asset limits
    maxJsFileSize: 80,          // 80KB per JS file
    maxCssFileSize: 20,         // 20KB per CSS file
    maxImageSize: 50,           // 50KB per image
    
    // Runtime performance thresholds
    maxLoadTime: 2000,          // 2 seconds
    maxFirstPaint: 1000,        // 1 second
    maxInteractive: 3000,       // 3 seconds
    maxParseTime: 100,          // 100ms
    
    // Memory limits
    maxMemoryUsage: 50,         // 50MB
    maxHeapSize: 100,           // 100MB
    
    // Network limits
    maxRequests: 20,            // 20 requests max
    maxRequestSize: 1000,       // 1MB per request
};

export const performanceWarnings: Partial<PerformanceBudget> = {
    // Warning thresholds (80% of limits)
    maxBundleSize: 80,
    maxBundleSizeGzipped: 28,
    maxJsFileSize: 64,
    maxCssFileSize: 16,
    maxLoadTime: 1600,
    maxFirstPaint: 800,
    maxInteractive: 2400,
};

/**
 * Bundle analysis configuration
 */
export interface BundleAnalysisConfig {
    enabled: boolean;
    outputDir: string;
    formats: ('json' | 'html' | 'text')[];
    includeSourceMaps: boolean;
    threshold: {
        error: number;      // Error threshold percentage
        warning: number;    // Warning threshold percentage
    };
}

export const bundleAnalysisConfig: BundleAnalysisConfig = {
    enabled: true,
    outputDir: './dist/analysis',
    formats: ['json', 'html'],
    includeSourceMaps: true,
    threshold: {
        error: 110,     // Error if 110% of budget
        warning: 90,    // Warning if 90% of budget
    },
};

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitoringConfig {
    enabled: boolean;
    sampleRate: number;
    endpoints: {
        metrics: string;
        events: string;
    };
    thresholds: {
        lcp: number;    // Largest Contentful Paint
        fid: number;    // First Input Delay
        cls: number;    // Cumulative Layout Shift
        fcp: number;    // First Contentful Paint
        ttfb: number;   // Time to First Byte
    };
}

export const performanceMonitoringConfig: PerformanceMonitoringConfig = {
    enabled: process.env.NODE_ENV === 'production',
    sampleRate: 0.1, // 10% sampling
    endpoints: {
        metrics: '/api/metrics/performance',
        events: '/api/events/performance',
    },
    thresholds: {
        lcp: 2500,      // 2.5 seconds
        fid: 100,       // 100ms
        cls: 0.1,       // 0.1 score
        fcp: 1800,      // 1.8 seconds
        ttfb: 600,      // 600ms
    },
};

/**
 * Build optimization configuration
 */
export interface BuildOptimizationConfig {
    minify: boolean;
    treeshake: boolean;
    sourcemaps: boolean;
    splitting: boolean;
    compression: {
        enabled: boolean;
        level: number;
        threshold: number;
    };
    caching: {
        enabled: boolean;
        strategy: 'content-hash' | 'timestamp';
        maxAge: number;
    };
}

export const buildOptimizationConfig: BuildOptimizationConfig = {
    minify: process.env.NODE_ENV === 'production',
    treeshake: true,
    sourcemaps: process.env.NODE_ENV === 'development',
    splitting: true,
    compression: {
        enabled: true,
        level: 9,
        threshold: 1024, // 1KB
    },
    caching: {
        enabled: true,
        strategy: 'content-hash',
        maxAge: 31536000, // 1 year
    },
};

/**
 * Check if current metrics exceed budget
 */
export function checkPerformanceBudget(metrics: Partial<PerformanceBudget>): {
    passed: boolean;
    warnings: string[];
    errors: string[];
} {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check bundle size
    if (metrics.maxBundleSize && metrics.maxBundleSize > performanceBudgets.maxBundleSize) {
        errors.push(`Bundle size ${metrics.maxBundleSize}KB exceeds limit of ${performanceBudgets.maxBundleSize}KB`);
    } else if (metrics.maxBundleSize && metrics.maxBundleSize > (performanceWarnings.maxBundleSize || 0)) {
        warnings.push(`Bundle size ${metrics.maxBundleSize}KB approaching limit of ${performanceBudgets.maxBundleSize}KB`);
    }

    // Check gzipped size
    if (metrics.maxBundleSizeGzipped && metrics.maxBundleSizeGzipped > performanceBudgets.maxBundleSizeGzipped) {
        errors.push(`Gzipped bundle size ${metrics.maxBundleSizeGzipped}KB exceeds limit of ${performanceBudgets.maxBundleSizeGzipped}KB`);
    } else if (metrics.maxBundleSizeGzipped && metrics.maxBundleSizeGzipped > (performanceWarnings.maxBundleSizeGzipped || 0)) {
        warnings.push(`Gzipped bundle size ${metrics.maxBundleSizeGzipped}KB approaching limit of ${performanceBudgets.maxBundleSizeGzipped}KB`);
    }

    // Check load time
    if (metrics.maxLoadTime && metrics.maxLoadTime > performanceBudgets.maxLoadTime) {
        errors.push(`Load time ${metrics.maxLoadTime}ms exceeds limit of ${performanceBudgets.maxLoadTime}ms`);
    } else if (metrics.maxLoadTime && metrics.maxLoadTime > (performanceWarnings.maxLoadTime || 0)) {
        warnings.push(`Load time ${metrics.maxLoadTime}ms approaching limit of ${performanceBudgets.maxLoadTime}ms`);
    }

    return {
        passed: errors.length === 0,
        warnings,
        errors,
    };
}

/**
 * Performance budget enforcement script
 */
export function enforcePerformanceBudget(metrics: Partial<PerformanceBudget>): void {
    const result = checkPerformanceBudget(metrics);
    
    if (result.warnings.length > 0) {
        console.warn('⚠️  Performance Budget Warnings:');
        result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    if (result.errors.length > 0) {
        console.error('❌ Performance Budget Violations:');
        result.errors.forEach(error => console.error(`  - ${error}`));
        
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Performance budget violations detected in production build');
        }
    }
    
    if (result.passed && result.warnings.length === 0) {
        console.log('✅ Performance budget check passed');
    }
}

export default {
    performanceBudgets,
    performanceWarnings,
    bundleAnalysisConfig,
    performanceMonitoringConfig,
    buildOptimizationConfig,
    checkPerformanceBudget,
    enforcePerformanceBudget,
};