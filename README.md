# Tablero recursos empresa (PostgreSQL + Express + Vanilla JS)

Proyecto demo con:

- Frontend: HTML + CSS + JavaScript vanilla
- Backend: Node.js + Express (ES Modules)
- Herramientas: nodemon, dotenv, cors
- Base de datos: PostgreSQL cloud (Neon)

## 1) InstalaciÃ³n

```bash
cd backend`r`nnpm install
```

## 2) Variables de entorno

Copiar `.env.example` a `.env` y completar:

```env
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

## 3) Inicializar DB

```bash
cd backend`r`nnpm run db:init
```

## 4) Cargar datos dummy (opcional)

```bash
cd backend`r`nnpm run db:seed
```

## 5) Ejecutar proyecto

```bash
cd backend`r`nnpm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Archivo clave para Neon

La conexiÃ³n se configura en:

- `backend/config/db.js`

Y la URL se cambia en:

- `.env` (`DATABASE_URL`)

## Conversion de monedas

- Fuente ARS/USD: API de BCRA.
- Fuente resto de pares: API de Frankfurter.
- Cache historica local: tabla `exchange_rates`.
- Endpoint manual: `GET /api/exchange-rates?base=USD&quote=ARS&date=2026-03-10`


