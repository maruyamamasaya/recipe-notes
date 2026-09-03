begin;

create function public.get_recipe(recipe_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'title', r.title, 'description', r.description, 'category', r.category,
    'image_path', r.image_path, 'created_at', r.created_at,
    'tags', coalesce((select jsonb_agg(t.name order by t.name) from public.recipe_tags rt join public.tags t on t.id = rt.tag_id where rt.recipe_id = r.id), '[]'::jsonb),
    'ingredients', coalesce((select jsonb_agg(jsonb_build_object('name', i.name, 'amount', ri.amount, 'unit', ri.unit) order by ri.sort_order) from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id where ri.recipe_id = r.id), '[]'::jsonb),
    'steps', coalesce((select jsonb_agg(jsonb_build_object('description', rs.description, 'image_path', rs.image_path) order by rs.step_number) from public.recipe_steps rs where rs.recipe_id = r.id), '[]'::jsonb)
  ) from public.recipes r where r.id = $1;
$$;

create function public.update_recipe(recipe_id uuid, payload jsonb) returns text[]
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; master_id uuid; position integer := 0; old_paths text[]; new_paths text[];
begin
  if jsonb_typeof(payload->'ingredients') <> 'array' or jsonb_array_length(payload->'ingredients') < 1
     or jsonb_typeof(payload->'steps') <> 'array' or jsonb_array_length(payload->'steps') < 1 then
    raise exception 'ingredients and steps are required';
  end if;
  select array_remove(array_prepend(r.image_path, array_agg(rs.image_path)), null)
    into old_paths from public.recipes r left join public.recipe_steps rs on rs.recipe_id = r.id
    where r.id = $1 group by r.image_path;
  update public.recipes set title = payload->>'title', description = coalesce(payload->>'description', ''),
    category = payload->>'category', image_path = payload->>'image_path' where id = $1;
  if not found then raise exception 'recipe not found'; end if;
  delete from public.recipe_ingredients where recipe_ingredients.recipe_id = $1;
  delete from public.recipe_steps where recipe_steps.recipe_id = $1;
  delete from public.recipe_tags where recipe_tags.recipe_id = $1;
  for item in select value from jsonb_array_elements(payload->'ingredients') loop
    insert into public.ingredients (name) values (btrim(item->>'name')) on conflict (normalized_name) do nothing;
    select id into master_id from public.ingredients where normalized_name = lower(btrim(item->>'name'));
    insert into public.recipe_ingredients (recipe_id, ingredient_id, amount, unit, sort_order)
      values ($1, master_id, (item->>'amount')::numeric, item->>'unit', position); position := position + 1;
  end loop;
  position := 1;
  for item in select value from jsonb_array_elements(payload->'steps') loop
    insert into public.recipe_steps (recipe_id, step_number, description, image_path)
      values ($1, position, item->>'description', nullif(item->>'image_path', '')); position := position + 1;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(payload->'tags', '[]'::jsonb)) loop
    insert into public.tags (name) values (btrim(item #>> '{}')) on conflict (normalized_name) do nothing;
    select id into master_id from public.tags where normalized_name = lower(btrim(item #>> '{}'));
    insert into public.recipe_tags (recipe_id, tag_id) values ($1, master_id) on conflict do nothing;
  end loop;
  select array_remove(array_prepend(payload->>'image_path', array_agg(value->>'image_path')), null)
    into new_paths from jsonb_array_elements(payload->'steps');
  return array(select unnest(coalesce(old_paths, '{}')) except select unnest(coalesce(new_paths, '{}')));
end;
$$;

create function public.delete_recipe(recipe_id uuid) returns text[]
language plpgsql security invoker set search_path = '' as $$
declare paths text[];
begin
  select array_remove(array_prepend(r.image_path, array_agg(rs.image_path)), null) into paths
    from public.recipes r left join public.recipe_steps rs on rs.recipe_id = r.id
    where r.id = $1 group by r.image_path;
  delete from public.recipes where id = $1;
  if not found then raise exception 'recipe not found'; end if;
  return coalesce(paths, '{}');
end;
$$;

revoke all on function public.get_recipe(uuid), public.update_recipe(uuid, jsonb), public.delete_recipe(uuid) from public, anon;
grant execute on function public.get_recipe(uuid), public.update_recipe(uuid, jsonb), public.delete_recipe(uuid) to authenticated;

commit;
