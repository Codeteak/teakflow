# Host Teakflow web on Vercel

Frontend: Vercel · API: Railway · Data: Supabase

## 1. Push code

Include the latest web changes (`VITE_API_URL` support, `apps/web/vercel.json`) and redeploy the API so production cookies use `SameSite=None`.

## 2. Railway API env

Set (or update):

```text
CLIENT_ORIGIN=https://YOUR-VERCEL-DOMAIN.vercel.app
```

Use the real Vercel URL after the first deploy (no trailing slash). Redeploy the API after changing it.

Google OAuth (if used):

```text
GOOGLE_REDIRECT_URI=https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/v1/auth/google/callback
```

## 3. Create the Vercel project

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import the GitHub repo.
2. Prefer **Root Directory = repository root** (leave blank). Use the root `vercel.json` (`outputDirectory`: `apps/web/dist`).
3. Or set **Root Directory = `apps/web`** and use `apps/web/vercel.json` (`outputDirectory`: `dist`).
4. In **Project Settings → General → Build & Output Settings**:
   - Clear any Output Directory override of `public`
   - Output Directory must be `apps/web/dist` (repo root) or `dist` (if root is `apps/web`)
   - Framework Preset: **Other** (not Create React App)

Build already emits Vite’s `dist/` folder — not `public/`.

## 4. Vercel environment variables

Project → **Settings → Environment Variables** (Production + Preview):

| Name | Value |
| --- | --- |
| `VITE_API_URL` | `https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/v1` |
| `VITE_SOCKET_URL` | `https://YOUR-RAILWAY-DOMAIN.up.railway.app` |
| `VITE_SUPABASE_URL` | same as local (optional for current web features) |
| `VITE_SUPABASE_ANON_KEY` | same as local (optional) |

`VITE_*` are baked in at **build** time — change them → **Redeploy**.

## 5. Deploy

Click **Deploy**. Open the Vercel URL, sign in, confirm chat sockets connect (browser Network → WS to Railway).

## 6. Sync origins

After you know the final Vercel domain:

1. Railway `CLIENT_ORIGIN` = that exact origin (`https://…vercel.app`).
2. Redeploy API.
3. If you use a custom domain on Vercel, update `CLIENT_ORIGIN` again.

## Local still works

Leave `apps/web/.env` as:

```text
VITE_API_URL=http://localhost:3005/api/v1
VITE_SOCKET_URL=http://localhost:3005
```

Vite’s `/api` proxy is unchanged for `pnpm dev`.
