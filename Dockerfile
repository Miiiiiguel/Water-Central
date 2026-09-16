# Multi-stage: build with dev deps, ship only the runtime.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# VITE_* values are inlined at build time — pass them as build args if
# you build the image yourself (Render/Railway do this from env vars).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_CALENDLY_URL
ARG VITE_META_PIXEL_ID
ARG VITE_TIKTOK_PIXEL_ID
ARG VITE_GA_MEASUREMENT_ID
ARG VITE_VAPID_PUBLIC_KEY
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
