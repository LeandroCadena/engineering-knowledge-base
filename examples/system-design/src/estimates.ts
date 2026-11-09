function finite(name: string, value: number, min = 0): void {
  if (!Number.isFinite(value) || value < min)
    throw new RangeError(`${name} must be finite and >= ${min}`);
}
function fraction(name: string, value: number): void {
  finite(name, value);
  if (value > 1) throw new RangeError(`${name} must be <= 1`);
}
function result(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Estimate exceeds safe numeric range');
  }
  return value;
}
export function traffic(input: {
  dailyUsers: number;
  requestsPerUser: number;
  peakMultiplier: number;
  writeFraction: number;
}) {
  finite('dailyUsers', input.dailyUsers);
  finite('requestsPerUser', input.requestsPerUser);
  finite('peakMultiplier', input.peakMultiplier, 1);
  fraction('writeFraction', input.writeFraction);
  const requestsPerDay = result(input.dailyUsers * input.requestsPerUser);
  const averageRps = requestsPerDay / 86400;
  const peakRps = result(averageRps * input.peakMultiplier);
  return {
    requestsPerDay,
    averageRps,
    peakRps,
    peakWritesPerSecond: peakRps * input.writeFraction,
    peakReadsPerSecond: peakRps * (1 - input.writeFraction),
  };
}
// Little's Law uses means within the same stable boundary and time interval.
export function meanInFlight(throughputPerSecond: number, meanLatencyMs: number) {
  finite('throughputPerSecond', throughputPerSecond);
  finite('meanLatencyMs', meanLatencyMs);
  return result(throughputPerSecond * (meanLatencyMs / 1000));
}
export function instanceEstimate(
  peakRps: number,
  benchmarkRps: number,
  targetFraction: number,
  toleratedInstanceLosses = 1,
) {
  finite('peakRps', peakRps);
  finite('benchmarkRps', benchmarkRps, Number.MIN_VALUE);
  fraction('targetFraction', targetFraction);
  if (targetFraction === 0) throw new RangeError('targetFraction must be > 0');
  if (!Number.isSafeInteger(toleratedInstanceLosses) || toleratedInstanceLosses < 0)
    throw new RangeError('Invalid loss count');
  const required = result(Math.ceil(peakRps / (benchmarkRps * targetFraction)));
  return { required, withInstanceReserve: result(required + toleratedInstanceLosses) };
}
export function retainedBytes(input: {
  recordsPerDay: number;
  retentionDays: number;
  bytesPerRecord: number;
  overheadFactor: number;
  copies: number;
}) {
  finite('recordsPerDay', input.recordsPerDay);
  finite('retentionDays', input.retentionDays);
  finite('bytesPerRecord', input.bytesPerRecord);
  finite('overheadFactor', input.overheadFactor, 1);
  if (!Number.isSafeInteger(input.copies) || input.copies < 1)
    throw new RangeError('copies must be a positive integer');
  return result(
    input.recordsPerDay *
      input.retentionDays *
      input.bytesPerRecord *
      input.overheadFactor *
      input.copies,
  );
}
export function queueEstimate(input: {
  burstArrivalPerSecond: number;
  servicePerSecond: number;
  burstSeconds: number;
  recoveryArrivalPerSecond: number;
  initialBacklog: number;
}) {
  for (const [name, value] of Object.entries(input)) finite(name, value);
  const backlogAfterBurst = result(
    Math.max(
      0,
      input.initialBacklog +
        (input.burstArrivalPerSecond - input.servicePerSecond) * input.burstSeconds,
    ),
  );
  const spare = input.servicePerSecond - input.recoveryArrivalPerSecond;
  return {
    backlogAfterBurst,
    drainSeconds:
      backlogAfterBurst === 0 ? 0 : spare > 0 ? result(backlogAfterBurst / spare) : null,
  };
}
// Independent required dependencies only; optional fallbacks and correlated failures are excluded.
export function independentSeriesAvailability(components: number[]) {
  if (components.length === 0) throw new RangeError('Supply at least one component');
  for (const value of components) fraction('availability', value);
  return components.reduce((total, value) => total * value, 1);
}
export function timeBudgetMinutes(availability: number, windowDays: number) {
  fraction('availability', availability);
  finite('windowDays', windowDays);
  return result((1 - availability) * windowDays * 24 * 60);
}
