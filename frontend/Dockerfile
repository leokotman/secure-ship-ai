# Multi-stage production image: next build + next start
# bookworm so Next.js SWC glibc binaries load on linux/arm64 and amd64.
FROM node:18-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:18-bookworm AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Browser-facing defaults baked at build time (override via ARG/ENV when building for other hosts).
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ARG NEXT_PUBLIC_AUTH0_DOMAIN=
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID=
ARG NEXT_PUBLIC_AUTH0_AUDIENCE=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN \
    NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID \
    NEXT_PUBLIC_AUTH0_AUDIENCE=$NEXT_PUBLIC_AUTH0_AUDIENCE \
    NEXT_TELEMETRY_DISABLED=1

# macOS lockfiles often omit linux optional SWC binaries — install the matching one
# using the version declared in next's optionalDependencies (may differ from next itself).
RUN SWC_PKG="$(node -e "const n=require('./node_modules/next/package.json'); const k=process.arch==='arm64'?'@next/swc-linux-arm64-gnu':'@next/swc-linux-x64-gnu'; console.log(k+'@'+n.optionalDependencies[k])")" \
    && npm install --no-save "$SWC_PKG" \
    && mkdir -p public \
    && npm run build

FROM node:18-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
