# ============================================================
# Dockerfile para API NestJS — listo para Render / Railway / Fly.io
# Multi-stage build: imagen final ligera con solo lo necesario
# ============================================================

# ---------- Stage 1: Builder ----------
FROM node:20-alpine AS builder

WORKDIR /repo

# Copiar archivos de configuración del monorepo
COPY package*.json ./
COPY tsconfig.base.json ./

# Copiar paquetes que necesita el API
COPY packages/shared/ ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Instalar dependencias del monorepo
RUN npm install --no-audit --no-fund

# Build del paquete shared primero
RUN npm run build --workspace=packages/shared

# Copiar código del API y construir
COPY apps/api/ ./apps/api/
WORKDIR /repo/apps/api

# Generar Prisma client + compilar TypeScript
RUN npx prisma generate
RUN npx tsc -p tsconfig.json

# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copiar solo node_modules y dist necesarios
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/shared/dist ./node_modules/@control-obra/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./node_modules/@control-obra/shared/package.json
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/package.json ./package.json

# Crear directorio de uploads (volátil — uploads se pierden al reiniciar el contenedor)
RUN mkdir -p /app/uploads

EXPOSE 3001

# Render/Railway pasan el puerto via env. Si no, default 3001.
CMD ["sh", "-c", "node dist/main.js"]
