import { randomUUID } from 'node:crypto';
import { Entity, RecipeFilters, RecipeInput, RecipeUpdate } from '../schemas/entity.schema';

const recipes = new Map<string, Entity>();

export function listEntities(filters: RecipeFilters = {}): Entity[] {
  return Array.from(recipes.values()).filter((recipe) =>
    (filters.difficulty === undefined || recipe.difficulty === filters.difficulty) &&
    (filters.maxMinutes === undefined || recipe.prepMinutes <= filters.maxMinutes)
  );
}

export function getEntity(id: string): Entity | undefined {
  return recipes.get(id);
}

export function createEntity(input: RecipeInput): Entity {
  const now = new Date().toISOString();
  const recipe: Entity = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  recipes.set(recipe.id, recipe);
  return recipe;
}

export function updateEntity(id: string, input: RecipeUpdate): Entity | undefined {
  const current = recipes.get(id);
  if (current === undefined) return undefined;
  const updated: Entity = { ...current, ...input, updatedAt: new Date().toISOString() };
  recipes.set(id, updated);
  return updated;
}

export function deleteEntity(id: string): boolean {
  return recipes.delete(id);
}

export function resetEntities(): void {
  recipes.clear();
}
