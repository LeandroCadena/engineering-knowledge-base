const base = process.env.API_URL ?? 'http://api:8080';
for (const path of ['/healthz', '/readyz', '/identity']) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const body = await response.json();
  if (path === '/identity' && body.uid !== 1000) {
    throw new Error('Expected Node image user UID 1000');
  }
  console.log(JSON.stringify({ path, body }));
}
export {};
