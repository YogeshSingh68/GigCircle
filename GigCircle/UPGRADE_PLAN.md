# GigCircle 3.0 — 24 Hour Hackathon Upgrade

## Done in this version
- SQLite persistence via better-sqlite3
- JWT + bcrypt authentication
- Demo client/creator accounts
- Structured Project DNA parser with deterministic fallback
- Explainable multi-factor matching including chemistry
- Socket.IO realtime booking/milestone events
- Notifications endpoint + realtime notifications
- Auto-replacement flow
- Team resilience stress testing
- Milestone/project command center API + UI
- Dynamic project milestones
- Analytics endpoint
- Existing marketplace, creator dashboard, feedback/trust loop retained

## Demo credentials
- Client: `client@gigcircle.local` / `demo123`
- Creator: `creator@gigcircle.local` / `demo123`

## Run
```bash
npm run dev
```

The root predev script installs client/server dependencies automatically.

## 24-hour priority order
1. Run/install dependencies and verify login + API health.
2. Demo Project DNA + explainable matching.
3. Demo Team Builder + Project Command Center.
4. Demo resilience stress test + auto replacement.
5. Open creator dashboard in second browser window and demonstrate realtime accept/decline.
6. Polish responsive states and rehearse 3-minute demo.

## Architecture
React/Vite → Express REST API → SQLite
                       ↘ Socket.IO realtime events
                       ↘ JWT/bcrypt auth
