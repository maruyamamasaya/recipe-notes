# Database

## ER / tables

```text
auth.users 1--N recipes 1--N recipe_ingredients N--1 ingredients
                         1--N recipe_steps
                         1--N recipe_tags N--1 tags
```

`recipes` はUUID PK、owner FK、title/description/category/image_path/servings/timestampsを持つ。`ingredients` と `tags` はtrim/lowerしたgenerated列をUNIQUEにして重複を抑止する。`recipe_ingredients` は `numeric(12,3)` amount、自由追加可能なunit、sort_order、`recipe_steps` はpositive step_numberと任意image_pathを持つ。recipe削除時はingredients/steps/tags関連をCASCADEし、masterはRESTRICTで保持する。

owner+created、owner+category+created、各非先頭FKにindexを持つ。`search_recipes` はRLS下の `security invoker` でtitle/description/ingredient/tagを `ILIKE` / `EXISTS` 検索し、category、offset、9件limit、総件数を同時処理する。増加時のみpg_trgm / FTSを検討する。

## RLS / grants

全public tableでRLSを有効化する。`anon` にtable/function権限はなく、`authenticated` のrecipeと子行操作は `auth.uid()` がownerの場合だけ許可する。共有ingredient/tag masterのみauthenticated read/insertを許可する。無条件anonymous policy、service role、`SECURITY DEFINER`はない。

## Storage / consistency

private bucketは `recipe-images`（JPEG、500KiB上限）。pathは `{auth.uid()}/recipes/{recipe-id}/cover.jpg` と `.../steps/{uuid}.jpg` で、先頭folderが本人の場合だけselect/insert/update/deleteできる。UIはsigned URLを使う。Storageを先にuploadし、`create_recipe(jsonb)` の単一DB transactionで全関連行を保存する。DB失敗時は今回のobjectを削除する。cleanupも失敗した孤児は将来の定期照合対象である。

## Migration

`supabase/migrations/20260902000100_recipe_persistence.sql` はSQL Editorからもtransactionとして適用できる。適用前backup、適用後Security / Performance Advisor、owner/non-ownerおよびStorage policy確認を行う。破壊的rollbackよりforward-fixを優先する。
