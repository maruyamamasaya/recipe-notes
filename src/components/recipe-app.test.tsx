import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeApp } from "./recipe-app";

describe("RecipeApp", () => {
  it("filters recipes by ingredient", () => {
    render(<RecipeApp />);
    fireEvent.change(screen.getByPlaceholderText("料理名、材料、タグから検索"), { target: { value: "サーモン" } });
    expect(screen.getByText("サーモンのハーブグリル")).toBeInTheDocument();
    expect(screen.queryByText("ふわふわパンケーキ")).not.toBeInTheDocument();
  });

  it("adds and removes recipe step fields", () => {
    render(<RecipeApp />);
    fireEvent.click(screen.getByRole("button", { name: /新しいレシピ/ }));
    fireEvent.click(screen.getByRole("button", { name: "＋ 工程を追加" }));
    expect(screen.getAllByPlaceholderText("工程を入力してください")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "工程2を削除" }));
    expect(screen.getAllByPlaceholderText("工程を入力してください")).toHaveLength(1);
  });
});
