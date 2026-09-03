export type IngredientInput = { name: string; amount: string; unit: string };
export type StepInput = { text: string; image?: string; imagePath?: string };

export type Recipe = {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  imagePath?: string;
  time: string;
  tags: string[];
  ingredients: IngredientInput[];
  steps: StepInput[];
};

export type RecipeInput = Omit<Recipe, "id" | "image" | "time"> & {
  coverImage: string;
  imagePath?: string;
};

export type RecipePage = { recipes: Recipe[]; total: number };

export interface RecipeRepository {
  list(params: { query: string; category: string; page: number }): Promise<RecipePage>;
  get(id: string): Promise<Recipe>;
  create(input: RecipeInput): Promise<void>;
  update(id: string, input: RecipeInput): Promise<void>;
  delete(id: string): Promise<void>;
}
