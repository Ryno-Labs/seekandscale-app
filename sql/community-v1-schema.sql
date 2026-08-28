-- ============================================================
-- SEEK & SCALE — COMMUNITY V1 FOUNDATION
-- Fresh Supabase project
-- ============================================================


-- ============================================================
-- 1. MEMBERS
-- The actual people shown inside Seek & Scale.
-- A member can exist BEFORE they have a login.
-- ============================================================

create table public.members (
  id uuid primary key default gen_random_uuid(),

  auth_user_id uuid unique
    references auth.users(id)
    on delete set null,

  full_name text not null,
  email text,

  headline text,
  bio text,
  looking_for text,

  phone text,
  instagram_url text,
  linkedin_url text,

  profile_photo_url text,

  show_email boolean not null default false,
  show_phone boolean not null default true,
  show_socials boolean not null default true,

  role text not null default 'member'
    check (role in ('member','admin')),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'invited',
        'active',
        'hidden',
        'suspended'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index members_email_unique
on public.members(lower(email))
where email is not null;


-- ============================================================
-- 2. BUSINESSES
-- Brand/business information attached to a member.
-- ============================================================

create table public.businesses (
  id uuid primary key default gen_random_uuid(),

  member_id uuid not null
    references public.members(id)
    on delete cascade,

  name text not null,
  trade text,
  city text,

  what_they_do text,
  helps_with text,

  contact_email text,
  contact_phone text,
  website text,

  logo_url text,
  banner_url text,
  brand_color text default '#111111',

  is_primary boolean not null default true,

  status text not null default 'draft'
    check (status in ('draft','active','hidden')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_member_idx
on public.businesses(member_id);


-- ============================================================
-- 3. POSTS
--
-- One engine powers:
-- Discussions
-- Questions
-- Wins
-- Opportunities
-- Announcements
-- Resources
-- ============================================================

create table public.posts (
  id uuid primary key default gen_random_uuid(),

  author_member_id uuid not null
    references public.members(id)
    on delete cascade,

  category text not null
    check (
      category in (
        'discussion',
        'question',
        'win',
        'opportunity',
        'announcement',
        'resource'
      )
    ),

  subtype text,

  body text not null,

  image_url text,

  status text not null default 'published'
    check (status in ('published','hidden')),

  is_pinned boolean not null default false,

  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index posts_created_idx
on public.posts(created_at desc);

create index posts_category_idx
on public.posts(category);


-- ============================================================
-- 4. POST REPLIES
-- ============================================================

create table public.post_replies (
  id uuid primary key default gen_random_uuid(),

  post_id uuid not null
    references public.posts(id)
    on delete cascade,

  author_member_id uuid not null
    references public.members(id)
    on delete cascade,

  body text not null,

  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index post_replies_post_idx
on public.post_replies(post_id, created_at);


-- ============================================================
-- 5. VOUCHES
-- "I know this person/business and would recommend them."
-- ============================================================

create table public.vouches (
  id uuid primary key default gen_random_uuid(),

  voucher_member_id uuid not null
    references public.members(id)
    on delete cascade,

  target_member_id uuid not null
    references public.members(id)
    on delete cascade,

  created_at timestamptz not null default now(),

  constraint no_self_vouch
    check (voucher_member_id <> target_member_id),

  constraint one_vouch_per_member
    unique (voucher_member_id, target_member_id)
);


-- ============================================================
-- 6. GET HELP / SEEK & SCALE EXECUTION REQUESTS
-- ============================================================

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),

  requester_member_id uuid not null
    references public.members(id)
    on delete cascade,

  business_id uuid
    references public.businesses(id)
    on delete set null,

  need text not null,
  desired_outcome text,
  notes text,

  preferred_contact text,

  status text not null default 'new'
    check (
      status in (
        'new',
        'contacted',
        'scoping',
        'in_progress',
        'done',
        'closed'
      )
    ),

  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 7. INVITES
-- Admin can build somebody's member profile first,
-- then create an invite for them.
-- ============================================================

create table public.invites (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,

  member_id uuid not null
    references public.members(id)
    on delete cascade,

  email text,

  expires_at timestamptz,

  revoked boolean not null default false,

  created_by_member_id uuid
    references public.members(id)
    on delete set null,

  redeemed_by_auth_user_id uuid
    references auth.users(id)
    on delete set null,

  redeemed_at timestamptz,

  created_at timestamptz not null default now()
);


-- ============================================================
-- 8. UPDATED_AT HELPER
-- Automatically updates modification timestamps.
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger members_set_updated_at
before update on public.members
for each row
execute function public.set_updated_at();

create trigger businesses_set_updated_at
before update on public.businesses
for each row
execute function public.set_updated_at();

create trigger help_requests_set_updated_at
before update on public.help_requests
for each row
execute function public.set_updated_at();


-- ============================================================
-- 9. CURRENT MEMBER HELPER
-- Finds the member card connected to the signed-in user.
-- ============================================================

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.members
  where auth_user_id = auth.uid()
  limit 1;
$$;


-- ============================================================
-- 10. ACTIVE MEMBER CHECK
-- ============================================================

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where auth_user_id = auth.uid()
      and status = 'active'
  );
$$;


-- ============================================================
-- 11. ADMIN CHECK
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;


-- ============================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================

alter table public.members enable row level security;
alter table public.businesses enable row level security;
alter table public.posts enable row level security;
alter table public.post_replies enable row level security;
alter table public.vouches enable row level security;
alter table public.help_requests enable row level security;
alter table public.invites enable row level security;


-- ============================================================
-- MEMBERS
-- ============================================================

create policy members_admin_all
on public.members
for all
using (public.is_admin())
with check (public.is_admin());

create policy members_active_read
on public.members
for select
using (
  public.is_active_member()
  and status = 'active'
);


-- ============================================================
-- BUSINESSES
-- ============================================================

create policy businesses_admin_all
on public.businesses
for all
using (public.is_admin())
with check (public.is_admin());

create policy businesses_active_read
on public.businesses
for select
using (
  public.is_active_member()
  and status = 'active'
);


-- ============================================================
-- POSTS
-- ============================================================

create policy posts_admin_all
on public.posts
for all
using (public.is_admin())
with check (public.is_admin());

create policy posts_member_read
on public.posts
for select
using (
  public.is_active_member()
  and status = 'published'
  and deleted_at is null
);

create policy posts_member_insert
on public.posts
for insert
with check (
  public.is_active_member()
  and author_member_id = public.current_member_id()
  and category in (
    'discussion',
    'question',
    'win',
    'opportunity'
  )
  and status = 'published'
  and is_pinned = false
);

create policy posts_member_delete
on public.posts
for delete
using (
  public.is_active_member()
  and author_member_id = public.current_member_id()
);


-- ============================================================
-- REPLIES
-- ============================================================

create policy replies_admin_all
on public.post_replies
for all
using (public.is_admin())
with check (public.is_admin());

create policy replies_member_read
on public.post_replies
for select
using (
  public.is_active_member()
  and deleted_at is null
);

create policy replies_member_insert
on public.post_replies
for insert
with check (
  public.is_active_member()
  and author_member_id = public.current_member_id()
);

create policy replies_member_delete
on public.post_replies
for delete
using (
  public.is_active_member()
  and author_member_id = public.current_member_id()
);


-- ============================================================
-- VOUCHES
-- ============================================================

create policy vouches_admin_all
on public.vouches
for all
using (public.is_admin())
with check (public.is_admin());

create policy vouches_member_read
on public.vouches
for select
using (public.is_active_member());

create policy vouches_member_insert
on public.vouches
for insert
with check (
  public.is_active_member()
  and voucher_member_id = public.current_member_id()
);

create policy vouches_member_delete
on public.vouches
for delete
using (
  public.is_active_member()
  and voucher_member_id = public.current_member_id()
);


-- ============================================================
-- HELP REQUESTS
-- ============================================================

create policy help_admin_all
on public.help_requests
for all
using (public.is_admin())
with check (public.is_admin());

create policy help_member_insert
on public.help_requests
for insert
with check (
  public.is_active_member()
  and requester_member_id = public.current_member_id()
);

create policy help_member_read
on public.help_requests
for select
using (
  public.is_active_member()
  and requester_member_id = public.current_member_id()
);


-- ============================================================
-- INVITES
-- Only admins browse/manage invites directly.
-- ============================================================

create policy invites_admin_all
on public.invites
for all
using (public.is_admin())
with check (public.is_admin());


-- ============================================================
-- 13. CREATE INVITE FUNCTION
-- Admin creates an invite for an existing member card.
-- ============================================================

create or replace function public.create_member_invite(
  p_member_id uuid,
  p_expires_at timestamptz default (now() + interval '30 days')
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_email text;
begin

  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  select email
  into v_email
  from public.members
  where id = p_member_id;

  if not found then
    raise exception 'Member not found';
  end if;

  v_code :=
    'SS-' ||
    upper(
      substr(
        replace(gen_random_uuid()::text, '-', ''),
        1,
        8
      )
    );

  insert into public.invites (
    code,
    member_id,
    email,
    expires_at,
    created_by_member_id
  )
  values (
    v_code,
    p_member_id,
    v_email,
    p_expires_at,
    public.current_member_id()
  );

  update public.members
  set status = 'invited'
  where id = p_member_id
    and status = 'draft';

  return v_code;

end;
$$;


-- ============================================================
-- 14. CLAIM INVITE
--
-- Person signs up through Supabase Auth first.
-- Then this attaches their login to the member card
-- you already created for them.
-- ============================================================

create or replace function public.claim_member_invite(
  p_code text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_member public.members%rowtype;
  v_auth_email text;
begin

  if auth.uid() is null then
    return json_build_object(
      'ok', false,
      'error', 'You must be signed in.'
    );
  end if;

  select *
  into v_invite
  from public.invites
  where lower(code) = lower(trim(p_code))
  for update;

  if not found then
    return json_build_object(
      'ok', false,
      'error', 'That invite is not valid.'
    );
  end if;

  if v_invite.revoked then
    return json_build_object(
      'ok', false,
      'error', 'That invite has been turned off.'
    );
  end if;

  if v_invite.redeemed_at is not null then

    if v_invite.redeemed_by_auth_user_id = auth.uid() then
      return json_build_object('ok', true);
    end if;

    return json_build_object(
      'ok', false,
      'error', 'That invite has already been used.'
    );
  end if;

  if v_invite.expires_at is not null
     and v_invite.expires_at < now() then

    return json_build_object(
      'ok', false,
      'error', 'That invite has expired.'
    );

  end if;

  select *
  into v_member
  from public.members
  where id = v_invite.member_id
  for update;

  select email
  into v_auth_email
  from auth.users
  where id = auth.uid();

  if v_invite.email is not null
     and lower(trim(v_invite.email))
         <> lower(trim(coalesce(v_auth_email,''))) then

    return json_build_object(
      'ok', false,
      'error', 'This invite belongs to a different email address.'
    );

  end if;

  if v_member.auth_user_id is not null
     and v_member.auth_user_id <> auth.uid() then

    return json_build_object(
      'ok', false,
      'error', 'This member profile is already claimed.'
    );

  end if;

  update public.members
  set
    auth_user_id = auth.uid(),
    status = 'active'
  where id = v_member.id;

  update public.invites
  set
    redeemed_by_auth_user_id = auth.uid(),
    redeemed_at = now()
  where id = v_invite.id;

  return json_build_object(
    'ok', true,
    'member_id', v_member.id
  );

end;
$$;


-- ============================================================
-- 15. FUNCTION PERMISSIONS
-- ============================================================

revoke all on function public.create_member_invite(uuid,timestamptz)
from public;

grant execute
on function public.create_member_invite(uuid,timestamptz)
to authenticated;

revoke all on function public.claim_member_invite(text)
from public;

grant execute
on function public.claim_member_invite(text)
to authenticated;
