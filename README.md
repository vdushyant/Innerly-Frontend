# Innerly

The web interface for the Journal Application API.

## Run locally

1. Start the backend at `http://localhost:8080` (see the backend README).
2. Run `npm install` and `npm run dev` from this directory.
3. Open the local URL shown by Vite and create an account.

Vite proxies `/public`, `/user`, and `/journal` to the local backend. For a separately hosted API, set `VITE_API_URL` to its base URL and allow the frontend origin in the backend's `APP_CORS_ALLOWED_ORIGINS` setting.

The frontend stores the signed-in token for the current browser tab and clears it when you sign out. The API issues tokens that expire after 24 hours by default.
