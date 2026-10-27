import { delay, raceWithTimeout } from '../src/async-utils';
import type { Equal } from './types';

describe('raceWithTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('повертає швидкий результат з автоматично виведеним типом', async () => {
    const value = { id: 1, name: 'Anna' };
    const pending = raceWithTimeout(delay(50).then(() => value), 100);
    await jest.advanceTimersByTimeAsync(50);
    const result = await pending;
    const inferred: Equal<typeof result, typeof value> = true;
    expect(inferred).toBe(true);
    expect(result).toBe(value);
    expect(result).toMatchObject({ id: 1 });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('відхиляється з точним повідомленням після перевищення ліміту', async () => {
    const pending = raceWithTimeout(delay(200), 100);
    const assertion = expect(pending).rejects.toThrow(/^Operation timed out after 100ms$/);
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(jest.getTimerCount()).toBe(1);
    await jest.runAllTimersAsync();
  });

  it('передає початкову помилку й очищає таймер', async () => {
    const error = new Error('Network unavailable');
    await expect(raceWithTimeout(Promise.reject(error), 100)).rejects.toBe(error);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('таймаут не скасовує вже запущену операцію', async () => {
    const complete = jest.fn();
    const operation = delay(200).then(complete);
    const assertion = expect(raceWithTimeout(operation, 100)).rejects.toThrow(Error);
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(complete).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(100);
    await operation;
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('приймає нульовий ліміт для вже виконаного Promise', async () => {
    await expect(raceWithTimeout(Promise.resolve('ready'), 0)).resolves.toBe('ready');
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([-1, NaN, Infinity, 2_147_483_648])(
    'відхиляє некоректний ліміт %s',
    async (timeoutMs: number) => {
      await expect(raceWithTimeout(Promise.resolve(1), timeoutMs)).rejects.toThrow(RangeError);
      expect(jest.getTimerCount()).toBe(0);
    },
  );
});
