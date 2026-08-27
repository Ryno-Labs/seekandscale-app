-- Seek & Scale production schema v2
-- Safe to run on a new project or over the earlier Seek & Scale schema.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);
insert into public.zones(name,slug) values
 ('Round Rock','round-rock'),('Georgetown','georgetown'),('Pflugerville','pflugerville'),
 ('Cedar Park','cedar-park'),('Liberty Hill','liberty-hill'),('Austin','austin')
on conflict(slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  business_name text,
  trade text,
  town text,
  zone_id uuid references public.zones(id) on delete set null,
  role text not null default 'member' check(role in ('member','admin')),
  status text not null default 'pending' check(status in ('pending','active','suspended')),
  invite_id uuid,
  billing_status text not null default 'not_required' check(billing_status in ('not_required','active','past_due','canceled')),
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists billing_status text not null default 'not_required';

do $$ begin
  alter table public.profiles add constraint profiles_billing_status_check check(billing_status in ('not_required','active','past_due','canceled'));
exception when duplicate_object then null; end $$;

create index if not exists profiles_status_idx on public.profiles(status);
create index if not exists profiles_zone_idx on public.profiles(zone_id);
create index if not exists profiles_email_idx on public.profiles(lower(email));

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  email text,
  max_uses int not null default 1 check(max_uses>0),
  used_count int not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  payment_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists invites_code_idx on public.invites(code);
create index if not exists invites_created_idx on public.invites(created_at desc);

create table if not exists public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique(invite_id,profile_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique,
  stripe_customer text,
  stripe_subscription text,
  email text,
  amount_cents int,
  currency text default 'usd',
  status text not null default 'paid',
  invite_id uuid references public.invites(id) on delete set null,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments add column if not exists stripe_subscription text;
alter table public.payments add column if not exists updated_at timestamptz not null default now();
create index if not exists payments_session_idx on public.payments(stripe_session_id);
create index if not exists payments_subscription_idx on public.payments(stripe_subscription);
create index if not exists payments_created_idx on public.payments(created_at desc);

alter table public.invites drop constraint if exists invites_payment_fk;
alter table public.invites add constraint invites_payment_fk foreign key(payment_id) references public.payments(id) on delete set null;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  owner_name text,
  category text,
  description text,
  helps_with text,
  years_in text,
  contact_phone text,
  contact_email text,
  website text,
  address text,
  town text,
  zone_id uuid references public.zones(id) on delete set null,
  logo_url text,
  accent_color text default '#111111',
  status text not null default 'published' check(status in ('draft','published')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.businesses add column if not exists owner_name text;
alter table public.businesses add column if not exists town text;
create index if not exists businesses_live_idx on public.businesses(status,deleted_at);
create index if not exists businesses_cat_idx on public.businesses(category);

create table if not exists public.vouches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(business_id,member_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  business_name text,
  town text,
  title text not null,
  body text,
  category text,
  image_url text,
  status text not null default 'draft' check(status in ('draft','published')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.posts add column if not exists author_name text;
alter table public.posts add column if not exists business_name text;
alter table public.posts add column if not exists town text;
create index if not exists posts_live_idx on public.posts(status,deleted_at,created_at desc);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz,
  location text,
  description text,
  image_url text,
  zone_id uuid references public.zones(id) on delete set null,
  status text not null default 'draft' check(status in ('draft','published')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists events_when_idx on public.events(starts_at);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  price_cents int,
  is_free boolean not null default false,
  image_url text,
  status text not null default 'published' check(status in ('draft','published','sold')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists listings_live_idx on public.listings(status,deleted_at,created_at desc);

create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requester_name text,
  requester_email text,
  business_name text,
  request_type text not null default 'question',
  subject text,
  body text not null,
  status text not null default 'new' check(status in ('new','working','done','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists help_requests_status_idx on public.help_requests(status,created_at desc);

-- ---------------------------------------------------------------------------
-- Auth profile trigger
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,business_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'business_name',''))
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Security helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active');
$$;
create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='active' and billing_status in ('not_required','active'));
$$;

-- ---------------------------------------------------------------------------
-- Invite functions
-- ---------------------------------------------------------------------------
create or replace function public.validate_invite(p_code text,p_email text default null)
returns json language plpgsql security definer set search_path=public as $$
declare v public.invites%rowtype;
begin
 select * into v from public.invites where lower(code)=lower(trim(p_code));
 if not found then return json_build_object('ok',false,'error','That code is not valid.'); end if;
 if v.revoked then return json_build_object('ok',false,'error','That code has been turned off.'); end if;
 if v.expires_at is not null and v.expires_at<now() then return json_build_object('ok',false,'error','That code has expired.'); end if;
 if v.used_count>=v.max_uses then return json_build_object('ok',false,'error','That code has already been used.'); end if;
 if v.email is not null and lower(coalesce(trim(p_email),''))<>lower(v.email) then
   return json_build_object('ok',false,'error','Use the email address this invite was issued to.');
 end if;
 return json_build_object('ok',true);
end $$;
revoke all on function public.validate_invite(text,text) from public;
grant execute on function public.validate_invite(text,text) to anon,authenticated;

create or replace function public.redeem_invite(p_code text)
returns json language plpgsql security definer set search_path=public as $$
declare v public.invites%rowtype; v_email text;
begin
 if auth.uid() is null then return json_build_object('ok',false,'error','Not signed in.'); end if;
 select * into v from public.invites where lower(code)=lower(trim(p_code)) for update;
 if not found then return json_build_object('ok',false,'error','That code is not valid.'); end if;
 if exists(select 1 from public.invite_redemptions where invite_id=v.id and profile_id=auth.uid()) then
   update public.profiles set status='active',invite_id=v.id,
     billing_status=case when exists(select 1 from public.payments where invite_id=v.id) then 'active' else 'not_required' end
   where id=auth.uid();
   return json_build_object('ok',true);
 end if;
 if v.revoked then return json_build_object('ok',false,'error','That code has been turned off.'); end if;
 if v.expires_at is not null and v.expires_at<now() then return json_build_object('ok',false,'error','That code has expired.'); end if;
 if v.used_count>=v.max_uses then return json_build_object('ok',false,'error','That code has already been used.'); end if;
 if v.email is not null then
   select email into v_email from public.profiles where id=auth.uid();
   if lower(coalesce(v_email,''))<>lower(v.email) then return json_build_object('ok',false,'error','That code belongs to a different email address.'); end if;
 end if;
 insert into public.invite_redemptions(invite_id,profile_id) values(v.id,auth.uid());
 update public.invites set used_count=used_count+1 where id=v.id;
 update public.profiles set status='active',invite_id=v.id,
   billing_status=case when exists(select 1 from public.payments where invite_id=v.id) then 'active' else 'not_required' end
 where id=auth.uid();
 return json_build_object('ok',true);
end $$;
revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;

create or replace function public.create_invite(
 p_label text default null,p_email text default null,p_max_uses int default 1,p_expires_at timestamptz default null,p_count int default 1
) returns setof public.invites language plpgsql security definer set search_path=public as $$
declare i int; v_code text; tries int;
begin
 if not public.is_admin() then raise exception 'admins only'; end if;
 for i in 1..least(greatest(p_count,1),50) loop
   tries:=0;
   loop
     tries:=tries+1;
     v_code:='SS-'||substr(regexp_replace(upper(encode(gen_random_bytes(9),'base64')),'[^A-Z0-9]','','g'),1,8);
     begin
       return query insert into public.invites(code,label,email,max_uses,expires_at,created_by)
         values(v_code,p_label,nullif(trim(p_email),''),greatest(p_max_uses,1),p_expires_at,auth.uid()) returning *;
       exit;
     exception when unique_violation then if tries>=5 then raise; end if;
     end;
   end loop;
 end loop;
end $$;
revoke all on function public.create_invite(text,text,int,timestamptz,int) from public;
grant execute on function public.create_invite(text,text,int,timestamptz,int) to authenticated;

-- Only editable profile fields are exposed to members. Status/role/email/invite_id cannot be changed here.
create or replace function public.update_my_profile(p_full_name text,p_business_name text,p_trade text,p_town text,p_zone_id uuid)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare outrow public.profiles%rowtype;
begin
 if auth.uid() is null then raise exception 'not signed in'; end if;
 update public.profiles set full_name=nullif(trim(p_full_name),''),business_name=nullif(trim(p_business_name),''),trade=nullif(trim(p_trade),''),town=nullif(trim(p_town),''),zone_id=p_zone_id where id=auth.uid() returning * into outrow;
 return outrow;
end $$;
revoke all on function public.update_my_profile(text,text,text,text,uuid) from public;
grant execute on function public.update_my_profile(text,text,text,text,uuid) to authenticated;

create or replace function public.create_member_post(p_body text,p_category text)
returns public.posts language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; outrow public.posts%rowtype; clean text;
begin
 if not public.is_active_member() then raise exception 'active members only'; end if;
 if p_category not in ('thought','request','giveaway','shoutout') then raise exception 'invalid post type'; end if;
 clean:=trim(p_body); if length(clean)<4 then raise exception 'post is too short'; end if;
 select * into p from public.profiles where id=auth.uid();
 insert into public.posts(author_id,author_name,business_name,town,title,body,category,status)
 values(auth.uid(),p.full_name,p.business_name,p.town,left(regexp_replace(clean,E'[\\n\\r]+',' ','g'),80),clean,p_category,'published') returning * into outrow;
 return outrow;
end $$;
revoke all on function public.create_member_post(text,text) from public;
grant execute on function public.create_member_post(text,text) to authenticated;

create or replace function public.submit_help_request(p_request_type text,p_subject text,p_body text)
returns public.help_requests language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; outrow public.help_requests%rowtype;
begin
 if not public.is_active_member() then raise exception 'active members only'; end if;
 if length(trim(p_body))<4 then raise exception 'tell us a little more'; end if;
 select * into p from public.profiles where id=auth.uid();
 insert into public.help_requests(requester_id,requester_name,requester_email,business_name,request_type,subject,body)
 values(auth.uid(),p.full_name,p.email,p.business_name,coalesce(nullif(trim(p_request_type),''),'question'),nullif(trim(p_subject),''),trim(p_body)) returning * into outrow;
 return outrow;
end $$;
revoke all on function public.submit_help_request(text,text,text) from public;
grant execute on function public.submit_help_request(text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.zones enable row level security;
alter table public.invites enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.payments enable row level security;
alter table public.businesses enable row level security;
alter table public.vouches enable row level security;
alter table public.posts enable row level security;
alter table public.events enable row level security;
alter table public.listings enable row level security;
alter table public.help_requests enable row level security;

-- Profiles: members can only read themselves. Admins can manage all. No direct self-update policy.
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_member_read on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_self_read on public.profiles for select using(id=auth.uid());
create policy profiles_admin_all on public.profiles for all using(public.is_admin()) with check(public.is_admin());

-- Zones
drop policy if exists zones_read on public.zones; drop policy if exists zones_admin on public.zones;
create policy zones_read on public.zones for select using(true);
create policy zones_admin on public.zones for all using(public.is_admin()) with check(public.is_admin());

-- Invites, redemptions, payments
drop policy if exists invites_admin on public.invites; create policy invites_admin on public.invites for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists redemptions_admin on public.invite_redemptions; drop policy if exists redemptions_self on public.invite_redemptions;
create policy redemptions_admin on public.invite_redemptions for all using(public.is_admin()) with check(public.is_admin());
create policy redemptions_self on public.invite_redemptions for select using(profile_id=auth.uid());
drop policy if exists payments_admin on public.payments; create policy payments_admin on public.payments for all using(public.is_admin()) with check(public.is_admin());

-- Businesses
drop policy if exists businesses_read on public.businesses; drop policy if exists businesses_admin on public.businesses;
create policy businesses_read on public.businesses for select using(public.is_active_member() and status='published' and deleted_at is null);
create policy businesses_admin on public.businesses for all using(public.is_admin()) with check(public.is_admin());

-- Vouches
drop policy if exists vouches_read on public.vouches; drop policy if exists vouches_own on public.vouches; drop policy if exists vouches_insert on public.vouches; drop policy if exists vouches_delete on public.vouches; drop policy if exists vouches_admin on public.vouches;
create policy vouches_read on public.vouches for select using(public.is_active_member());
create policy vouches_insert on public.vouches for insert with check(member_id=auth.uid() and public.is_active_member());
create policy vouches_delete on public.vouches for delete using(member_id=auth.uid() and public.is_active_member());
create policy vouches_admin on public.vouches for all using(public.is_admin()) with check(public.is_admin());

-- Posts
drop policy if exists posts_read on public.posts; drop policy if exists posts_own on public.posts; drop policy if exists posts_admin on public.posts;
drop policy if exists posts_own_update on public.posts; drop policy if exists posts_own_delete on public.posts;
create policy posts_read on public.posts for select using(public.is_active_member() and status='published' and deleted_at is null);
create policy posts_own_update on public.posts for update using(author_id=auth.uid() and public.is_active_member()) with check(author_id=auth.uid() and public.is_active_member());
create policy posts_own_delete on public.posts for delete using(author_id=auth.uid() and public.is_active_member());
create policy posts_admin on public.posts for all using(public.is_admin()) with check(public.is_admin());

-- Events
drop policy if exists events_read on public.events; drop policy if exists events_admin on public.events;
create policy events_read on public.events for select using(public.is_active_member() and status='published' and deleted_at is null);
create policy events_admin on public.events for all using(public.is_admin()) with check(public.is_admin());

-- Listings
drop policy if exists listings_read on public.listings; drop policy if exists listings_own on public.listings; drop policy if exists listings_admin on public.listings;
create policy listings_read on public.listings for select using(public.is_active_member() and deleted_at is null and status<>'draft');
create policy listings_own on public.listings for all using(seller_id=auth.uid() and public.is_active_member()) with check(seller_id=auth.uid() and public.is_active_member());
create policy listings_admin on public.listings for all using(public.is_admin()) with check(public.is_admin());

-- Help requests
drop policy if exists help_self_read on public.help_requests; drop policy if exists help_admin_all on public.help_requests;
create policy help_self_read on public.help_requests for select using(requester_id=auth.uid());
create policy help_admin_all on public.help_requests for all using(public.is_admin()) with check(public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public) values('media','media',true) on conflict(id) do update set public=true;
drop policy if exists media_public_read on storage.objects; drop policy if exists media_admin_write on storage.objects;
create policy media_public_read on storage.objects for select using(bucket_id='media');
create policy media_admin_write on storage.objects for all using(bucket_id='media' and public.is_admin()) with check(bucket_id='media' and public.is_admin());

-- To make the first admin after creating that user in Supabase Auth:
-- update public.profiles set role='admin',status='active' where lower(email)=lower('YOUR_EMAIL');
