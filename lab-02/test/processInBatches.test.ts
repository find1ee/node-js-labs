import { delay, processInBatches } from '../src/async-utils';
import type { Equal } from './types';

describe('processInBatches', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('виводить тип string[] при перетворенні number у string', async () => {
    const processor = jest.fn<Promise<string[]>, [number[]]>(
      async batch => batch.map(value => `item-${value}`),
    );
    const result = await processInBatches([1, 2, 3], 2, processor);
    const inferred: Equal<typeof result, string[]> = true;
    expect(inferred).toBe(true);
    expect(result).toEqual(['item-1', 'item-2', 'item-3']);
    expect(processor).toHaveBeenNthCalledWith(1, [1, 2]);
    expect(processor).toHaveBeenLastCalledWith([3]);
  });

  it('обробляє всі партії послідовно та не змінює вхідний масив', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    let active = 0;
    let maxActive = 0;
    const processor = jest.fn<Promise<number[]>, [number[]]>(async batch => {
      maxActive = Math.max(maxActive, ++active);
      await delay(100);
      active--;
      return batch.map(value => value * 2);
    });
    const pending = processInBatches(items, 3, processor);
    expect(processor).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(99);
    expect(processor).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(processor).toHaveBeenCalledTimes(2);
    await jest.runAllTimersAsync();
    await expect(pending).resolves.toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(processor).toHaveBeenCalledTimes(3);
    expect(processor).toHaveBeenLastCalledWith([7, 8]);
    expect(maxActive).toBe(1);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(consoleSpy.mock.calls).toEqual([
      ['Обробка партії 1/3...'],
      ['Обробка партії 2/3...'],
      ['Обробка партії 3/3...'],
    ]);
  });

  it('не викликає processor для порожнього масиву', async () => {
    const processor = jest.fn<Promise<number[]>, [number[]]>();
    await expect(processInBatches([], 2, processor)).resolves.toEqual([]);
    expect(processor).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('підтримує партію більшу за масив і об’єкти на вході', async () => {
    const items = [{ name: 'Anna' }, { name: 'Ivan' }];
    const result = await processInBatches(items, 10, async batch =>
      batch.map(item => item.name),
    );
    expect(result).toEqual(['Anna', 'Ivan']);
    expect(result).toContain('Ivan');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it('підтримує порожній результат processor', async () => {
    const processor = jest.fn<Promise<string[]>, [number[]]>().mockResolvedValue([]);
    await expect(processInBatches([1, 2], 1, processor)).resolves.toEqual([]);
    expect(processor).toHaveBeenCalledTimes(2);
  });

  it('після помилки зупиняє наступні партії', async () => {
    const error = new Error('Batch failed');
    const processor = jest.fn<Promise<number[]>, [number[]]>()
      .mockResolvedValueOnce([10])
      .mockRejectedValueOnce(error);
    await expect(processInBatches([1, 2, 3], 1, processor)).rejects.toBe(error);
    expect(processor).toHaveBeenCalledTimes(2);
    expect(processor).not.toHaveBeenCalledWith([3]);
  });

  it.each([0, -1, 1.5, NaN, Infinity])(
    'відхиляє некоректний розмір партії %s',
    async (batchSize: number) => {
      const processor = jest.fn<Promise<number[]>, [number[]]>();
      await expect(processInBatches([1], batchSize, processor)).rejects.toThrow(RangeError);
      expect(processor).not.toHaveBeenCalled();
    },
  );
});
