# Decision Points

## DP1 — Rejection
**Decision:** A booking can be declined and remains visible with `Declined` status.
**Reason:** Avoids dead ends and creates a clear place to add automatic replacement later.

## DP2 — Double Booking
**Decision:** Bookings are stored independently per creator and can be status-updated through the API.
**Reason:** Keeps the MVP simple while preserving a server-side booking record that can later enforce availability conflicts.

## DP3 — Discovery
**Decision:** Project matching uses required skills, budget, availability, rating and delivery time with an explainable score.
**Reason:** The product promise is transparent matching rather than a black-box AI recommendation.

## DP4 — Persistence
**Decision:** Use a local JSON data store for the hackathon MVP.
**Reason:** Zero database setup keeps the demo reliable while maintaining a clean API boundary for a future MongoDB implementation.

## DP5 — Frontend/API boundary
**Decision:** React does not own booking truth; it calls Express for matching, booking creation and status updates.
**Reason:** This makes the demo a real full-stack workflow instead of a collection of UI-only interactions.
