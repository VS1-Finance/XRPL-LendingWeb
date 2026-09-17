# Production image for the web app. Builds the Next.js standalone output in one stage and runs the
# lean server in another, so the final image carries only what the server needs.

# ---- deps: install exactly what the lockfile pins ----
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: produce the standalone server ----
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The engine URL is a runtime concern (the proxy reads it server-side), so no build-time engine env is
# needed. NEXT_PUBLIC_USE_ENGINE selects the live client at build time.
ENV NEXT_PUBLIC_USE_ENGINE=1
RUN pnpm build

# ---- run: the standalone server plus static assets ----
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Next.js standalone server binds to the HOSTNAME env var, which defaults to the container's own
# hostname/IP — unreachable from a reverse proxy on the internal network (the deployed 502). Bind all
# interfaces so the platform proxy can reach it.
ENV HOSTNAME=0.0.0.0
# The standalone build bundles a minimal node_modules and a server.js entrypoint.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
