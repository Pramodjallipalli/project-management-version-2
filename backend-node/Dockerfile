FROM node:22-bookworm-slim

WORKDIR /app

# Install openssl for Prisma and build tools for native addons (argon2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install tsx globally so TypeScript scripts and seeders run reliably
RUN npm install -g tsx

# Copy package manifests and Prisma schema for efficient caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install
RUN npx prisma generate

# Copy application source code
COPY . .

EXPOSE 3001

CMD ["npx", "tsx", "src/server.ts"]
