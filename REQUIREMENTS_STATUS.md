# PickleRally — Requirements vs Code Status

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| **1. User registration & auth** |
| 1.1 | New user creates account → details saved to Supabase | Partial | Uses Supabase Auth (auth.users). No `profiles` table yet. |
| 1.2 | User data stored in right database tables | No | Need `profiles` table synced with auth.users |
| **2. Events (home page)** |
| 2.1 | Create event: title, location, date, max players → Supabase | Yes | `doCreateEvent` inserts into `events` |
| 2.2 | Notifications: friends notified when event created | No | No notifications table or logic |
| 2.3 | Group chat awareness: new events announced in chat | No | Not implemented |
| 2.4 | Event timestamp: show when event was created | Partial | `created_at` exists in schema but not shown in UI |
| **3. Nearby & location** |
| 3.1 | Nearby: use user location, show events sorted by distance | Yes | `initNearby`, `getUserLocation`, sort by distance |
| 3.2 | Filter by location: enter location, filter events | No | Search filters by text, not location filter |
| 3.3 | Tournaments: filter events by type | No | Skill filter on players exists; no event type filter |
| **4. Players** |
| 4.1 | Profile photos: upload profile pictures | No | No avatar_url, no upload |
| 4.2 | Game history: add past games / details | No | No game_history field |
| 4.3 | Stats: click player → see stats | No | No player detail overlay / stats view |
| **5. Chat** |
| 5.1 | Group chat: shared chat for all users | Yes | Global Chat room |
| 5.2 | Online users: show count | Yes | Live count badge (Supabase presence) |
| 5.3 | Private groups: create own groups | Partial | Schema supports it; UI does not |
| 5.4 | Friend requests: send/accept, show in profile/chat | No | No friend_requests table or UI |
| **6. Testing** |
| 6.1 | Test users (bots) for end-to-end testing | No | Not implemented |
