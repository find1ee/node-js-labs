import test from 'node:test';
import assert from 'node:assert/strict';
import { delay, fetchUserProfiles, retryOperation, processInBatches, raceWithTimeout } from '../dist/async-utils.js';

test('delay повертає Promise і не завершується синхронно', async () => {
  let finished = false;
  const pending = delay(20).then(() => { finished = true; });
  assert.ok(pending instanceof Promise);
  assert.equal(finished, false);
  assert.equal(await pending, undefined);
  assert.equal(finished, true);
});

test('delay приймає нуль', async () => {
  assert.equal(await delay(0), undefined);
});

test('delay відхиляє від’ємні, нескінченні та завеликі значення', async () => {
  for (const value of [-1, NaN, Infinity, 2147483648]) {
    await assert.rejects(delay(value), RangeError);
  }
});

test('профілі мають потрібні поля та зберігають порядок id', async () => {
  const profiles = await fetchUserProfiles(['3', '1', '2']);
  assert.deepEqual(profiles, [
    { id: '3', name: 'User 3', email: 'user3@example.com' },
    { id: '1', name: 'User 1', email: 'user1@example.com' },
    { id: '2', name: 'User 2', email: 'user2@example.com' },
  ]);
});

test('порожній список id повертає порожній масив', async () => {
  assert.deepEqual(await fetchUserProfiles([]), []);
});

test('усі запити стартують до завершення першого, затримки 50–150 мс', async (t) => {
  const scheduled = [];
  const callbacks = [];
  t.mock.method(globalThis, 'setTimeout', (callback, ms) => {
    scheduled.push(ms);
    callbacks.push(callback);
    return {};
  });
  const pending = fetchUserProfiles(['1', '2', '3', '4']);
  assert.equal(callbacks.length, 4);
  assert.ok(scheduled.every(ms => Number.isInteger(ms) && ms >= 50 && ms <= 150));
  callbacks.reverse().forEach(callback => callback());
  assert.deepEqual((await pending).map(profile => profile.id), ['1', '2', '3', '4']);
});

test('retry зупиняється після першого успіху', async () => {
  let calls = 0;
  const result = await retryOperation(async () => { calls++; return 42; }, 3);
  assert.equal(result, 42);
  assert.equal(calls, 1);
});

test('retry за замовчуванням дозволяє три спроби', async () => {
  let calls = 0;
  const result = await retryOperation(async () => {
    if (++calls < 3) throw new Error('temporary');
    return 'OK';
  });
  assert.equal(result, 'OK');
  assert.equal(calls, 3);
});

test('retry повертає саме останню помилку після вичерпання спроб', async () => {
  const errors = [new Error('first'), new Error('last')];
  let calls = 0;
  await assert.rejects(retryOperation(async () => { throw errors[calls++]; }, 2), error => error === errors[1]);
  assert.equal(calls, 2);
});

test('retry робить лише паузи 100 мс між спробами', async (t) => {
  const waits = [];
  t.mock.method(globalThis, 'setTimeout', (callback, ms) => {
    waits.push(ms);
    queueMicrotask(callback);
    return {};
  });
  await assert.rejects(retryOperation(async () => { throw new Error('fail'); }, 3));
  assert.deepEqual(waits, [100, 100]);
});

test('retry відхиляє некоректну кількість спроб до виклику операції', async () => {
  let calls = 0;
  for (const count of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(retryOperation(async () => { calls++; }, count), RangeError);
  }
  assert.equal(calls, 0);
});

test('партії послідовні, включають першу й останню неповну', async () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const batches = [];
  let active = 0;
  let maxActive = 0;
  const result = await processInBatches(input, 3, async batch => {
    batches.push([...batch]);
    maxActive = Math.max(maxActive, ++active);
    await delay(5);
    active--;
    return batch.map(n => n * 2);
  });
  assert.deepEqual(batches, [[1, 2, 3], [4, 5, 6], [7, 8]]);
  assert.deepEqual(result, [2, 4, 6, 8, 10, 12, 14, 16]);
  assert.equal(maxActive, 1);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('порожній масив не викликає processor', async () => {
  let calls = 0;
  assert.deepEqual(await processInBatches([], 3, async batch => { calls++; return batch; }), []);
  assert.equal(calls, 0);
});

test('розмір партії більший за масив створює одну партію', async () => {
  assert.deepEqual(await processInBatches([1, 2], 10, async b => b.map(n => n + 1)), [2, 3]);
});

test('некоректний batchSize відхиляється', async () => {
  for (const size of [0, -1, 1.5, NaN, Infinity]) {
    await assert.rejects(processInBatches([1], size, async b => b), RangeError);
  }
});

test('помилка processor припиняє обробку наступних партій', async () => {
  const expected = new Error('processor failed');
  let calls = 0;
  await assert.rejects(processInBatches([1, 2, 3], 1, async batch => {
    if (++calls === 2) throw expected;
    return batch;
  }), error => error === expected);
  assert.equal(calls, 2);
});

test('raceWithTimeout повертає швидкий результат', async () => {
  assert.equal(await raceWithTimeout(delay(10).then(() => 'done'), 200), 'done');
});

test('raceWithTimeout повертає точний текст помилки таймауту', async () => {
  const slow = delay(60);
  await assert.rejects(raceWithTimeout(slow, 10), { message: 'Operation timed out after 10ms' });
  await slow;
});

test('raceWithTimeout передає початкову помилку операції', async () => {
  const original = new Error('network failed');
  await assert.rejects(raceWithTimeout(Promise.reject(original), 200), error => error === original);
});

test('raceWithTimeout очищає таймер після швидкого завершення', async (t) => {
  const spy = t.mock.method(globalThis, 'clearTimeout');
  assert.equal(await raceWithTimeout(Promise.resolve(7), 1000), 7);
  assert.equal(spy.mock.callCount(), 1);
});

test('таймаут припиняє очікування, але не скасовує операцію', async () => {
  let completed = false;
  const operation = delay(40).then(() => { completed = true; });
  await assert.rejects(raceWithTimeout(operation, 5));
  assert.equal(completed, false);
  await operation;
  assert.equal(completed, true);
});

test('некоректний timeoutMs відхиляється', async () => {
  for (const value of [-1, NaN, Infinity, 2147483648]) {
    await assert.rejects(raceWithTimeout(Promise.resolve('OK'), value), RangeError);
  }
});
