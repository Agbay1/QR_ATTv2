# QR-ATT – Smart School Event Attendance (Expo + Supabase)

## Setup
1. Supabase SQL Editor: run `supabase/migrations/` files IN ORDER (…0000, …0002 `20260102…`, …`20260103…`). Or `supabase db push`.
2. Authentication → Providers → Email: turn OFF "Confirm email" while testing.
3. Authentication → Email Templates → **Reset Password**: put `Your code: {{ .Token }}` in the body (the app uses the 6-digit code).
4. `npm install` then `npx expo install --fix` then `npx expo start -c`.
5. Register, then make yourself admin (SQL at bottom of migration 1). Promote teachers in the Users tab.
6. APK: `eas build -p android --profile preview`.

## Structure
- `App.js` session root · `src/supabase.js` client · `src/theme.js` colours/styles · `src/ui.js` shared animated components
- `src/offline.js` offline queue · `src/notify.js` local notifications
- `src/screens/` Auth, Home (tabs), Student (events/scan/history), Staff (events/QR/attendance), Admin (users/analytics), Profile

## Event -> Handler -> Action -> Result (for your defense)
1. Login pressed -> `submit` -> `signInWithPassword` -> session + Home
2. QR detected -> `onScan` -> RPC `record_attendance` -> row inserted + confirmation
3. Invalid/expired QR -> `onScan` -> RPC raises error -> red result + vibration
4. Duplicate -> unique(event_id, student_id) -> `DUPLICATE` -> message
5. Event closed -> `setStatus` -> trigger sets `closed_at` -> scans rejected, students notified (realtime)
6. Offline scan -> `queueScan` -> `syncQueue` every 15 s -> synced when online
7. Logout -> `signOut` -> `onAuthStateChange` -> Auth screen

## Notes
- Rotating QR: code changes every 30 s (server-checked, current + previous slot). Late = after `late_after_minutes` from start time (Asia/Manila).
- Offline scans are flagged "synced offline" for teachers to review (the phone clock is trusted for those).
- CSV export uses the share sheet (send to email/Drive/Notes).


---
Theme: sky. Same functions and Supabase backend as the original; only colours, icons, tagline and shapes differ. Package id: com.qratt.sky.

## Upgrade notes (v2)
Run once in the Supabase SQL editor, in order (each is safe to run twice):
1. `supabase/migrations/20260104000000_event_end_time.sql` (optional End time + auto-close)
2. `supabase/migrations/20260105000000_departments_and_stats.sql` (departments + stats)

No `npm install` is needed (no new packages). Low-end devices: set `LITE = true` in `src/theme.js`.
