FROM node:18 AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Explicitly install keyv as it's required by @nestjs/cache-manager
RUN npm install keyv@4.5.4

# Copy the rest of the codebase
COPY . .

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

COPY .env ./
# Generate Prisma client with the correct binary targets
RUN npx prisma generate

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Second stage: run
FROM node:18-slim

WORKDIR /app

# Install OpenSSL in the runtime container
RUN apt-get update -y && apt-get install -y openssl

# Copy only necessary files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Set environment variables
ENV NODE_ENV=production

# Ensure logs directory exists
RUN mkdir -p logs

# Expose the application port
EXPOSE 4000

# Start the application
CMD ["npm", "run", "start:prod"] 