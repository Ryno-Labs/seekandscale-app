# What was fixed

1. Replaced demo login with real Supabase authentication.
2. Added member-page auth/status/billing guards.
3. Removed the RLS path that allowed members to update their own status/role.
4. Added invite validation before signup and safe redemption after authentication.
5. Made email-confirmation flow recoverable through the real login page.
6. Replaced localStorage forum/vouch data with Supabase-backed data.
7. Added private Help Desk requests and an Admin Help Desk queue.
8. Added safe member profile editing through a restricted RPC.
9. Removed broad member access to the full profiles table.
10. Changed the PWA start page back to Sign In.
11. Restricted the service worker so auth/API/payment responses are never cached.
12. Added Stripe recurring billing state handling without letting Stripe undo a manual admin suspension.
13. Added Admin linking between a directory business and its member account.
14. Removed the false "we emailed you" claim when Resend is not configured.
15. Replaced hard-coded member identity/date/demo content in the member application with live data.
