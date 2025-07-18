# Alpine.js Component Testing Guide

This guide provides a comprehensive approach for testing Alpine.js components in TypeScript with proper context binding, store mocking, and error handling.

## Overview

Alpine.js components require special testing considerations due to their reactive nature and dependency on Alpine.js magic properties (`$store`, `$el`, `$refs`, etc.). This guide covers the testing infrastructure and best practices developed for this project.

## Table of Contents

1. [Testing Infrastructure](#testing-infrastructure)
2. [Component Testing Pattern](#component-testing-pattern)
3. [Store Mocking](#store-mocking)
4. [Error Handling Testing](#error-handling-testing)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

## Testing Infrastructure

### Core Setup

The testing infrastructure is built on:
- **Vitest**: Modern test runner with excellent TypeScript support
- **jsdom**: Browser-like environment for DOM testing
- **Custom Alpine.js Test Utilities**: Helper functions for component instantiation

### Configuration Files

- `config/vitest.config.ts`: Main test configuration
- `tests/setup.ts`: Test environment setup and utilities
- `tsconfig.json`: TypeScript configuration with path aliases

### Path Aliases

All tests use path aliases for clean imports:
```typescript
import { componentName } from '@components/component-name';
import { utilityName } from '@utils/utility-name';
```

## Component Testing Pattern

### Basic Component Test Structure

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { componentName } from '@components/component-name';

describe('Component Name', () => {
  let component: ComponentType;
  let mockStore: MockStoreType;

  beforeEach(() => {
    // 1. Create mock store
    mockStore = {
      data: {},
      methods: vi.fn(),
      // ... other store properties
    };

    // 2. Create component instance
    component = componentName();
    
    // 3. Inject Alpine.js magic properties
    component.$store = {
      storeName: mockStore
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  // Test cases...
});
```

### Component Instantiation

All Alpine.js components should be instantiated following this pattern:

```typescript
// 1. Import the component function
import { componentName } from '@components/component-name';

// 2. Create component instance
const component = componentName();

// 3. Inject Alpine.js context
component.$store = {
  storeName: mockStore
};
```

### Context Binding

Alpine.js components expect proper `this` binding for their methods. The testing utilities automatically handle this, but manual binding may be needed in some cases:

```typescript
// Manual method binding (if needed)
const methods = ['init', 'destroy', 'methodName'];
methods.forEach(method => {
  if (typeof component[method] === 'function') {
    component[method] = component[method].bind(component);
  }
});
```

## Store Mocking

### Store Mock Structure

Each Alpine.js store should have a corresponding mock:

```typescript
interface MockStoreName {
  data: DataType;
  loading: boolean;
  error: string | null;
  methods: ReturnType<typeof vi.fn>;
}

const mockStore: MockStoreName = {
  data: {
    // Mock data structure
  },
  loading: false,
  error: null,
  methods: vi.fn(),
  // ... other store methods
};
```

### Global Store Setup

The test setup provides pre-configured mocks for common stores:

```typescript
// Available in tests/setup.ts
global.Alpine = {
  store: vi.fn((name: string) => {
    if (name === 'storeName') return mockStore;
    return undefined;
  })
};
```

### Store Method Testing

Test store interactions explicitly:

```typescript
it('should update store data', () => {
  const newData = { key: 'value' };
  
  component.updateMethod(newData);
  
  expect(mockStore.update).toHaveBeenCalledWith(newData);
});
```

## Error Handling Testing

### Error Boundary Testing

Components with error handling should test error scenarios:

```typescript
describe('Error Handling', () => {
  it('should handle component errors', () => {
    const error = new Error('Test error');
    
    component.handleError(error, 'methodName');
    
    expect(component.hasError).toBe(true);
    expect(component.errorMessage).toBe('Test error');
  });
});
```

### Event Listener Testing

For components that set up event listeners:

```typescript
describe('Event Listeners', () => {
  it('should set up error handling', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    
    component.setupErrorHandling();
    
    expect(addListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should clean up event listeners', () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    // First setup the listeners
    component.setupErrorHandling();
    
    // Then destroy to clean up
    component.destroy();
    
    expect(removeListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
```

## Best Practices

### 1. Component Lifecycle Testing

Test the complete component lifecycle:

```typescript
describe('Component Lifecycle', () => {
  it('should initialize correctly', () => {
    expect(component.property).toBe(expectedValue);
  });

  it('should clean up on destroy', () => {
    component.destroy();
    // Assert cleanup occurred
  });
});
```

### 2. Method Coverage

Test all public methods:

```typescript
describe('Method Name', () => {
  it('should handle valid input', () => {
    const result = component.methodName(validInput);
    expect(result).toBe(expectedResult);
  });

  it('should handle invalid input', () => {
    const result = component.methodName(invalidInput);
    expect(result).toBe(fallbackResult);
  });
});
```

### 3. State Management

Test reactive state changes:

```typescript
describe('State Management', () => {
  it('should update state correctly', () => {
    component.updateState(newValue);
    expect(component.state).toBe(newValue);
  });
});
```

### 4. Async Operations

Test async methods properly:

```typescript
describe('Async Operations', () => {
  it('should handle async operations', async () => {
    const promise = component.asyncMethod();
    await expect(promise).resolves.toBe(expectedResult);
  });
});
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: "component.method is not a function"

**Cause**: Method not properly bound to component instance.

**Solution**:
```typescript
// Ensure proper binding
component.method = component.method.bind(component);
```

#### Issue: "Cannot read properties of undefined (reading 'property')"

**Cause**: Store not properly injected.

**Solution**:
```typescript
// Inject store correctly
component.$store = {
  storeName: mockStore
};
```

#### Issue: "TypeError: componentName is not a function"

**Cause**: Import/export mismatch or module resolution issue.

**Solution**:
```typescript
// Use named imports
import { componentName } from '@components/component-name';

// Check for conflicting .js files
// Remove old .js files that might interfere with .ts imports
```

### Testing Tips

1. **Use descriptive test names**: Each test should clearly describe what it's testing
2. **Test edge cases**: Include tests for error conditions and edge cases
3. **Mock external dependencies**: Always mock external services and APIs
4. **Clean up after tests**: Use `afterEach` to clean up mocks and timers
5. **Test component isolation**: Each test should be independent

### Performance Considerations

- Use `vi.clearAllMocks()` and `vi.clearAllTimers()` in `afterEach`
- Mock expensive operations
- Use `--run` flag to avoid watch mode timeouts in CI

## Example: Complete Component Test

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { exampleComponent } from '@components/example-component';

interface MockStore {
  data: any;
  loading: boolean;
  update: ReturnType<typeof vi.fn>;
  setLoading: ReturnType<typeof vi.fn>;
}

describe('Example Component', () => {
  let component: any;
  let mockStore: MockStore;

  beforeEach(() => {
    mockStore = {
      data: { value: 'test' },
      loading: false,
      update: vi.fn(),
      setLoading: vi.fn()
    };

    component = exampleComponent();
    component.$store = { example: mockStore };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(component.property).toBe('defaultValue');
    });
  });

  describe('Methods', () => {
    it('should call store methods', () => {
      component.updateData('newValue');
      expect(mockStore.update).toHaveBeenCalledWith('newValue');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      const error = new Error('Test error');
      expect(() => component.handleError(error)).not.toThrow();
    });
  });
});
```

This testing approach ensures comprehensive coverage of Alpine.js component functionality while maintaining clean, maintainable test code.