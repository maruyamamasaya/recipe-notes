export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      create_recipe: { Args: { payload: Json }; Returns: string };
      search_recipes: {
        Args: { search_term: string; category_filter: string; page_offset: number; page_limit: number };
        Returns: Array<{
          id: string; title: string; description: string; category: string; image_path: string;
          created_at: string; tags: string[]; ingredient_names: string[]; total_count: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
