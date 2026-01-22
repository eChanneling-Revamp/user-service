# ----------- Stage 1: Build -----------
FROM node:22-alpine AS builder 

WORKDIR /app

COPY package*.json ./

# Add OpenSSL and CA certs to the image 
RUN apk add --no-cache openssl ca-certificates

RUN npm ci --no-audit --no-fund

COPY tsconfig*.json ./
COPY src ./src

RUN npm run build

# ----------- Stage 2: Runtime -----------
FROM node:22-alpine 

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3003
CMD ["node", "dist/main.js"]
