# Node Alpine -- multi-arch (amd64 + arm64)
FROM oven/bun:1.3.11-alpine AS builder

WORKDIR /app

# Install system dependencies required for Bun
RUN apk add --no-cache wget curl bash

# Accept build arguments for environment variables
ARG AUTH_ENABLED
ARG AUTH_SECRET
ARG APPWRITE_ENDPOINT
ARG APPWRITE_PROJECT_ID
ARG POCKETBASE_URL
ARG SESSION_MAX_AGE
ARG OFFLINE_MODE=true
ARG ENABLE_TIDAL_API=false
ARG ENABLE_EXTERNAL_API_INSTANCES=false
ARG ENABLE_EXTERNAL_AUTH=false
ARG ENABLE_EXTERNAL_UPLOADS=false

# Keep the original online integrations recoverable, but opt out by default.
ENV OFFLINE_MODE=${OFFLINE_MODE}
ENV ENABLE_TIDAL_API=${ENABLE_TIDAL_API}
ENV ENABLE_EXTERNAL_API_INSTANCES=${ENABLE_EXTERNAL_API_INSTANCES}
ENV ENABLE_EXTERNAL_AUTH=${ENABLE_EXTERNAL_AUTH}
ENV ENABLE_EXTERNAL_UPLOADS=${ENABLE_EXTERNAL_UPLOADS}

# Copy package files first for caching
COPY package.json package-lock.json ./

# Install dependencies (Node)
RUN bun install

# Copy the rest of the project
COPY . .

# Build the project
RUN bun run build

# Serve with nginx
FROM nginx:1.28.2-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the nginx port
EXPOSE 4173

CMD ["nginx", "-g", "daemon off;"]
