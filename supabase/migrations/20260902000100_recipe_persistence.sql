begin;

create extension if not exists pgcrypto;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 2000),
  category text not null check (length(btrim(category)) between 1 and 50),
  image_path text not null check (image_path <> ''),
  servings integer not null default 1 check (servings > 0 and servings <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  normalized_name text generated always as (lower(btrim(name))) stored,
  created_at timestamptz not null default now(),
  unique (normalized_name)
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  amount numeric(12,3) not null check (amount >= 0),
  unit text not null check (length(btrim(unit)) between 1 and 30),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (recipe_id, sort_order)
);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  description text not null check (length(btrim(description)) between 1 and 4000),
  image_path text,
  created_at timestamptz not null default now(),
  unique (recipe_id, step_number)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 50),
  normalized_name text generated always as (lower(btrim(name))) stored,
  created_at timestamptz not null default now(),
  unique (normalized_name)
);

create table public.recipe_tags (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  primary key (recipe_id, tag_id)
);

create index recipes_user_created_idx on public.recipes (user_id, created_at desc);
create index recipes_user_category_created_idx on public.recipes (user_id, category, created_at desc);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id);
create index recipe_steps_recipe_idx on public.recipe_steps (recipe_id);
create index recipe_tags_tag_idx on public.recipe_tags (tag_id);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger recipes_set_updated_at before update on public.recipes
for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.tags enable row level security;
alter table public.recipe_tags enable row level security;

create policy recipes_owner_all on public.recipes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ingredients_authenticated_read on public.ingredients for select to authenticated using (true);
create policy ingredients_authenticated_insert on public.ingredients for insert to authenticated with check (true);
create policy tags_authenticated_read on public.tags for select to authenticated using (true);
create policy tags_authenticated_insert on public.tags for insert to authenticated with check (true);
create policy recipe_ingredients_owner_all on public.recipe_ingredients for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));
create policy recipe_steps_owner_all on public.recipe_steps for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));
create policy recipe_tags_owner_all on public.recipe_tags for all to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on public.recipes, public.recipe_ingredients, public.recipe_steps, public.recipe_tags to authenticated;
grant select, insert on public.ingredients, public.tags to authenticated;

create function public.create_recipe(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  recipe_uuid uuid := coalesce((payload->>'id')::uuid, gen_random_uuid());
  item jsonb;
  master_id uuid;
  position integer := 0;
begin
  if jsonb_typeof(payload->'ingredients') <> 'array' or jsonb_array_length(payload->'ingredients') < 1
     or jsonb_typeof(payload->'steps') <> 'array' or jsonb_array_length(payload->'steps') < 1 then
    raise exception 'ingredients and steps are required';
  end if;
  insert into public.recipes (id, user_id, title, description, category, image_path, servings)
  values (recipe_uuid, auth.uid(), payload->>'title', coalesce(payload->>'description', ''),
    payload->>'category', payload->>'image_path', coalesce((payload->>'servings')::integer, 1));

  for item in select value from jsonb_array_elements(payload->'ingredients') loop
    insert into public.ingredients (name) values (btrim(item->>'name')) on conflict (normalized_name) do nothing;
    select id into master_id from public.ingredients where normalized_name = lower(btrim(item->>'name'));
    insert into public.recipe_ingredients (recipe_id, ingredient_id, amount, unit, sort_order)
      values (recipe_uuid, master_id, (item->>'amount')::numeric, item->>'unit', position);
    position := position + 1;
  end loop;
  position := 1;
  for item in select value from jsonb_array_elements(payload->'steps') loop
    insert into public.recipe_steps (recipe_id, step_number, description, image_path)
      values (recipe_uuid, position, item->>'description', nullif(item->>'image_path', ''));
    position := position + 1;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(payload->'tags', '[]'::jsonb)) loop
    insert into public.tags (name) values (btrim(item #>> '{}')) on conflict (normalized_name) do nothing;
    select id into master_id from public.tags where normalized_name = lower(btrim(item #>> '{}'));
    insert into public.recipe_tags (recipe_id, tag_id) values (recipe_uuid, master_id) on conflict do nothing;
  end loop;
  return recipe_uuid;
end;
$$;

create function public.search_recipes(search_term text default '', category_filter text default '', page_offset integer default 0, page_limit integer default 9)
returns table (id uuid, title text, description text, category text, image_path text, created_at timestamptz, tags text[], ingredient_names text[], total_count bigint)
language sql stable security invoker set search_path = '' as $$
  with matching as (
    select r.*
    from public.recipes r
    where (category_filter = '' or r.category = category_filter)
      and (btrim(search_term) = '' or r.title ilike '%' || search_term || '%'
        or r.description ilike '%' || search_term || '%'
        or exists (select 1 from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id where ri.recipe_id = r.id and i.name ilike '%' || search_term || '%')
        or exists (select 1 from public.recipe_tags rt join public.tags t on t.id = rt.tag_id where rt.recipe_id = r.id and t.name ilike '%' || search_term || '%'))
  )
  select m.id, m.title, m.description, m.category, m.image_path, m.created_at,
    coalesce((select array_agg(t.name order by t.name) from public.recipe_tags rt join public.tags t on t.id = rt.tag_id where rt.recipe_id = m.id), '{}'::text[]),
    coalesce((select array_agg(i.name order by ri.sort_order) from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id where ri.recipe_id = m.id), '{}'::text[]),
    count(*) over ()
  from matching m order by m.created_at desc offset greatest(page_offset, 0) limit least(greatest(page_limit, 1), 50);
$$;

revoke all on function public.create_recipe(jsonb) from public, anon;
revoke all on function public.search_recipes(text, text, integer, integer) from public, anon;
grant execute on function public.create_recipe(jsonb), public.search_recipes(text, text, integer, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', false, 524288, array['image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy recipe_images_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recipe_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recipe_images_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recipe_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
