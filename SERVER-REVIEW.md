Server review

Fixed: HTTP 5xx errors were hidden from server logs; errorHandler now logs the stack while keeping production responses generic.

Frontend build passed. Server import passed. Server syntax checks passed. No merge conflict markers found in client/server source.

Deployment: Render Root Directory = server; Build Command = npm ci; Start Command = npm start; Health Check Path = /ready. Set NODE_ENV=production, MONGODB_URI, JWT_SECRET (at least 32 characters), CLIENT_URL (public frontend HTTPS URL), RESEND_API_KEY, EMAIL_FROM (verified domain). Do not put private values in GitHub.

The API opens its port after MongoDB connects. A database connection failure prevents startup. The old PurchaseOrder indexes() startup migration is absent in this upload. /auth/session is not the API path: use /api/auth/session.

Not verified: live Render environment, Atlas credentials/network access/transactions, provider email delivery. Supply the current Render log beginning at npm start to identify the actual deployed failure.
