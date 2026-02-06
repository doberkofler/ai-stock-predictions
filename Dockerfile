FROM node:24-slim

LABEL maintainer="AI Stock Predictions"
LABEL description="Stock price prediction using TensorFlow.js LSTM models"

WORKDIR /app

# Install build tools for native modules (better-sqlite3, @tensorflow/tfjs-node)
RUN apt-get update && apt-get install -y --no-install-recommends \
	python3 \
	make \
	g++ \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
	npm cache clean --force

# Copy source code
COPY src ./src

# Create runtime directory
RUN mkdir -p /app/data

# Set environment variables
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV NODE_ENV=production
ENV NODE_OPTIONS=--experimental-transform-types
ENV NODE_NO_WARNINGS=1

# Create non-root user
RUN groupadd -r -g 1001 nodejs && \
	useradd -r -u 1001 -g nodejs nodejs

# Change ownership of directories to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Default command
ENTRYPOINT ["node", "src/index.ts"]
CMD ["--help"]
