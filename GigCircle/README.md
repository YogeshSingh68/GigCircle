# GigCircle

Problem-to-team creator marketplace for the Creator Economy hackathon.

## What is wired
- React/Vite frontend connected to Express API
- Creator marketplace search + filters
- Problem Mode → project skill extraction → explainable matching
- Project DNA and constraint analysis
- Team Builder with budget + skill coverage + availability health
- Team stress-test UI
- Real booking records persisted by the API
- Creator dashboard with Accept/Decline actions
- Booking status updates reflected across client/creator views
- Gig creation API
- Post-project feedback API
- Local JSON persistence for a zero-setup hackathon demo

## Run
From the `GigCircle` root:

```bash
npm install
npm run dev
```

The root `predev` script installs both client and server dependencies automatically.

- Frontend: http://localhost:5173
- API: http://localhost:5000/api/health

## Demo flow
1. Open **Describe Your Project**.
2. Use a preset or type a project brief.
3. Set budget and deadline.
4. Click **Analyze & Find Creators**.
5. Select creators and open **Team Builder**.
6. Run the **Stress Test**.
7. Click **Book Team**.
8. Open **Bookings** to see real API records.
9. Switch to **Creator** to accept/decline Rahul's request.

## Persistence
The server creates `server/data/db.json` on first run. It is intentionally local and lightweight for the hackathon MVP. It can later be replaced with MongoDB without changing the frontend API contract.

## v4 incremental upgrade

This version preserves the v3 flow and adds two hackathon-focused capabilities:

- **Advanced Stress Test** — calls the API to simulate creator unavailability, a 30% deadline compression, and a 20% budget reduction. It reports coverage after failure and backup candidates.
- **Auto-Replacement** — when a booking is declined, the API searches for an available unused creator, scores the alternatives, and automatically creates a new pending booking for the best eligible replacement. The original declined request remains in the history.

Nothing from the previous v3 flow was removed. Existing project matching, marketplace, team builder, project health, bookings, creator dashboard, feedback endpoint, persistence, and rising talent remain available.

### Demo flow for the new features
1. Run `npm run dev`.
2. Create a project and select a team.
3. Open **Team Builder → Run advanced stress test** before booking to show resilience analysis.
4. Book the team.
5. In **Bookings** or **Creator Dashboard**, decline a pending request.
6. GigCircle automatically searches for a replacement and creates a new pending booking when an eligible creator exists.
