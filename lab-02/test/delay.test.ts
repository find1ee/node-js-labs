import { delay } from '../src/async-utils';

describe('delay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('завершується після заданої затримки, а не раніше', async () => {
    const complete = jest.fn();
    const pending = delay(100).then(complete);
    expect(pending).toBeInstanceOf(Promise);
    await jest.advanceTimersByTimeAsync(99);
    expect(complete).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await pending;
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(undefined);
  });

  it('підтримує нульову затримку', async () => {
    const pending = delay(0);
    await jest.advanceTimersByTimeAsync(0);
    await expect(pending).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([-1, NaN, Infinity, 2_147_483_648])(
    'відхиляє некоректну затримку %s',
    async (ms: number) => {
      await expect(delay(ms)).rejects.toThrow(RangeError);
      expect(jest.getTimerCount()).toBe(0);
    },
  );
});
