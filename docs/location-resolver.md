# Location resolver setup

TripFlow can resolve Google Maps short links without exposing the Google Maps Platform API key to the browser. The Cloudflare Worker serves both the built Vite app and `POST /api/resolve-place`.

## Google setup

1. Create or select a Google Cloud project with billing enabled.
2. Enable Places API (New).
3. Create an API key and restrict it to Places API (New).
4. Keep the key out of `VITE_*` variables and frontend code.

## Local development

Copy `.dev.vars.example` to `.dev.vars`, replace the example key, then run:

```powershell
npm.cmd run worker:dev
```

The app and resolver are available together at `http://localhost:8787`. Regular `npm.cmd run dev` still runs the frontend-only Vite server; exact short-link resolution is unavailable there unless `VITE_PLACE_RESOLVER_URL` points to a running Worker.

## Deployment

Authenticate Wrangler, store the key as an encrypted Worker secret, and deploy:

```powershell
npx.cmd wrangler login
npx.cmd wrangler secret put GOOGLE_MAPS_API_KEY
npm.cmd run worker:deploy
```

Set `ALLOWED_ORIGIN` in the Worker environment when the frontend is hosted on a different origin. For a public deployment, also configure Cloudflare rate limiting to protect the billable resolver endpoint.
