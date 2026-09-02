import { describe, expect, it, vi } from "vitest";
import { RecipeRepositoryError, SupabaseRecipeRepository } from "./supabase-repository";

describe("SupabaseRecipeRepository", () => {
  it("combines search, category and range parameters", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } } }) },
      rpc,
    };
    const repository = new SupabaseRecipeRepository(client as never);
    await expect(repository.list({ query: " 鶏肉 ", category: "主菜", page: 2 })).resolves.toEqual({ recipes: [], total: 0 });
    expect(rpc).toHaveBeenCalledWith("search_recipes", { search_term: "鶏肉", category_filter: "主菜", page_offset: 9, page_limit: 9 });
  });

  it("diagnoses disabled anonymous sign-in", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInAnonymously: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "Anonymous sign-ins are disabled" } }),
      },
    };
    const repository = new SupabaseRecipeRepository(client as never);
    await expect(repository.list({ query: "", category: "すべて", page: 1 })).rejects.toMatchObject<Partial<RecipeRepositoryError>>({ code: "anonymous-auth-disabled" });
  });

  it("diagnoses a missing search RPC", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202", message: "function was not found" } }),
    };
    const repository = new SupabaseRecipeRepository(client as never);
    await expect(repository.list({ query: "", category: "すべて", page: 1 })).rejects.toMatchObject<Partial<RecipeRepositoryError>>({ code: "migration-missing" });
  });
});
