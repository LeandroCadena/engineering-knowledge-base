import {
  traffic,
  meanInFlight,
  instanceEstimate,
  retainedBytes,
  queueEstimate,
  independentSeriesAvailability,
  timeBudgetMinutes,
} from './estimates.js';

// All values are teaching assumptions, not measured service capacity or vendor specifications.
const demand = traffic({
  dailyUsers: 500_000,
  requestsPerUser: 20,
  peakMultiplier: 8,
  writeFraction: 0.1,
});
console.log(
  JSON.stringify(
    {
      assumptionsOnly: true,
      demand,
      stableMeanInFlightAtPeakPlateau: meanInFlight(demand.peakRps, 120),
      appInstances: instanceEstimate(demand.peakRps, 200, 0.65, 1),
      retainedGBDecimal:
        retainedBytes({
          recordsPerDay: demand.requestsPerDay * 0.1,
          retentionDays: 30,
          bytesPerRecord: 1000,
          overheadFactor: 1.4,
          copies: 3,
        }) / 1e9,
      queue: queueEstimate({
        burstArrivalPerSecond: 1000,
        servicePerSecond: 800,
        burstSeconds: 120,
        recoveryArrivalPerSecond: 200,
        initialBacklog: 0,
      }),
      independentRequiredPathAvailability: independentSeriesAvailability([0.999, 0.999, 0.999]),
      timeBasedBudgetMinutesIn30Days: timeBudgetMinutes(0.999, 30),
    },
    null,
    2,
  ),
);
