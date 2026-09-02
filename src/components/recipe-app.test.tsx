import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeApp } from "./recipe-app";
import type { RecipeRepository } from "@/lib/recipes/types";

const recipes = [
  { id: "1", title: "サーモンのハーブグリル", description: "香草焼き", category: "主菜", image: "", time: "今日", tags: ["洋食"], ingredients: [{ name: "サーモン", amount: "2", unit: "枚" }], steps: [] },
  { id: "2", title: "ふわふわパンケーキ", description: "朝食", category: "朝ごはん", image: "", time: "今日", tags: ["おやつ"], ingredients: [{ name: "小麦粉", amount: "100", unit: "g" }], steps: [] },
];
const repository: RecipeRepository = {
  list: vi.fn(async ({ query, category, page }: { query: string; category: string; page: number }) => {
    const filtered = recipes.filter((recipe) => [recipe.title, recipe.description, ...recipe.tags, ...recipe.ingredients.map((item) => item.name)].join(" ").includes(query) && (category === "すべて" || recipe.category === category));
    return { recipes: filtered.slice((page - 1) * 9, page * 9), total: filtered.length };
  }),
  create: vi.fn(async () => undefined),
};

describe("RecipeApp", () => {
  it("filters recipes by ingredient", async () => {
    render(<RecipeApp repository={repository} />);
    fireEvent.change(screen.getByPlaceholderText("料理名、材料、タグから検索"), { target: { value: "サーモン" } });
    expect(await screen.findByText("サーモンのハーブグリル")).toBeInTheDocument();
    expect(screen.queryByText("ふわふわパンケーキ")).not.toBeInTheDocument();
  });

  it("adds and removes recipe step fields", () => {
    render(<RecipeApp repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: /新しいレシピ/ }));
    fireEvent.click(screen.getByRole("button", { name: "＋ 工程を追加" }));
    expect(screen.getAllByPlaceholderText("工程を入力してください")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "工程2を削除" }));
    expect(screen.getAllByPlaceholderText("工程を入力してください")).toHaveLength(1);
  });

  it("keeps the hidden cover input optional and explains why save is disabled", () => {
    render(<RecipeApp repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: /新しいレシピ/ }));
    expect(screen.getByText("完成写真を選択してください。")).toBeInTheDocument();
    expect(document.querySelector('.upload input[type="file"]')).not.toBeRequired();
    expect(screen.getByRole("button", { name: /レシピを保存する/ })).toBeDisabled();
  });

  it("retries only the recipe list after a load failure", async () => {
    const list = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ recipes: [], total: 0 });
    render(<RecipeApp repository={{ list, create: vi.fn() }} />);
    fireEvent.click(await screen.findByRole("button", { name: "再読み込み" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
