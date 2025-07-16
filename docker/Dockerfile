# Multi-stage Docker build for Rust MCP Server
# Stage 1: Node.js build stage for Tailwind CSS
FROM node:20-alpine AS css-builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Copy config files needed for Tailwind
COPY config/tailwind.config.js config/postcss.config.js ./config/
COPY templates ./templates
COPY static/css/input.css ./static/css/

# Build Tailwind CSS
RUN npm run build-css

# Stage 2: Rust build stage
FROM rust:latest AS builder

# Install system dependencies needed for building
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install rustfmt and clippy components
RUN rustup component add rustfmt clippy

# Set working directory
WORKDIR /usr/src/app

# Copy Cargo files first for better layer caching
COPY Cargo.toml ./
COPY Cargo.lock* ./

# Create a dummy main.rs to pre-build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (this layer will be cached unless Cargo.toml changes)
RUN RUSTFLAGS="-D warnings" cargo build --release && rm -rf src

# Copy source code
COPY src ./src
COPY templates ./templates
COPY static ./static
COPY .env ./.env

# Copy the built CSS from the css-builder stage
COPY --from=css-builder /app/static/css/output.css ./static/css/

# Format, lint, test, and build the application with strict warnings as errors
RUN cargo fmt --check && \
    RUSTFLAGS="-D warnings" cargo clippy -- -D warnings && \
    RUSTFLAGS="-D warnings" cargo test && \
    RUSTFLAGS="-D warnings" cargo build --release

# Stage 3: Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user with UID 1001
RUN useradd -m -s /bin/bash -u 1001 mcpuser

# Set working directory
WORKDIR /app

# Copy the built binary from builder stage
COPY --from=builder /usr/src/app/target/release/rust-mcp-server .

# Copy static files, templates, and configuration
COPY --from=builder /usr/src/app/templates ./templates
COPY --from=builder /usr/src/app/static ./static
COPY --from=builder /usr/src/app/.env ./.env

# Change ownership to mcpuser
RUN chown -R mcpuser:mcpuser /app

# Create directories that the application might need
RUN mkdir -p /tmp && chown mcpuser:mcpuser /tmp

# Switch to non-root user
USER mcpuser

# Expose the port the app runs on
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["./rust-mcp-server"]