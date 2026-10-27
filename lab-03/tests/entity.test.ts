import request from 'supertest';
import { app } from '../src/app';
import { resetEntities } from '../src/storage/entity';

const base = '/api/recipes';
const omelette = { title: 'Омлет', description: 'Швидкий сніданок', prepMinutes: 12, difficulty: 'easy' };
const soup = { title: 'Суп', prepMinutes: 45, difficulty: 'medium' };
const roast = { title: 'Печеня', prepMinutes: 90, difficulty: 'hard' };

beforeEach(() => resetEntities());

async function addRecipe(recipe: object) {
  return request(app).post(base).send(recipe);
}

describe('POST /api/recipes', () => {
  test('створює рецепт зі статусом 201, UUID, датами та Location', async () => {
    const response = await addRecipe(omelette);
    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.headers.location).toBe(`${base}/${response.body.id}`);
    expect(response.body).toMatchObject(omelette);
    expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(new Date(response.body.createdAt).toISOString()).toBe(response.body.createdAt);
    expect(response.body.updatedAt).toBe(response.body.createdAt);
  });

  test('приймає рецепт без необов’язкового опису', async () => {
    const response = await addRecipe(soup);
    expect(response.status).toBe(201);
    expect(response.body.description).toBeUndefined();
  });

  test('відхиляє порожню назву', async () => {
    const response = await addRecipe({ ...omelette, title: '' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'VALIDATION_ERROR' });
    expect(response.body.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'title' })]));
  });

  test('відхиляє назву понад 100 символів', async () => {
    const response = await addRecipe({ ...omelette, title: 'а'.repeat(101) });
    expect(response.status).toBe(400);
  });

  test('приймає граничну назву зі 100 символів', async () => {
    const response = await addRecipe({ ...omelette, title: 'а'.repeat(100) });
    expect(response.status).toBe(201);
  });

  test('відхиляє опис понад 500 символів', async () => {
    const response = await addRecipe({ ...omelette, description: 'а'.repeat(501) });
    expect(response.status).toBe(400);
  });

  test('відхиляє відсутній час приготування', async () => {
    const { prepMinutes: _omitted, ...recipe } = omelette;
    const response = await addRecipe(recipe);
    expect(response.status).toBe(400);
  });

  test('відхиляє дробовий час приготування', async () => {
    const response = await addRecipe({ ...omelette, prepMinutes: 12.5 });
    expect(response.status).toBe(400);
  });

  test('відхиляє недопустиму складність', async () => {
    const response = await addRecipe({ ...omelette, difficulty: 'extreme' });
    expect(response.status).toBe(400);
  });

  test('відхиляє некоректний JSON', async () => {
    const response = await request(app).post(base).set('Content-Type', 'application/json').send('{broken');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_JSON');
  });
});

describe('GET /api/recipes', () => {
  test('повертає порожній список на початку тесту', async () => {
    const response = await request(app).get(base);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('повертає всі створені рецепти', async () => {
    await addRecipe(omelette);
    await addRecipe(soup);
    const response = await request(app).get(base);
    expect(response.status).toBe(200);
    expect(response.body.map((recipe: { title: string }) => recipe.title)).toEqual(['Омлет', 'Суп']);
  });

  test('фільтрує за складністю', async () => {
    await addRecipe(omelette);
    await addRecipe(soup);
    const response = await request(app).get(base).query({ difficulty: 'easy' });
    expect(response.status).toBe(200);
    expect(response.body.map((recipe: { title: string }) => recipe.title)).toEqual(['Омлет']);
  });

  test('фільтрує за максимальним часом включно з межею', async () => {
    await addRecipe(omelette);
    await addRecipe(soup);
    const response = await request(app).get(base).query({ maxMinutes: 12 });
    expect(response.status).toBe(200);
    expect(response.body.map((recipe: { title: string }) => recipe.title)).toEqual(['Омлет']);
  });

  test('комбінує обидва фільтри', async () => {
    await addRecipe(omelette);
    await addRecipe({ ...soup, difficulty: 'easy' });
    await addRecipe(roast);
    const response = await request(app).get(base).query({ difficulty: 'easy', maxMinutes: 20 });
    expect(response.status).toBe(200);
    expect(response.body.map((recipe: { title: string }) => recipe.title)).toEqual(['Омлет']);
  });

  test('повертає порожній масив, якщо фільтри не дали збігів', async () => {
    await addRecipe(omelette);
    const response = await request(app).get(base).query({ difficulty: 'hard', maxMinutes: 5 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test('відхиляє некоректну складність у query', async () => {
    const response = await request(app).get(base).query({ difficulty: 'extreme' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  test('відхиляє недодатний час у query', async () => {
    const response = await request(app).get(base).query({ maxMinutes: 0 });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/recipes/quick', () => {
  test('повертає лише рецепти до 30 хвилин', async () => {
    await addRecipe(omelette);
    await addRecipe({ ...soup, prepMinutes: 30 });
    await addRecipe(roast);
    const response = await request(app).get(`${base}/quick`);
    expect(response.status).toBe(200);
    expect(response.body.map((recipe: { title: string }) => recipe.title)).toEqual(['Омлет', 'Суп']);
  });

  test('повертає порожній список без швидких рецептів', async () => {
    await addRecipe(roast);
    const response = await request(app).get(`${base}/quick`);
    expect(response.body).toEqual([]);
  });
});

describe('GET /api/recipes/:id', () => {
  test('повертає створений рецепт', async () => {
    const created = await addRecipe(omelette);
    const response = await request(app).get(`${base}/${created.body.id}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(created.body);
  });

  test('повертає 404 для відсутнього id', async () => {
    const response = await request(app).get(`${base}/absent`);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('HTTP_ERROR');
  });
});

describe('PATCH /api/recipes/:id', () => {
  test('змінює лише передані поля', async () => {
    const created = await addRecipe(omelette);
    const response = await request(app).patch(`${base}/${created.body.id}`).send({ title: 'Омлет із сиром', prepMinutes: 15 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ title: 'Омлет із сиром', prepMinutes: 15, difficulty: 'easy', description: omelette.description });
    expect(response.body.createdAt).toBe(created.body.createdAt);
    expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.body.updatedAt).getTime());
  });

  test('повертає 404 для відсутнього id', async () => {
    const response = await request(app).patch(`${base}/absent`).send({ title: 'Інший' });
    expect(response.status).toBe(404);
  });

  test('відхиляє невалідний час та не змінює запис', async () => {
    const created = await addRecipe(omelette);
    const response = await request(app).patch(`${base}/${created.body.id}`).send({ prepMinutes: -1 });
    expect(response.status).toBe(400);
    const unchanged = await request(app).get(`${base}/${created.body.id}`);
    expect(unchanged.body.prepMinutes).toBe(12);
  });
});

describe('DELETE /api/recipes/:id', () => {
  test('видаляє запис зі статусом 204 і порожнім тілом', async () => {
    const created = await addRecipe(omelette);
    const response = await request(app).delete(`${base}/${created.body.id}`);
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    const absent = await request(app).get(`${base}/${created.body.id}`);
    expect(absent.status).toBe(404);
  });

  test('повертає 404 при повторному видаленні', async () => {
    const created = await addRecipe(omelette);
    await request(app).delete(`${base}/${created.body.id}`);
    const response = await request(app).delete(`${base}/${created.body.id}`);
    expect(response.status).toBe(404);
  });
});

describe('налаштування застосунку', () => {
  test('повертає 404 для невідомого маршруту', async () => {
    const response = await request(app).get('/api/unknown');
    expect(response.status).toBe(404);
  });

  test('відповідає на CORS preflight', async () => {
    const response = await request(app).options(base).set('Origin', 'http://example.com').set('Access-Control-Request-Method', 'POST');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });
});
