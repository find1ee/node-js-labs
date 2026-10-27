import { fetchUserProfiles, type UserProfile } from '../src/async-utils';

describe('fetchUserProfiles', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('повертає профілі з правильними полями', async () => {
    const pending = fetchUserProfiles(['2', '5']);
    await jest.runAllTimersAsync();
    const profiles: UserProfile[] = await pending;
    expect(profiles).toHaveLength(2);
    expect(profiles).toEqual([
      { id: '2', name: 'User 2', email: 'user2@example.com' },
      { id: '5', name: 'User 5', email: 'user5@example.com' },
    ]);
    expect(profiles[0]).toHaveProperty('email', 'user2@example.com');
  });

  it('повертає порожній масив без таймерів', async () => {
    await expect(fetchUserProfiles([])).resolves.toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('стартує паралельно і зберігає порядок за різних затримок', async () => {
    jest.spyOn(Math, 'random')
      .mockReturnValueOnce(0.999999)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5);
    const timerSpy = jest.spyOn(globalThis, 'setTimeout');
    const complete = jest.fn();
    const pending = fetchUserProfiles(['9', '2', '4']);
    void pending.then(complete);
    expect(timerSpy).toHaveBeenCalledTimes(3);
    expect(timerSpy.mock.calls.map(call => call[1])).toEqual([150, 50, 100]);
    await jest.advanceTimersByTimeAsync(149);
    expect(complete).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    const profiles = await pending;
    expect(profiles.map(profile => profile.id)).toEqual(['9', '2', '4']);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('зберігає повторювані ідентифікатори', async () => {
    const pending = fetchUserProfiles(['3', '3']);
    await jest.runAllTimersAsync();
    const profiles = await pending;
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toEqual(profiles[1]);
  });
});
