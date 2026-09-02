export type IngredientInput = { name: string; amount: string; unit: string };
export type StepInput = { text: string; image?: string };

export type Recipe = {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  time: string;
  tags: string[];
  ingredients: IngredientInput[];
  steps: StepInput[];
};

export type RecipeInput = Omit<Recipe, "id" | "image" | "time"> & {
  coverImage: string;
};

export type RecipePage = { recipes: Recipe[]; total: number };

export interface RecipeRepository {
  list(params: { query: string; category: string; page: number }): Promise<RecipePage>;
  create(input: RecipeInput): Promise<void>;
}
