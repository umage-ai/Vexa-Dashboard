# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# [LOCAL-FORK] Accept NEXT_PUBLIC_ build args so they're inlined by Next.js
ARG NEXT_PUBLIC_DECISION_LISTENER_URL=http://localhost:8766
ARG NEXT_PUBLIC_TRACKER_ENABLED=true
ENV NEXT_PUBLIC_DECISION_LISTENER_URL=$NEXT_PUBLIC_DECISION_LISTENER_URL
ENV NEXT_PUBLIC_TRACKER_ENABLED=$NEXT_PUBLIC_TRACKER_ENABLED

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
