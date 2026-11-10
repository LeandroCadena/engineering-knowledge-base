export async function calculateTotal(unitCents: number, quantity: number): Promise<number> {
  const subtotal = unitCents * quantity;
  await Promise.resolve();
  const fee = quantity > 1 ? 199 : 0;
  const total = subtotal + fee; // BREAKPOINT: inspect subtotal and fee before this assignment
  return total;
}
