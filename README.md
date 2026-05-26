# Control de Obra — Backend (beta)

Sistema Integral de Gestión y Control de Obra. Monorepo `npm workspaces`.

```
control-obra/
├── apps/
│   └── api/                NestJS + Prisma + PostgreSQL + Redis
├── packages/
│   └── shared/             Zod schemas + tipos + constantes (compartidos con web/mobile)
├── docker-compose.yml      Postgres 16 + Redis + Adminer (opcional)
└── .env.example
```

---

## Requisitos

- **Node 20+** (tienes 24 ✓)
- **npm 10+** (tienes 11 ✓)
- **PostgreSQL 16** — elige una opción:
  - **A.** Instalar Docker Desktop → `npm run db:up` (1 comando, ambiente local completo)
  - **B.** Cuenta en [Neon](https://neon.tech) (free tier, sin instalar nada) → pega la URL en `.env`

---

## Setup en 4 pasos

```bash
# 1. Copiar variables de entorno y ajustar DATABASE_URL si usas Neon
cp .env.example .env

# 2. Instalar dependencias del monorepo
npm install

# 3. Compilar el paquete shared (lo necesita el API)
npm run build --workspace=packages/shared

# 4. Migrar BD + sembrar datos del prototipo + arrancar el API
npm run db:up                # SOLO si usas Docker — si usas Neon, salta este paso
npm run db:migrate           # crea las 29 tablas
npm run db:seed              # carga usuarios, frentes, materiales, requisiciones de muestra
npm run dev                  # API en http://localhost:3001
```

---

## Endpoints disponibles

API base: **`http://localhost:3001/api/v1`**
Docs OpenAPI: **`http://localhost:3001/api/v1/docs`** (Swagger interactivo)

### Auth (público)
- `POST /auth/login` — `{ email, password }`
- `POST /auth/refresh` — `{ refreshToken }`
- `POST /auth/logout`

### Recursos
- `GET    /usuarios` · `POST /usuarios` · `PATCH /usuarios/:id` · `GET /usuarios/me`
- `GET    /frentes` · `POST /frentes` · `PATCH /frentes/:id`
- `GET    /materiales` · `POST /materiales` · `PATCH /materiales/:id`
- `GET    /proveedores` · `POST /proveedores` · `PATCH /proveedores/:id`
- `GET    /requisiciones?estado=avalada&frenteId=...`
- `GET    /requisiciones/:id` — detalle con timeline de los 7 estados
- `POST   /requisiciones` — crear (residente)
- `POST   /requisiciones/:id/transicion` — `{ accion: "enviar|avalar|aprobar|rechazar", observacion?, motivoRechazo? }`
- `GET    /ordenes-compra` · `GET /ordenes-compra/:id`
- `POST   /ordenes-compra` — generar OC desde requisición aprobada (compras)
- `POST   /ordenes-compra/:id/enviar` · `POST /ordenes-compra/:id/anular`
- `GET    /caja/movimientos` · `POST /caja/movimientos`
- `POST   /caja/arqueo` — cerrar arqueo diario (requiere MFA)
- `POST   /bodega/entradas` · `POST /bodega/salidas`
- `GET    /inventario/existencias?frenteId=...`
- `GET    /inventario/alertas`
- `GET    /auditoria` — bitácora append-only filtrable
- `GET    /health`

---

## Credenciales de prueba (post-seed)

Todas con password: **`password123`**

| Rol | Email |
|-----|-------|
| Director | juan.mejia@andina.co |
| Residente | andres.patino@andina.co |
| Residente | camila.restrepo@andina.co |
| Residente | luis.gomez@andina.co |
| Compras | sofia.vargas@andina.co |
| Caja | patricia.holguin@andina.co |
| Bodega | ricardo.bermudez@andina.co |
| Admin | admin@andina.co |

---

## Flujo end-to-end demo

```bash
# 1. Login como residente Andrés
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"andres.patino@andina.co","password":"password123"}'

# Toma el accessToken y exporta:
export TOKEN="..."

# 2. Listar mis requisiciones
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/requisiciones

# 3. Ver detalle con timeline
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/requisiciones/RQ-2026-0142

# 4. Login como Director Juan Carlos para aprobar
# 5. POST /requisiciones/:id/transicion con { accion: "aprobar" }
# 6. Login como Compras Sofía y POST /ordenes-compra
```

---

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Arranca el API en watch |
| `npm run db:up` / `db:down` | Levanta/baja Postgres + Redis (Docker) |
| `npm run db:migrate` | Crea/aplica migraciones Prisma |
| `npm run db:seed` | Carga datos del prototipo |
| `npm run db:reset` | Reset completo de la BD |
| `npm run db:studio` | Prisma Studio (UI para ver la BD) |
| `npm run build` | Compila todo |
| `npm test` | Tests |

---

## Decisiones arquitectónicas (resumen)

Detalles completos en [`../01_MODELO_DE_DATOS.md`](../01_MODELO_DE_DATOS.md).

- **Dinero como `BIGINT` en centavos** (nunca `float`)
- **Append-only** en historial de estados de requisición y audit_log
- **Snapshot pattern** en items (precios congelados al momento de la requisición)
- **State machine** del backend enforza las 7 transiciones, no solo el frontend
- **Idempotency keys** en POSTs críticos (`/caja/movimientos`)
- **RBAC con guards declarativos** (`@RequireRoles('director')`)
- **Multitenant-ready** (`tenantId` en todas las tablas, default 1)

---

## Próximos pasos

- [ ] Tests de la state machine de requisiciones
- [ ] Generación de PDF de OC (Puppeteer worker)
- [ ] Notificaciones push (BullMQ + Expo)
- [ ] Integraciones contables (World Office, Siigo, SAP) — fase posterior
- [ ] Frontend web (Next.js) que consuma este API
- [ ] App móvil (React Native + Expo) que consuma este API
