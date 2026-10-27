import {
  delay, fetchUserProfiles, retryOperation, processInBatches,
  raceWithTimeout, type UserProfile,
} from './async-utils.js';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function demoDelay(): Promise<void> {
  console.log('=== DELAY: затримка без блокування ===');
  const start: number = performance.now();
  const pending: Promise<void> = delay(100);
  console.log('delay(100) викликано; цей рядок з’явився до завершення очікування.');
  await pending;
  console.log(`Готово. Фактичне очікування: ${(performance.now() - start).toFixed(1)} мс`);
  await delay(0);
  console.log('delay(0): успішно.');
  try {
    await delay(-1);
  } catch (error: unknown) {
    console.log('Захист від від’ємної затримки:', message(error));
  }
}

async function demoProfiles(): Promise<void> {
  console.log('=== PROFILES: паралельне завантаження ===');
  const ids: string[] = ['1', '2', '3', '4', '5'];
  const start: number = performance.now();
  const profiles: UserProfile[] = await fetchUserProfiles(ids);
  const elapsed: number = performance.now() - start;
  for (const profile of profiles) {
    console.log(`${profile.id} | ${profile.name} | ${profile.email}`);
  }
  console.log(`Завантажено ${profiles.length} профілів за ${elapsed.toFixed(1)} мс.`);
  console.log('Порожній список:', JSON.stringify(await fetchUserProfiles([])));
  console.log('Порядок id:', profiles.map((profile: UserProfile): string => profile.id).join(', '));
}

async function demoRetry(): Promise<void> {
  console.log('=== RETRY: успіх на третій спробі ===');
  let attempts: number = 0;
  const start: number = performance.now();
  const result: unknown = await retryOperation(async (): Promise<string> => {
    attempts++;
    if (attempts < 3) {
      console.log(`Тимчасова помилка ${attempts}; перед повтором чекаємо 100 мс.`);
      throw new Error(`Тимчасова помилка ${attempts}`);
    }
    return 'Успіх!';
  });
  console.log('Результат:', result);
  console.log(`Кількість спроб: ${attempts}. Час: ${(performance.now() - start).toFixed(1)} мс.`);
  console.log('\n=== RETRY: усі спроби невдалі ===');
  let failures: number = 0;
  try {
    await retryOperation(async (): Promise<never> => {
      failures++;
      throw new Error(`Помилка ${failures}`);
    }, 2);
  } catch (error: unknown) {
    console.log('Отримано останню помилку:', message(error));
    console.log(`Виконано рівно ${failures} спроби.`);
  }
}

async function demoBatches(): Promise<void> {
  console.log('=== BATCHES: послідовна обробка ===');
  const items: number[] = [1, 2, 3, 4, 5, 6, 7, 8];
  console.log('Вхід:', JSON.stringify(items), '| batchSize = 3');
  let active: number = 0;
  let maxActive: number = 0;
  const start: number = performance.now();
  const results: number[] = await processInBatches(
    items, 3,
    async (batch: number[]): Promise<number[]> => {
      active++;
      maxActive = Math.max(maxActive, active);
      console.log('  Початок:', JSON.stringify(batch));
      await delay(100);
      const output: number[] = batch.map((n: number): number => n * 2);
      console.log('  Завершення:', JSON.stringify(output));
      active--;
      return output;
    },
  );
  console.log('Результат:', JSON.stringify(results));
  console.log(`Максимум одночасно активних партій: ${maxActive}`);
  console.log(`Час обробки: ${(performance.now() - start).toFixed(1)} мс`);
  console.log('Початковий масив:', JSON.stringify(items));
  const empty: number[] = await processInBatches([], 3, async (b: number[]): Promise<number[]> => b);
  console.log('Порожній масив:', JSON.stringify(empty));
}

async function demoTimeout(): Promise<void> {
  console.log('=== TIMEOUT: швидка операція ===');
  const fast: Promise<string> = delay(50).then((): string => 'Готово');
  console.log('Затримка 50 мс, ліміт 100 мс:', await raceWithTimeout(fast, 100));
  console.log('\n=== TIMEOUT: перевищення ліміту ===');
  const slow: Promise<string> = delay(200).then((): string => {
    console.log('Повільна операція завершилась пізніше: race її не скасовує.');
    return 'Готово';
  });
  const start: number = performance.now();
  try {
    await raceWithTimeout(slow, 100);
  } catch (error: unknown) {
    console.log('Перехоплено:', message(error));
    console.log(`Час очікування: ${(performance.now() - start).toFixed(1)} мс`);
  }
  await slow;
  console.log('\n=== TIMEOUT: початкова помилка операції ===');
  try {
    await raceWithTimeout(Promise.reject(new Error('Сервер недоступний')), 100);
  } catch (error: unknown) {
    console.log('Перехоплено:', message(error));
  }
}

async function demoValidation(): Promise<void> {
  console.log('=== ДОДАТКОВІ ПЕРЕВІРКИ ВХІДНИХ ДАНИХ ===');
  try {
    await retryOperation(async (): Promise<string> => 'OK', 0);
  } catch (error: unknown) {
    console.log('maxRetries = 0:', message(error));
  }
  try {
    await processInBatches([1, 2], 0, async (b: number[]): Promise<number[]> => b);
  } catch (error: unknown) {
    console.log('batchSize = 0:', message(error));
  }
  try {
    await raceWithTimeout(Promise.resolve('OK'), -1);
  } catch (error: unknown) {
    console.log('timeoutMs = -1:', message(error));
  }
  let calls: number = 0;
  try {
    await processInBatches([1, 2, 3], 1, async (batch: number[]): Promise<number[]> => {
      calls++;
      if (calls === 2) throw new Error('Збій другої партії');
      return batch;
    });
  } catch (error: unknown) {
    console.log('Помилка processor:', message(error));
    console.log(`Викликів processor: ${calls}; третя партія не стартувала.`);
  }
}

async function main(): Promise<void> {
  const demos: Record<string, () => Promise<void>> = {
    delay: demoDelay, profiles: demoProfiles, retry: demoRetry,
    batches: demoBatches, timeout: demoTimeout, validation: demoValidation,
  };
  const selected: string = process.argv[2] ?? 'all';
  if (selected === 'all') {
    for (const demo of Object.values(demos)) {
      await demo();
      console.log('');
    }
  } else {
    const demo: (() => Promise<void>) | undefined = demos[selected];
    if (demo === undefined) {
      throw new Error(`Невідомий сценарій: ${selected}. Доступні: ${Object.keys(demos).join(', ')}, all`);
    }
    await demo();
  }
}

main().catch((error: unknown): void => {
  console.error('Непередбачена помилка:', message(error));
  process.exitCode = 1;
});
