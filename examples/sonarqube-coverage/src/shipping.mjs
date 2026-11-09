export function shippingCents(totalCents, expedited) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new RangeError('Invalid total');
  if (expedited) return 1500;
  if (totalCents >= 5000) return 0;
  return 500;
}
