import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Recipe, RecipeInput, RecipeRepository } from "./types";

const PAGE_SIZE = 9;

export type RecipeRepositoryErrorCode =
  | "configuration"
  | "anonymous-auth-disabled"
  | "migration-missing"
  | "permission-denied"
  | "connection";

export class RecipeRepositoryError extends Error {
  constructor(public readonly code: RecipeRepositoryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RecipeRepositoryError";
  }
}

function repositoryError(error: unknown, operation: "auth" | "rpc") {
  const value = error as { code?: string; message?: string; status?: number } | null;
  const message = value?.message?.toLowerCase() ?? "";
  if (operation === "auth" && (message.includes("anonymous") || message.includes("provider is not enabled"))) {
    return new RecipeRepositoryError("anonymous-auth-disabled", "Anonymous Sign-In が無効です。", { cause: error });
  }
  if (value?.code === "PGRST202" || value?.code === "42883" || message.includes("search_recipes")) {
    return new RecipeRepositoryError("migration-missing", "必要なデータベース構成が見つかりません。", { cause: error });
  }
  if (value?.code === "42501" || value?.status === 401 || value?.status === 403 || message.includes("permission denied")) {
    return new RecipeRepositoryError("permission-denied", "データベースのアクセス設定が不足しています。", { cause: error });
  }
  return new RecipeRepositoryError("connection", "Supabase との通信に失敗しました。", { cause: error });
}

function dataUrlToBlob(value: string) {
  const [header, body] = value.split(",");
  const type = /data:(.*?);base64/.exec(header)?.[1] ?? "image/jpeg";
  const bytes = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type });
}

type RecipeRecord = {
  id: string; title: string; description: string; category: string; image_path: string;
  created_at: string; tags: string[];
  ingredients: Array<{ name: string; amount: string | number; unit: string }>;
  steps: Array<{ description: string; image_path: string | null }>;
};

export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private async ensureUser() {
    const { data: { user }, error: getUserError } = await this.client.auth.getUser();
    if (user) return user;
    if (getUserError && !["AuthSessionMissingError", "session_not_found"].includes(getUserError.name ?? getUserError.code ?? "")) {
      throw repositoryError(getUserError, "auth");
    }
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.user) throw repositoryError(error, "auth");
    return data.user;
  }

  async list({ query, category, page }: { query: string; category: string; page: number }) {
    await this.ensureUser();
    const { data, error } = await this.client.rpc("search_recipes", {
      search_term: query.trim(), category_filter: category === "すべて" ? "" : category,
      page_offset: (page - 1) * PAGE_SIZE, page_limit: PAGE_SIZE,
    });
    if (error) throw repositoryError(error, "rpc");
    const rows = data ?? [];
    const recipes: Recipe[] = await Promise.all(rows.map(async (row) => ({
      id: row.id, title: row.title, description: row.description, category: row.category,
      image: (await this.client.storage.from("recipe-images").createSignedUrl(row.image_path, 3600)).data?.signedUrl ?? "",
      time: new Intl.DateTimeFormat("ja-JP", { dateStyle: "short" }).format(new Date(row.created_at)),
      tags: row.tags ?? [], ingredients: (row.ingredient_names ?? []).map((name) => ({ name, amount: "", unit: "" })), steps: [],
    })));
    return { recipes, total: rows[0]?.total_count ?? 0 };
  }

  async get(id: string) {
    await this.ensureUser();
    const { data, error } = await this.client.rpc("get_recipe", { recipe_id: id });
    if (error) throw repositoryError(error, "rpc");
    if (!data) throw new RecipeRepositoryError("connection", "レシピが見つかりません。");
    const row = data as RecipeRecord;
    const sign = async (path: string | null) => path
      ? (await this.client.storage.from("recipe-images").createSignedUrl(path, 3600)).data?.signedUrl ?? ""
      : "";
    return {
      id: row.id, title: row.title, description: row.description, category: row.category,
      image: await sign(row.image_path), imagePath: row.image_path,
      time: new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date(row.created_at)),
      tags: row.tags ?? [],
      ingredients: (row.ingredients ?? []).map((item) => ({ ...item, amount: String(item.amount) })),
      steps: await Promise.all((row.steps ?? []).map(async (step) => ({
        text: step.description, image: await sign(step.image_path), imagePath: step.image_path ?? undefined,
      }))),
    };
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


  async update(id: string, input: RecipeInput) {
    const user = await this.ensureUser();
    const uploadedPaths: string[] = [];
    const upload = async (path: string, image: string) => {
      const { error } = await this.client.storage.from("recipe-images").upload(path, dataUrlToBlob(image), { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error("画像をアップロードできませんでした。");
      uploadedPaths.push(path);
      return path;
    };
    try {
      const base = `${user.id}/recipes/${id}`;
      const coverPath = input.coverImage.startsWith("data:")
        ? await upload(`${base}/cover-${crypto.randomUUID()}.jpg`, input.coverImage)
        : input.imagePath;
      if (!coverPath) throw new Error("完成写真が見つかりません。");
      const steps = [];
      for (const step of input.steps) {
        const imagePath = step.image?.startsWith("data:")
          ? await upload(`${base}/steps/${crypto.randomUUID()}.jpg`, step.image)
          : step.imagePath ?? null;
        steps.push({ description: step.text, image_path: imagePath });
      }
      const payload: Json = { title: input.title, description: input.description, category: input.category,
        image_path: coverPath, servings: 1, ingredients: input.ingredients, steps, tags: input.tags };
      const { data: obsoletePaths, error } = await this.client.rpc("update_recipe", { recipe_id: id, payload });
      if (error) throw repositoryError(error, "rpc");
      const oldPaths = Array.isArray(obsoletePaths) ? obsoletePaths.filter((path): path is string => typeof path === "string") : [];
      if (oldPaths.length) await this.client.storage.from("recipe-images").remove(oldPaths);
    } catch (error) {
      if (uploadedPaths.length) await this.client.storage.from("recipe-images").remove(uploadedPaths);
      throw error;
    }
  }

  async delete(id: string) {
    await this.ensureUser();
    const { data, error } = await this.client.rpc("delete_recipe", { recipe_id: id });
    if (error) throw repositoryError(error, "rpc");
    if (data?.length) await this.client.storage.from("recipe-images").remove(data);
  }
}

export function createRecipeRepository() {
  try {
    return new SupabaseRecipeRepository(getSupabaseBrowserClient());
  } catch (error) {
    throw new RecipeRepositoryError("configuration", "Supabase の接続情報が設定されていません。", { cause: error });
  }
}
