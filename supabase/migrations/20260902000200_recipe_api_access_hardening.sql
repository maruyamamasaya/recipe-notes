-- Forward-only hardening for projects where the persistence migration is already applied.
-- Anonymous users first sign in with Supabase Auth and therefore use the authenticated role.
begin;

do $$
declare
  missing text[] := array[]::text[];
  relation_name text;
begin
  foreach relation_name in array array['recipes', 'ingredients', 'recipe_ingredients', 'recipe_steps', 'tags', 'recipe_tags'] loop
    if to_regclass('public.' || relation_name) is null then
      missing := array_append(missing, 'public.' || relation_name);
    end if;
  end loop;
  if to_regprocedure('public.create_recipe(jsonb)') is null then missing := array_append(missing, 'public.create_recipe(jsonb)'); end if;
  if to_regprocedure('public.search_recipes(text,text,integer,integer)') is null then missing := array_append(missing, 'public.search_recipes(text,text,integer,integer)'); end if;
  if not exists (select 1 from storage.buckets where id = 'recipe-images') then missing := array_append(missing, 'storage bucket recipe-images'); end if;

  if cardinality(missing) > 0 then
    raise exception 'Recipe persistence prerequisites are missing: %. Apply 20260902000100_recipe_persistence.sql first.', array_to_string(missing, ', ');
  end if;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.recipes, public.recipe_ingredients, public.recipe_steps, public.recipe_tags to authenticated;
grant select, insert on public.ingredients, public.tags to authenticated;
grant execute on function public.create_recipe(jsonb), public.search_recipes(text, text, integer, integer) to authenticated;

commit;
