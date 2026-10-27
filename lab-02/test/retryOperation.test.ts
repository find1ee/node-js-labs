import { retryOperation } from '../src/async-utils';
import type { Equal } from './types';

describe('retryOperation', () => {
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

  it('повертає результат першої спроби з виведеним типом number', async () => {
    const operation = jest.fn<Promise<number>, []>().mockResolvedValue(42);
    const result = await retryOperation(operation, 3);
    const inferred: Equal<typeof result, number> = true;
    expect(inferred).toBe(true);
    expect(result).toBe(42);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('повторює через 100 мс та зупиняється після успіху', async () => {
    const operation = jest.fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('OK');
    const pending = retryOperation(operation, 5);
    const assertion = expect(pending).resolves.toBe('OK');
    await jest.advanceTimersByTimeAsync(99);
    expect(operation).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(99);
    expect(operation).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    await assertion;
    expect(operation).toHaveBeenCalledTimes(3);
    expect(consoleSpy.mock.calls).toEqual([
      ['Спроба 1...'], ['Спроба 2...'], ['Спроба 3...'],
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('без maxRetries виконує рівно три невдалі спроби', async () => {
    const error = new Error('Unavailable');
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(error);
    const pending = retryOperation(operation);
    const assertion = expect(pending).rejects.toBe(error);
    await jest.runAllTimersAsync();
    await assertion;
    expect(operation).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('після вичерпання спроб передає саме останню помилку', async () => {
    const last = new Error('Last failure');
    const operation = jest.fn<Promise<number>, []>()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(last);
    const pending = retryOperation(operation, 2);
    const assertion = expect(pending).rejects.toBe(last);
    await jest.runAllTimersAsync();
    await assertion;
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('при одній спробі зберігає довільну причину відхилення', async () => {
    const operation = jest.fn<Promise<never>, []>().mockRejectedValue('failed');
    await expect(retryOperation(operation, 1)).rejects.toBe('failed');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([0, -1, 1.5, NaN, Infinity])(
    'відхиляє некоректну кількість спроб %s',
    async (maxRetries: number) => {
      const operation = jest.fn<Promise<number>, []>().mockResolvedValue(1);
      await expect(retryOperation(operation, maxRetries)).rejects.toThrow(RangeError);
      expect(operation).not.toHaveBeenCalled();
    },
  );
});
