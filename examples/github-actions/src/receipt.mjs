import { createHash } from 'node:crypto';
export function receipt(commit, bytes) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected full commit SHA');
  return { commit, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}
export function verify(expectedCommit, metadata, bytes) {
  const actual = receipt(expectedCommit, bytes);
  if (
    metadata.commit !== actual.commit ||
    metadata.sha256 !== actual.sha256 ||
    metadata.bytes !== actual.bytes
  )
    throw new Error('Artifact mismatch');
  return actual;
}
