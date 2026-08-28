-- ============================================================
-- SEEK & SCALE — COMMUNITY V1 ADMIN TOOLS
-- ============================================================


-- ============================================================
-- 1. MEMBER MEDIA STORAGE
-- Profile photos, business logos and banners
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'member-media',
  'member-media',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do nothing;


create policy "member_media_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-media'
  and public.is_admin()
);


create policy "member_media_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-media'
  and public.is_admin()
)
with check (
  bucket_id = 'member-media'
  and public.is_admin()
);


create policy "member_media_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-media'
  and public.is_admin()
);


-- ============================================================
-- 2. ADMIN CREATE MEMBER
-- Creates member + optional business in one action
-- ============================================================

create or replace function public.admin_create_member(
  p_full_name text,
  p_email text default null,
  p_headline text default null,
  p_bio text default null,
  p_looking_for text default null,
  p_phone text default null,
  p_instagram_url text default null,
  p_linkedin_url text default null,
  p_profile_photo_url text default null,

  p_business_name text default null,
  p_trade text default null,
  p_city text default null,
  p_what_they_do text default null,
  p_helps_with text default null,
  p_business_phone text default null,
  p_business_email text default null,
  p_website text default null,
  p_logo_url text default null,
  p_banner_url text default null,
  p_brand_color text default '#111111'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_business_id uuid;
begin

  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  insert into public.members (
    full_name,
    email,
    headline,
    bio,
    looking_for,
    phone,
    instagram_url,
    linkedin_url,
    profile_photo_url,
    status
  )
  values (
    trim(p_full_name),
    nullif(trim(p_email), ''),
    nullif(trim(p_headline), ''),
    nullif(trim(p_bio), ''),
    nullif(trim(p_looking_for), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_instagram_url), ''),
    nullif(trim(p_linkedin_url), ''),
    nullif(trim(p_profile_photo_url), ''),
    'draft'
  )
  returning id into v_member_id;

  if nullif(trim(p_business_name), '') is not null then

    insert into public.businesses (
      member_id,
      name,
      trade,
      city,
      what_they_do,
      helps_with,
      contact_phone,
      contact_email,
      website,
      logo_url,
      banner_url,
      brand_color,
      status
    )
    values (
      v_member_id,
      trim(p_business_name),
      nullif(trim(p_trade), ''),
      nullif(trim(p_city), ''),
      nullif(trim(p_what_they_do), ''),
      nullif(trim(p_helps_with), ''),
      nullif(trim(p_business_phone), ''),
      nullif(trim(p_business_email), ''),
      nullif(trim(p_website), ''),
      nullif(trim(p_logo_url), ''),
      nullif(trim(p_banner_url), ''),
      coalesce(nullif(trim(p_brand_color), ''), '#111111'),
      'draft'
    )
    returning id into v_business_id;

  end if;

  return json_build_object(
    'ok', true,
    'member_id', v_member_id,
    'business_id', v_business_id
  );

end;
$$;


revoke all
on function public.admin_create_member(
  text,text,text,text,text,text,text,text,text,
  text,text,text,text,text,text,text,text,text,text,text
)
from public;


grant execute
on function public.admin_create_member(
  text,text,text,text,text,text,text,text,text,
  text,text,text,text,text,text,text,text,text,text,text
)
to authenticated;


-- ============================================================
-- 3. ADMIN UPDATE MEMBER
-- Updates member + primary business
-- ============================================================

create or replace function public.admin_update_member(
  p_member_id uuid,

  p_full_name text,
  p_email text default null,
  p_headline text default null,
  p_bio text default null,
  p_looking_for text default null,
  p_phone text default null,
  p_instagram_url text default null,
  p_linkedin_url text default null,
  p_profile_photo_url text default null,

  p_business_name text default null,
  p_trade text default null,
  p_city text default null,
  p_what_they_do text default null,
  p_helps_with text default null,
  p_business_phone text default null,
  p_business_email text default null,
  p_website text default null,
  p_logo_url text default null,
  p_banner_url text default null,
  p_brand_color text default '#111111'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin

  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  if not exists (
    select 1
    from public.members
    where id = p_member_id
  ) then
    raise exception 'Member not found';
  end if;

  update public.members
  set
    full_name = trim(p_full_name),
    email = nullif(trim(p_email), ''),
    headline = nullif(trim(p_headline), ''),
    bio = nullif(trim(p_bio), ''),
    looking_for = nullif(trim(p_looking_for), ''),
    phone = nullif(trim(p_phone), ''),
    instagram_url = nullif(trim(p_instagram_url), ''),
    linkedin_url = nullif(trim(p_linkedin_url), ''),
    profile_photo_url = nullif(trim(p_profile_photo_url), '')
  where id = p_member_id;

  select id
  into v_business_id
  from public.businesses
  where member_id = p_member_id
    and is_primary = true
  limit 1;

  if v_business_id is null
     and nullif(trim(p_business_name), '') is not null then

    insert into public.businesses (
      member_id,
      name,
      trade,
      city,
      what_they_do,
      helps_with,
      contact_phone,
      contact_email,
      website,
      logo_url,
      banner_url,
      brand_color,
      status
    )
    values (
      p_member_id,
      trim(p_business_name),
      nullif(trim(p_trade), ''),
      nullif(trim(p_city), ''),
      nullif(trim(p_what_they_do), ''),
      nullif(trim(p_helps_with), ''),
      nullif(trim(p_business_phone), ''),
      nullif(trim(p_business_email), ''),
      nullif(trim(p_website), ''),
      nullif(trim(p_logo_url), ''),
      nullif(trim(p_banner_url), ''),
      coalesce(nullif(trim(p_brand_color), ''), '#111111'),
      'draft'
    )
    returning id into v_business_id;

  elsif v_business_id is not null then

    update public.businesses
    set
      name = coalesce(nullif(trim(p_business_name), ''), name),
      trade = nullif(trim(p_trade), ''),
      city = nullif(trim(p_city), ''),
      what_they_do = nullif(trim(p_what_they_do), ''),
      helps_with = nullif(trim(p_helps_with), ''),
      contact_phone = nullif(trim(p_business_phone), ''),
      contact_email = nullif(trim(p_business_email), ''),
      website = nullif(trim(p_website), ''),
      logo_url = nullif(trim(p_logo_url), ''),
      banner_url = nullif(trim(p_banner_url), ''),
      brand_color = coalesce(
        nullif(trim(p_brand_color), ''),
        brand_color
      )
    where id = v_business_id;

  end if;

  return json_build_object(
    'ok', true,
    'member_id', p_member_id,
    'business_id', v_business_id
  );

end;
$$;


revoke all
on function public.admin_update_member(
  uuid,
  text,text,text,text,text,text,text,text,text,
  text,text,text,text,text,text,text,text,text,text,text
)
from public;


grant execute
on function public.admin_update_member(
  uuid,
  text,text,text,text,text,text,text,text,text,
  text,text,text,text,text,text,text,text,text,text,text
)
to authenticated;
