import type { Sender } from './contracts.js';
export type Metric = { outcome: 'accepted' | 'recipient_unavailable' | 'failed' };
export function observedSender(inner: Sender, record: (metric: Metric) => void): Sender {
  const report = (metric: Metric) => {
    // Best-effort metrics: failure must not turn accepted work into a rejected send.
    try {
      record(metric);
    } catch {
      /* Production telemetry needs its own health signal. */
    }
  };
  return {
    async send(message) {
      let result;
      try {
        result = await inner.send(message);
      } catch (error) {
        report({ outcome: 'failed' });
        throw error;
      }
      report({ outcome: result.kind });
      return result;
    },
  };
}
