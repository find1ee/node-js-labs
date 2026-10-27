export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export async function delay(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms < 0 || ms > 2_147_483_647) {
    throw new RangeError('ms must be between 0 and 2147483647');
  }

  await new Promise<void>((resolve): void => {
    setTimeout(resolve, ms);
  });
}

export async function fetchUserProfiles(
  userIds: string[],
): Promise<UserProfile[]> {
  const requests: Promise<UserProfile>[] = userIds.map(
    async (id: string): Promise<UserProfile> => {
      const delayMs: number = Math.floor(Math.random() * 101) + 50;
      await delay(delayMs);

      return {
        id,
        name: `User ${id}`,
        email: `user${id}@example.com`,
      };
    },
  );

  return await Promise.all(requests);
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  if (!Number.isInteger(maxRetries) || maxRetries < 1) {
    throw new RangeError('maxRetries must be a positive integer');
  }

  for (let attempt: number = 1; ; attempt++) {
    console.log(`Спроба ${attempt}...`);
    try {
      return await operation();
    } catch (error: unknown) {
      if (attempt === maxRetries) {
        throw error;
      }
      await delay(100);
    }
  }

}

export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
): Promise<R[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError('batchSize must be a positive integer');
  }

  const results: R[] = [];
  const total: number = Math.ceil(items.length / batchSize);

  for (let offset: number = 0; offset < items.length; offset += batchSize) {
    const batchNumber: number = Math.floor(offset / batchSize) + 1;
    const batch: T[] = items.slice(offset, offset + batchSize);
    console.log(`Обробка партії ${batchNumber}/${total}...`);

    const processed: R[] = await processor(batch);
    for (const value of processed) {
      results.push(value);
    }
  }

  return results;
}

export async function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 2_147_483_647) {
    throw new RangeError('timeoutMs must be between 0 and 2147483647');
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout: Promise<never> = new Promise<never>((_resolve, reject): void => {
    timer = setTimeout((): void => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
