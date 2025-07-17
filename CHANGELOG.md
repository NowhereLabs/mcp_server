# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2025-01-17

### 🔄 Hot-Reload Development System
- **Added comprehensive hot-reload functionality** with automatic browser refresh for frontend changes
- **Implemented graceful shutdown mechanism** using `tokio::select!` pattern for proper resource cleanup
- **Made debounce timing configurable** via `HOT_RELOAD_DEBOUNCE_MS` environment variable (50-5000ms range)
- **Enhanced WebSocket communication** with automatic reconnection and health checks
- **Added development mode indicator** with visual "DEV MODE" badge in the UI
- **Created convenient development scripts** (`./scripts/dev.sh`, `./scripts/dev-both.sh`)

### 🔒 Security Enhancements
- **Implemented WebSocket origin validation** to prevent cross-origin attacks
- **Added configurable allowed origins** via `WEBSOCKET_ALLOWED_ORIGINS` environment variable
- **Enhanced security checks** with proper origin validation in production mode
- **Improved CORS handling** with development mode bypass for local development

### 🛠️ JavaScript Client Improvements
- **Rebuilt hot-reload client** with exponential backoff and jitter for reconnection
- **Added comprehensive error handling** with context-aware error messages
- **Implemented health check mechanism** with connection timeout detection
- **Enhanced debugging interface** with detailed connection status and error reporting
- **Added smart error boundary** with pattern-based critical error detection and recovery

### 🧪 Testing Infrastructure
- **Added 8 comprehensive hot-reload tests** covering graceful shutdown, configuration, and file categorization
- **Created 6 WebSocket origin validation tests** for security verification
- **Implemented environment variable configuration tests** with validation testing
- **Enhanced test coverage** to include error scenarios and edge cases

### 📁 Development Experience
- **Improved file watching** with monitoring of `src/`, `templates/`, `static/`, and `config/` directories
- **Enhanced logging** with informative file change detection and reload triggers
- **Added proper error recovery** with automatic retry mechanisms
- **Implemented component-specific error handling** with intelligent recovery strategies

### 🔧 Technical Improvements
- **Better resource management** with proper cleanup and shutdown handling
- **Enhanced configuration system** with validation and range checking for hot-reload settings
- **Improved error reporting** with detailed context and actionable recommendations
- **Added automatic recovery mechanisms** for failing components
- **Implemented smart error frequency detection** to prevent error storms

### 📈 Quality Assurance
- **All 153 tests passing** (10 Rust unit tests, 133 JavaScript tests, 8 hot-reload tests, 6 WebSocket tests, 5 Docker integration tests)
- **Zero clippy warnings** with strict linting enabled
- **Comprehensive code coverage** including edge cases and error scenarios
- **Production-ready implementations** with proper error handling and recovery
- **Backward compatibility maintained** with existing functionality

## [0.1.1] - 2025-01-16

### 🔒 Security & Configuration
- **Added comprehensive environment variable validation** with range and format checks
- **Implemented production hardening checks** including warnings for insecure configurations
- **Created `.env.example`** with detailed configuration examples and security notes
- **Enhanced input validation** for all configuration parameters

### 🐳 Docker Improvements
- **Fixed Docker user management** - Changed UID from 1000 to 1001 for better compatibility
- **Updated docker-compose.yml** with consistent UID configuration and user specification
- **Improved Docker documentation** with corrected UID references and examples
- **Enhanced Docker integration tests** with proper image cleanup and conflict resolution

### 📚 Documentation
- **Fixed path references** in CLAUDE.md for accurate project structure
- **Updated logging configuration** examples to use correct package naming
- **Corrected Claude Desktop integration** examples with proper directory paths
- **Enhanced Docker deployment documentation** with updated security considerations

### 🔧 Build & Development
- **Improved build script error handling** with granular validation and better error messages
- **Added prerequisite validation** for Node.js, npm, and Rust toolchain
- **Enhanced build summary** with file size reporting and build status
- **Implemented comprehensive test coverage** including Docker integration tests

### 🧪 Testing
- **Added Docker integration tests** for build verification, container startup, and UID validation
- **Fixed Docker test conflicts** with unique image naming and proper cleanup
- **Enhanced test isolation** with sequential execution for Docker tests
- **Improved test coverage** to 46 tests across all components

### 🛠️ Internal Improvements
- **Code formatting fixes** for consistent style across the codebase
- **Clippy warning resolution** for better code quality
- **Enhanced error messages** with more descriptive validation feedback
- **Improved development workflow** with better tooling support

### 📈 Quality Assurance
- **All 46 tests passing** (100% test success rate)
- **Zero clippy warnings** with strict linting enabled
- **Comprehensive Docker validation** including permissions and UID verification
- **Production-ready configuration** with security best practices

## [0.1.0] - 2025-01-15

### 🎉 Initial Release
- **Complete MCP server implementation** with official SDK integration
- **Real-time web dashboard** with WebSocket support and Alpine.js components
- **Docker deployment support** with multi-stage build and production optimizations
- **Comprehensive documentation** including deployment guides and development workflows
- **Full test suite** with unit, integration, and dashboard tests
- **Security hardening** with proper user management and resource limits