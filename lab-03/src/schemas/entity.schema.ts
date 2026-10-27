import { z } from 'zod';

export const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  prepMinutes: z.number().int().min(1).max(1440),
  difficulty: z.enum(['easy', 'medium', 'hard'])
});

export const updateSchema = createSchema.partial();

export const listQuerySchema = z.object({
  difficulty: createSchema.shape.difficulty.optional(),
  maxMinutes: z.coerce.number().int().min(1).max(1440).optional()
});

export type RecipeInput = z.infer<typeof createSchema>;
export type RecipeUpdate = z.infer<typeof updateSchema>;
export type RecipeFilters = z.infer<typeof listQuerySchema>;
export type Entity = RecipeInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
