# Syna Cupones — Sistema de Auditoría Automática de Cupones

Panel de auditoría inteligente para cupones de tarjetas de crédito/débito. Lee mails automáticamente, analiza imágenes con OpenAI Vision y genera reportes por sucursal.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + TailwindCSS + Recharts |
| Backend | Node.js + Express + Prisma ORM |
| Base de datos | PostgreSQL (Neon / Supabase) |
| Almacenamiento | Cloudinary |
| Email | IMAPFlow |
| IA | OpenAI Vision API (gpt-4o) |
| Deploy Frontend | Netlify |
| Deploy Backend | Render |

---

## Estructura

```
syna-cupones/
├── frontend/          # React + Vite
│   ├── src/
│   │   ├── pages/     # Login, Dashboard, Coupons, Branches...
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── netlify.toml
└── backend/           # Node.js + Express
    ├── src/
    │   ├── routes/    # auth, coupons, branches, alerts...
    │   ├── services/  # imap, openai, cloudinary
    │   ├── jobs/      # emailProcessor (cron)
    │   └── middleware/
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.js
    └── render.yaml
```

---

## Deploy — Paso a paso

### 1. Base de datos (Neon)
1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear proyecto → copiar `DATABASE_URL`

### 2. Cloudinary
1. Crear cuenta en [cloudinary.com](https://cloudinary.com)
2. Copiar `CLOUD_NAME`, `API_KEY`, `API_SECRET` desde el dashboard

### 3. Backend en Render
1. Push el código a GitHub
2. En [render.com](https://render.com) → New Web Service → conectar repo
3. Root directory: `backend`
4. Build: `npm install && npx prisma generate && npx prisma migrate deploy`
5. Start: `node src/index.js`
6. Agregar variables de entorno (ver `backend/.env.example`)
7. Tras el deploy, correr seed: `npx prisma db seed`

### 4. Frontend en Netlify
1. En [netlify.com](https://netlify.com) → Add new site → import from Git
2. Root directory: `frontend`
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Agregar variable: `VITE_API_URL=https://tu-backend.onrender.com`

---

## Variables de entorno

### Backend (`backend/.env.example`)
```env
DATABASE_URL=postgresql://...
JWT_SECRET=min-32-caracteres
FRONTEND_URL=https://tu-app.netlify.app
IMAP_HOST=mail.syna.com.ar
IMAP_PORT=993
IMAP_USER=cupones@syna.com.ar
IMAP_PASSWORD=...
IMAP_TLS=true
OPENAI_API_KEY=sk-...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=https://tu-backend.onrender.com
```

---

## Credenciales iniciales (seed)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@syna.com.ar | Admin123! | ADMIN |
| usuario@syna.com.ar | User123! | USER |

⚠️ **Cambiar contraseñas inmediatamente en producción.**

---

## Desarrollo local

```bash
# Backend
cd backend
cp .env.example .env   # completar variables
npm install
npx prisma migrate dev
npx prisma db seed
node src/index.js

# Frontend
cd frontend
cp .env.example .env   # agregar VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

---

## Funcionalidades

- **Lectura automática de mails** vía IMAP cada 15 min (configurable)
- **Análisis con OpenAI Vision**: detecta monto, fecha, cuotas, tarjeta, firma
- **Dashboard** con gráficos diarios/mensuales y ranking de sucursales
- **Alertas** automáticas por sucursales con muchos cupones sin firma
- **Exportación Excel** de cupones filtrados
- **Roles**: Admin (acceso total) / Usuario (solo lectura)
- **Logs del sistema** con nivel de severidad

