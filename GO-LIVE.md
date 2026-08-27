# Seek & Scale — Go Live

Follow this in order. You already have GitHub and Supabase, so the fastest path is:

**Supabase database → first admin → config.js → GitHub Pages → test invite → optional Stripe.**

---

# Part 1 — Supabase database

## 1. Open your Supabase project

Use a new project for the cleanest launch, or use the Seek & Scale project you already started.

## 2. Run the production schema

1. Supabase → **SQL Editor**.
2. Click **New query**.
3. Open `sql/schema.sql` from this package.
4. Copy the entire file into the SQL Editor.
5. Click **Run**.

This creates/updates:

- profiles
- zones
- invites
- invite_redemptions
- payments
- businesses
- vouches
- posts
- events
- listings
- help_requests
- the `media` Storage bucket
- RLS policies
- invite/profile/forum/help RPC functions

If you ran the older schema before, this file is designed to update that structure instead of requiring you to delete everything.

## 3. Confirm the tables

Supabase → **Table Editor**. Confirm that `profiles`, `businesses`, `posts`, `help_requests`, `invites`, and `payments` exist.

---

# Part 2 — Create your first admin

The first admin is the only account you create manually.

## 1. Create the Auth user

Supabase → **Authentication → Users → Add user**.

Use your admin email and a strong password. If Supabase offers **Auto Confirm User**, turn it on for this manually created admin.

## 2. Promote the account

Go back to **SQL Editor** and run, replacing the email:

```sql
update public.profiles
set role = 'admin', status = 'active', billing_status = 'not_required'
where lower(email) = lower('YOUR-EMAIL@example.com');
```

## 3. Check it

Table Editor → `profiles`.

Your row should show:

- `role = admin`
- `status = active`
- `billing_status = not_required`

---

# Part 3 — Get your browser-safe Supabase values

Supabase → **Project Settings / API**.

You need:

1. **Project URL** — like `https://abcdefgh.supabase.co`
2. The browser-safe **anon/public key**. If your project shows a newer **publishable** browser key instead, use the browser-safe key Supabase provides for client applications.

Do **not** use the `service_role` key here.

Open:

`assets/config.js`

Replace:

```js
var SUPABASE_URL      = 'https://YOUR-PROJECT-REF.supabase.co';
var SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
```

with your real browser values.

Leave the Stripe link placeholder alone for now if you have not connected Stripe yet.

---

# Part 4 — Put the site on GitHub Pages

## 1. Create a repository

GitHub → **New repository**.

Suggested name:

`seek-scale`

Public is simplest for GitHub Pages.

## 2. Upload the package correctly

Upload the **contents** of the `seek-scale-production` folder to the root of the repository.

The repository root must look like this:

```text
index.html
home.html
join.html
signup.html
success.html
...
assets/
admin/
sql/
supabase/
```

Do not upload one outer folder that contains all of those files.

Also make sure `.nojekyll` is present. GitHub may hide dot-files on your computer.

## 3. Turn on Pages

Repository → **Settings → Pages**.

Choose:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/ (root)**

Save.

After a couple of minutes your URL will look like:

```text
https://YOUR-GITHUB-NAME.github.io/seek-scale/
```

Call that your **SITE_URL** for the steps below.

---

# Part 5 — Configure Supabase Auth URLs

This matters if email confirmation is turned on.

Supabase → **Authentication → URL Configuration**.

Set your **Site URL** to your GitHub Pages base URL, for example:

```text
https://YOUR-GITHUB-NAME.github.io/seek-scale/
```

Add a redirect URL for:

```text
https://YOUR-GITHUB-NAME.github.io/seek-scale/index.html
```

If you later move to `https://app.seekandscale.com`, update these values to the custom domain.

The new signup code supports both configurations:

- Email confirmation OFF → the invite is redeemed immediately.
- Email confirmation ON → the invite is saved, the person confirms email, signs in, then activation finishes.

---

# Part 6 — Test the real member system before Stripe

Do this before touching payments.

## 1. Open Admin

Go to:

```text
YOUR-SITE-URL/admin/
```

Sign in with the admin account you created.

You should see the Admin dashboard.

## 2. Make a test invite

Admin → **Invites**.

Create one invite. For the first test, you can leave **Lock to email** blank.

Click **Copy link**.

## 3. Test like a real customer

Open the copied link in a private/incognito browser window.

Create a different test member account.

Expected result:

1. Invite is checked before signup.
2. Account is created.
3. Invite is redeemed after authentication.
4. Profile becomes `active`.
5. Member lands on `home.html`.
6. Going directly to a member page while signed out sends you back to Sign In.

## 4. Test the security fix

In Supabase → Table Editor, the test member should be `active` only after the invite was redeemed.

The browser no longer has a direct RLS path that lets a member change their own `status`, `role`, `invite_id`, `email`, or `billing_status`.

---

# Part 7 — Put real content into the app

Admin now controls the live app.

## Directory

Admin → **Directory → Add new**.

Fill in the business. Use **Linked member account** if this directory listing belongs to a member.

That link is what makes the listing appear under the member's **Me** page.

## Posts

Admin → **Posts → Add new**.

Useful categories:

- `article` — can become the Home feature
- `news` — shows under Worth Knowing
- `resource` — shows in Help Desk resources
- `thought`, `request`, `giveaway`, `shoutout` — forum-style content

Set status to **published** to make it visible to members.

## Help Desk

When a member sends a Help Desk request, it appears under:

**Admin → Help Desk**

Move it through:

`new → working → done/closed`

## Member forum

Members can create Thought, Request, Giveaway, and Shout-out posts themselves. They can remove their own posts but cannot alter another member's post.

---

# Part 8 — Stripe membership checkout (optional until you want to charge)

The app is fully testable using admin-created invites without Stripe. Connect this part when you want paid recurring memberships.

You need a Stripe account.

## 1. Create a recurring product

In Stripe Test Mode create:

- Product: `Seek & Scale Membership`
- Price: `$81`
- Recurring: Monthly

Create a **Payment Link**.

## 2. Set the post-payment redirect

Configure the Payment Link to redirect after payment to:

```text
YOUR-SITE-URL/success.html?session_id={CHECKOUT_SESSION_ID}
```

Use `{CHECKOUT_SESSION_ID}` literally.

## 3. Put the Payment Link in the site

Open `assets/config.js` and replace:

```js
var STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/YOUR-LINK';
```

with the Stripe Test Payment Link.

Commit the change to GitHub.

---

# Part 9 — Deploy the two Supabase Edge Functions

These secrets never go in GitHub.

## 1. Install Supabase CLI

Mac with Homebrew:

```bash
brew install supabase/tap/supabase
```

Or install the current Supabase CLI using Supabase's supported method for your computer.

Check:

```bash
supabase --version
```

## 2. Open Terminal in the project folder

Change into the folder that contains `supabase/config.toml`.

Then:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is the first part of the Supabase URL:

`https://abcdefgh.supabase.co` → `abcdefgh`

## 3. Set the server secrets

Get these from Supabase/Stripe:

- `SERVICE_ROLE_KEY` — Supabase server-only service role key
- `STRIPE_SECRET_KEY` — Stripe test secret key
- `PROJECT_URL` — your Supabase URL
- `SITE_URL` — your GitHub Pages base URL with the repository path

Run:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxx SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY PROJECT_URL=https://YOUR_REF.supabase.co SITE_URL=https://YOUR-GITHUB-NAME.github.io/seek-scale
```

Do not put any of those secrets into `assets/config.js`.

## 4. Deploy

```bash
supabase functions deploy get-invite --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

---

# Part 10 — Point Stripe to the webhook

Stripe Test Mode → **Developers → Webhooks → Add endpoint**.

Endpoint:

```text
https://YOUR_REF.supabase.co/functions/v1/stripe-webhook
```

Subscribe to these events:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`

After creating the webhook, reveal its signing secret (`whsec_...`).

Set it in Supabase:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
supabase functions deploy stripe-webhook --no-verify-jwt
```

The webhook now does four jobs:

1. Completed checkout → creates a one-time invite locked to the payer's email.
2. Successful recurring invoice → billing access stays active.
3. Failed recurring invoice → billing access becomes `past_due` and member pages are blocked.
4. Subscription deleted → billing access becomes `canceled` and member pages are blocked.

A manual admin suspension is separate from billing, so a later Stripe payment does not silently undo an admin suspension.

---

# Part 11 — Test Stripe end to end

Still in Stripe **Test Mode**:

1. Open the Membership Payment Link in a private window.
2. Pay with Stripe's standard test card.
3. Stripe redirects to `success.html`.
4. An invite code should appear within a few seconds.
5. Click **Create my account**.
6. Use the same email address used at checkout.
7. Finish signup.
8. Confirm the member reaches Home.

Check Admin:

- **Payments** contains the test payment.
- **Invites** contains the generated invite.
- **Members** contains the new active member.

---

# Part 12 — Optional invite email

The success page always shows the invite. Emailing it is optional.

If you use Resend:

1. Verify your sending domain in Resend.
2. Create an API key.
3. Run:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase functions deploy stripe-webhook --no-verify-jwt
```

If you do not configure Resend, the success page still works and does not falsely tell the customer that an email was sent.

---

# Part 13 — Go live in Stripe

When Test Mode works completely:

1. Switch Stripe to Live Mode.
2. Create the live recurring product/payment link.
3. Create the live webhook with the same four event types.
4. Replace the Stripe secrets in Supabase with the live versions.
5. Replace `STRIPE_PAYMENT_LINK` in `assets/config.js` with the live Payment Link.
6. Redeploy `stripe-webhook`.
7. Make one real purchase yourself and verify the entire flow.

---

# Part 14 — Custom domain later

You do not need this to launch.

When you are ready, point something like:

```text
app.seekandscale.com
```

to GitHub Pages.

Then update all three places:

1. GitHub Pages custom domain.
2. Supabase Authentication Site URL / redirect URL.
3. Supabase Edge Function secret:

```bash
supabase secrets set SITE_URL=https://app.seekandscale.com
```

Also update the Stripe success redirect to the custom domain.

---

# Part 15 — When you edit the site

`sw.js` currently starts with:

```js
var CACHE='seek-scale-prod-v1';
```

When you make a meaningful front-end change, bump it:

```js
seek-scale-prod-v2
seek-scale-prod-v3
```

That forces installed PWAs to discard the old app shell.

The service worker intentionally does **not** cache Supabase, Stripe, authentication, invite-session URLs, or arbitrary API responses.

---

# Final launch checklist

- [ ] `sql/schema.sql` ran successfully.
- [ ] First admin is `role=admin`, `status=active`.
- [ ] `assets/config.js` has the real Supabase URL and browser-safe key.
- [ ] GitHub Pages loads `index.html`.
- [ ] `/admin/` accepts the admin login.
- [ ] Admin-created invite works in an incognito window.
- [ ] Signed-out users cannot open member pages directly.
- [ ] Directory content comes from Supabase.
- [ ] Forum post survives a page refresh and another browser session.
- [ ] Help Desk request appears in Admin → Help Desk.
- [ ] Member can edit only allowed profile fields.
- [ ] If using Stripe: payment → success code → signup → member works.
- [ ] If using Stripe: failed/canceled subscription blocks access.
- [ ] `service_role`, Stripe secret, and webhook secret are not in GitHub.
