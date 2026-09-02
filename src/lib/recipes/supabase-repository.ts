import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Recipe, RecipeInput, RecipeRepository } from "./types";

const PAGE_SIZE = 9;

function dataUrlToBlob(value: string) {
  const [header, body] = value.split(",");
  const type = /data:(.*?);base64/.exec(header)?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type });
}

export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private async ensureUser() {
    const { data: { user } } = await this.client.auth.getUser();
    if (user) return user;
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.user) throw new Error("利用者セッションを開始できませんでした。");
    return data.user;
  }

  async list({ query, category, page }: { query: string; category: string; page: number }) {
    await this.ensureUser();
    const { data, error } = await this.client.rpc("search_recipes", {
      search_term: query.trim(), category_filter: category === "すべて" ? "" : category,
      page_offset: (page - 1) * PAGE_SIZE, page_limit: PAGE_SIZE,
    });
    if (error) throw new Error("レシピを読み込めませんでした。");
    const rows = data ?? [];
    const recipes: Recipe[] = await Promise.all(rows.map(async (row) => ({
      id: row.id, title: row.title, description: row.description, category: row.category,
      image: (await this.client.storage.from("recipe-images").createSignedUrl(row.image_path, 3600)).data?.signedUrl ?? "",
      time: new Intl.DateTimeFormat("ja-JP", { dateStyle: "short" }).format(new Date(row.created_at)),
      tags: row.tags ?? [], ingredients: (row.ingredient_names ?? []).map((name) => ({ name, amount: "", unit: "" })), steps: [],
    })));
    return { recipes, total: rows[0]?.total_count ?? 0 };
  }

  async create(input: RecipeInput) {
    const user = await this.ensureUser();
    const recipeId = crypto.randomUUID();
    const uploadedPaths: string[] = [];
    const upload = async (path: string, image: string) => {
      const { error } = await this.client.storage.from("recipe-images").upload(path, dataUrlToBlob(image), { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error("画像をアップロードできませんでした。");
      uploadedPaths.push(path);
    };
    const base = `${user.id}/recipes/${recipeId}`;
    try {
      const coverPath = `${base}/cover.jpg`;
      await upload(coverPath, input.coverImage);
      const steps = [];
      for (let index = 0; index < input.steps.length; index += 1) {
        const step = input.steps[index];
        const imagePath = step.image ? `${base}/steps/${crypto.randomUUID()}.jpg` : null;
        if (imagePath && step.image) await upload(imagePath, step.image);
        steps.push({ description: step.text, image_path: imagePath });
      }
      const payload: Json = {
        id: recipeId, title: input.title, description: input.description, category: input.category,
        image_path: coverPath, servings: 1, ingredients: input.ingredients,
        steps, tags: input.tags,
      };
      const { error } = await this.client.rpc("create_recipe", { payload });
      if (error) throw new Error("レシピを保存できませんでした。");
    } catch (error) {
      if (uploadedPaths.length) await this.client.storage.from("recipe-images").remove(uploadedPaths);
      throw error;
    }
  }
}

export function createRecipeRepository() {
  return new SupabaseRecipeRepository(getSupabaseBrowserClient());
}
