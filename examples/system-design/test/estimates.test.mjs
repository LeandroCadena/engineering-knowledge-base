import test from 'node:test';
import assert from 'node:assert/strict';
import {
  traffic,
  meanInFlight,
  instanceEstimate,
  retainedBytes,
  queueEstimate,
  independentSeriesAvailability,
  timeBudgetMinutes,
} from '../dist/estimates.js';
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const input = { dailyUsers: 500_000, requestsPerUser: 20, peakMultiplier: 8, writeFraction: 0.1 };
test('traffic keeps daily, second and read/write units consistent', () => {
  const load = traffic(input);
  assert.equal(load.requestsPerDay, 10_000_000);
  near(load.averageRps, 10_000_000 / 86400);
  near(load.peakRps, 80_000_000 / 86400);
  near(load.peakReadsPerSecond + load.peakWritesPerSecond, load.peakRps);
  assert.equal(traffic({ ...input, dailyUsers: 0 }).peakRps, 0);
});
test('mean in-flight uses seconds rather than milliseconds', () => {
  assert.equal(meanInFlight(1000, 120), 120);
  assert.equal(meanInFlight(0, 120), 0);
  assert.equal(meanInFlight(1000, 240), 240);
});
test('instance rounding preserves assumed target capacity after one instance loss', () => {
  const peak = traffic(input).peakRps;
  const estimate = instanceEstimate(peak, 200, 0.65, 1);
  assert.deepEqual(estimate, { required: 8, withInstanceReserve: 9 });
  assert.ok((estimate.withInstanceReserve - 1) * 200 * 0.65 >= peak);
  assert.ok((estimate.required - 1) * 200 * 0.65 < peak);
});
test('retention accounts for steady daily arrivals, overhead and total copies exactly once', () => {
  const base = {
    recordsPerDay: 1_000_000,
    retentionDays: 30,
    bytesPerRecord: 1000,
    overheadFactor: 1.4,
    copies: 3,
  };
  assert.equal(retainedBytes(base), 126_000_000_000);
  assert.equal(retainedBytes({ ...base, copies: 1 }), 42_000_000_000);
  assert.equal(retainedBytes({ ...base, retentionDays: 0 }), 0);
});
test('burst backlog drains using spare capacity after recovery arrivals', () => {
  assert.deepEqual(
    queueEstimate({
      burstArrivalPerSecond: 1000,
      servicePerSecond: 800,
      burstSeconds: 120,
      recoveryArrivalPerSecond: 200,
      initialBacklog: 0,
    }),
    { backlogAfterBurst: 24000, drainSeconds: 40 },
  );
});
test('queue reports no finite drain time when recovery consumes all capacity', () => {
  const input = {
    burstArrivalPerSecond: 10,
    servicePerSecond: 5,
    burstSeconds: 2,
    recoveryArrivalPerSecond: 5,
    initialBacklog: 0,
  };
  assert.equal(queueEstimate(input).drainSeconds, null);
  assert.equal(queueEstimate({ ...input, recoveryArrivalPerSecond: 6 }).drainSeconds, null);
  assert.deepEqual(queueEstimate({ ...input, burstArrivalPerSecond: 0, initialBacklog: 3 }), {
    backlogAfterBurst: 0,
    drainSeconds: 0,
  });
});
test('independent series calculation and time-based budget have explicit domains', () => {
  near(independentSeriesAvailability([0.999, 0.999, 0.999]), 0.997002999);
  near(timeBudgetMinutes(0.999, 30), 43.2);
  assert.equal(independentSeriesAvailability([1, 0]), 0);
  assert.equal(timeBudgetMinutes(1, 30), 0);
});
test('invalid assumptions and unsafe numeric results are rejected', () => {
  for (const value of [NaN, Infinity, -1])
    assert.throws(() => traffic({ ...input, dailyUsers: value }), RangeError);
  assert.throws(() => traffic({ ...input, writeFraction: 1.1 }), RangeError);
  assert.throws(() => instanceEstimate(1, 0, 0.5), RangeError);
  assert.throws(() => instanceEstimate(1, 10, 0), RangeError);
  assert.throws(() => instanceEstimate(1, 10, 0.5, 0.5), RangeError);
  assert.throws(
    () =>
      retainedBytes({
        recordsPerDay: 1,
        retentionDays: 1,
        bytesPerRecord: 1,
        overheadFactor: 1,
        copies: 1.5,
      }),
    RangeError,
  );
  assert.throws(() => independentSeriesAvailability([]), RangeError);
  assert.throws(() => timeBudgetMinutes(1.1, 30), RangeError);
  assert.throws(() => meanInFlight(Number.MAX_VALUE, 1000), RangeError);
});
