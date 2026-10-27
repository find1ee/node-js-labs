import { Router } from 'express';
import { createSchema, listQuerySchema, updateSchema } from '../schemas/entity.schema';
import { createEntity, deleteEntity, getEntity, listEntities, updateEntity } from '../storage/entity';
import { HttpError } from '../middleware/error-handler';
import { validate } from '../middleware/validate';

export const entityRouter = Router();

entityRouter.get('/', (req, res) => {
  const filters = listQuerySchema.parse(req.query);
  res.json(listEntities(filters));
});

entityRouter.get('/quick', (_req, res) => {
  res.json(listEntities({ maxMinutes: 30 }));
});

entityRouter.get('/:id', (req, res) => {
  const recipe = getEntity(req.params.id);
  if (recipe === undefined) throw new HttpError(404, 'Рецепт не знайдено');
  res.json(recipe);
});

entityRouter.post('/', validate(createSchema), (req, res) => {
  const recipe = createEntity(req.body);
  res.location(`/api/recipes/${recipe.id}`).status(201).json(recipe);
});

entityRouter.patch('/:id', validate(updateSchema), (req, res) => {
  const recipe = updateEntity(req.params.id as string, req.body);
  if (recipe === undefined) throw new HttpError(404, 'Рецепт не знайдено');
  res.json(recipe);
});

entityRouter.delete('/:id', (req, res) => {
  if (!deleteEntity(req.params.id)) throw new HttpError(404, 'Рецепт не знайдено');
  res.status(204).send();
});
