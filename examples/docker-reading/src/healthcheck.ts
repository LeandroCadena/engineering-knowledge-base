const port = process.env.PORT ?? '8080';
try {
  const response = await fetch(`http://127.0.0.1:${port}/readyz`, {
    signal: AbortSignal.timeout(1_000),
  });
  if (!response.ok) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
export {};
