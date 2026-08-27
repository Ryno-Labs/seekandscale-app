# Seek & Scale — Production MVP

This package replaces the demo member app with a Supabase-backed member application while keeping the original visual direction.

## What is real now

- Supabase password authentication on the member login.
- Invite-gated activation.
- RLS that prevents a member from changing their own role, status, invite, email, or billing state.
- Private member pages that reject unauthenticated, pending, suspended, canceled, and past-due accounts.
- Supabase-backed directory and vouches.
- Supabase-backed member forum posts.
- Private Help Desk requests that appear in Admin → Help Desk.
- Editable member profile fields through a locked-down RPC.
- Admin dashboard with directory, posts, help requests, members, invites, and payments.
- Stripe webhook/invite system, including subscription cancellation and failed-payment access checks.
- PWA service worker that only caches the same-origin app shell and does not cache Supabase/auth/payment responses.

## Start here

Open **GO-LIVE.md** and follow it top to bottom.

## Important

`assets/config.js` contains only browser-safe values. Never put the Supabase `service_role` key, Stripe secret key, or Stripe webhook signing secret in GitHub.
