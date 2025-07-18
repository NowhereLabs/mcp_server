# Development Guide

This guide outlines the development workflow for the Rust MCP Server project, including how to make changes, test them, and publish releases through GitHub.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Making Changes](#making-changes)
3. [Testing Your Changes](#testing-your-changes)
4. [Committing Changes](#committing-changes)
5. [Creating Pull Requests](#creating-pull-requests)
6. [Publishing Releases](#publishing-releases)
7. [Hotfix Process](#hotfix-process)

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/NowhereLabs/mcp_server.git
cd mcp_server
```

### 2. Create a Feature Branch

Always work on a feature branch, never directly on `master`:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or fixes

### 3. Set Up Development Environment

```bash
# Install dependencies
npm install
cargo build

# Copy environment configuration
cp .env.example .env
# Edit .env with your local settings
```

## Making Changes

### 1. Code Changes

Follow the existing code structure:
- Rust code in `src/`
- TypeScript frontend assets in `static/js/`
- CSS in `static/css/`
- Templates in `templates/`
- Comprehensive tests in `tests/` (46 Rust + 123 TypeScript)

### 2. Adding New Features

When adding a new MCP tool:

```bash
# 1. Create the tool implementation
touch src/server/your_tool.rs

# 2. Register in mcp_router.rs
# 3. Add tests
# 4. Update documentation
```

### 3. Frontend Changes

```bash
# Watch CSS changes during development
npm run watch-css

# Build TypeScript with sourcemaps
npm run build-js:dev

# Type-check TypeScript without emitting
npm run type-check
```

## Testing Your Changes

### 1. Run All Tests Locally

Our comprehensive test suite includes 174 tests:

```bash
# Format code first
cargo fmt

# Run linter
cargo clippy -- -D warnings

# TypeScript type checking
npm run type-check

# Run complete test suite
cargo test && npm test

# Rust tests (46 total)
cargo test --lib --bins                      # Unit tests (10)
cargo test --test integration_tests          # Integration tests (5)
cargo test --test dashboard_tests            # Dashboard tests (7)
cargo test --test websocket_origin_tests     # WebSocket tests (6)
cargo test --test hot_reload_tests           # Hot-reload tests (8)
cargo test --test basic_integration          # Basic integration (9)

# TypeScript tests (123 total)
npm test                                      # All TypeScript tests
npm run test:coverage                         # With coverage report

# Docker tests (5 total, optimized)
cargo test --test docker_integration_tests_optimized -- --test-threads=1
```

### 2. Test Docker Build

```bash
# Build Docker image locally
docker build -f docker/Dockerfile -t mcp-test:local .

# Run the container
docker run -p 8080:8080 mcp-test:local

# Test with docker-compose
docker compose -f docker/docker-compose.yml up --build
```

### 3. Integration Testing

```bash
# Run the server locally
cargo run --release

# In another terminal, test the MCP protocol
# (Add your integration test commands here)
```

## Committing Changes

### 1. Stage Your Changes

```bash
# Review your changes
git status
git diff

# Stage specific files
git add src/server/new_tool.rs
git add tests/new_tool_test.rs

# Or stage all changes (be careful)
git add -A
```

### 2. Write Good Commit Messages

```bash
git commit -m "feat: add new echo tool with timeout support

- Implement echo tool with configurable timeout
- Add comprehensive tests for edge cases
- Update documentation with usage examples"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build process or auxiliary tool changes

### 3. Push Your Branch

```bash
git push origin feature/your-feature-name
```

## Creating Pull Requests

### 1. Push Your Feature Branch

```bash
# Make sure you're up to date with master
git fetch origin
git rebase origin/master

# Push your branch
git push origin feature/your-feature-name
```

### 2. Create PR on GitHub

1. Go to https://github.com/NowhereLabs/mcp_server
2. Click "Compare & pull request"
3. Fill out the PR template:

```markdown
## Summary
Brief description of changes

## Changes Made
- Added new echo tool
- Updated documentation
- Added integration tests

## Testing
- [ ] All 174 tests pass locally (`cargo test && npm test`)
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] No clippy warnings (`cargo clippy -- -D warnings`)
- [ ] Docker build succeeds
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes
```

### 3. Address Review Comments

```bash
# Make requested changes
git add -A
git commit -m "fix: address PR review comments"
git push origin feature/your-feature-name
```

## Publishing Releases

### 1. Merge to Master

After PR approval:

```bash
# Switch to master
git checkout master
git pull origin master

# Merge your feature branch
git merge feature/your-feature-name
git push origin master
```

### 2. Update Version

Edit `Cargo.toml`:

```toml
[package]
name = "rust-mcp-server"
version = "0.1.3"  # Increment version
```

### 3. Update CHANGELOG

Edit `CHANGELOG.md`:

```markdown
## [0.1.3] - 2024-01-18

### Added
- New echo tool with timeout support
- Comprehensive integration tests

### Fixed
- Memory leak in WebSocket handler

### Changed
- Improved error messages for tool failures
```

### 4. Commit Version Changes

```bash
git add Cargo.toml CHANGELOG.md
git commit -m "chore: bump version to 0.1.3"
git push origin master
```

### 5. Create and Push Tag

```bash
# Create annotated tag
git tag -a v0.1.3 -m "Release v0.1.3: Add echo tool with timeout support"

# Push tag to trigger release workflow
git push origin v0.1.3
```

### 6. Monitor Release

1. Check GitHub Actions: https://github.com/NowhereLabs/mcp_server/actions
2. Verify Docker image published: https://github.com/NowhereLabs/mcp_server/packages
3. Check release created: https://github.com/NowhereLabs/mcp_server/releases

## Hotfix Process

For urgent fixes to production:

### 1. Create Hotfix Branch from Tag

```bash
# Create branch from last release
git checkout -b hotfix/critical-bug v0.1.2

# Make your fix
# ... edit files ...

# Commit the fix
git add -A
git commit -m "fix: resolve critical memory leak"
```

### 2. Test Thoroughly

```bash
# Run all tests
cargo test
npm test

# Test Docker build
docker build -f docker/Dockerfile -t mcp-hotfix:test .
```

### 3. Merge to Master

```bash
# Push hotfix branch
git push origin hotfix/critical-bug

# Create PR and merge to master
# Then tag new release
git checkout master
git pull origin master
git tag -a v0.1.3 -m "Hotfix v0.1.3: Fix critical memory leak"
git push origin v0.1.3
```

## Best Practices

### 1. Before Starting Work

- Always pull latest master: `git pull origin master`
- Create a new branch from master
- Check existing issues/PRs to avoid duplicate work

### 2. During Development

- Commit frequently with meaningful messages
- Run tests before pushing
- Keep PRs focused and small
- Update documentation alongside code

### 3. Code Quality

- Run `cargo fmt` before committing
- Fix all `cargo clippy` warnings
- Ensure TypeScript compiles without errors (`npm run type-check`)
- Add comprehensive tests for new functionality (both Rust and TypeScript)
- Maintain 100% test success rate (174 total tests)
- Ensure Docker builds succeed

### 4. Communication

- Use PR descriptions to explain changes
- Link related issues in commits/PRs
- Ask for help in PR comments if needed
- Review others' PRs when possible

## Troubleshooting

### Docker Build Fails

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -f docker/Dockerfile -t mcp-test:local .
```

### Tests Fail in CI but Pass Locally

```bash
# Run tests with same settings as CI
cargo test -- --test-threads=1
RUST_LOG=debug cargo test

# Run TypeScript tests in CI mode
npm test -- --run
npm run type-check
```

### Git Issues

```bash
# Accidentally committed to master
git reset --soft HEAD~1
git checkout -b feature/new-branch
git commit -m "your message"

# Need to update feature branch with master
git fetch origin
git rebase origin/master
```

## GitHub Actions Workflows

The project uses two main workflows:

1. **publish.yml** - Triggered on version tags (v*)
   - Builds and tests code
   - Creates Docker images
   - Publishes to GitHub Container Registry

2. **release.yml** - Triggered on version tags (v*)
   - Creates GitHub release
   - Adds installation instructions
   - Links to Docker images

Both workflows run automatically when you push a tag starting with 'v'.

## Summary

1. **Development**: Feature branch → Code → Test → Commit
2. **Review**: Push → PR → Review → Merge
3. **Release**: Update version → Tag → Automatic publish

Following this workflow ensures consistent, tested, and well-documented releases of the MCP server.