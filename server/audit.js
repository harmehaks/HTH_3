import { createHash } from 'node:crypto';
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export const auditHash = (body) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(body)))
    .digest('hex');
export function verifyAudit(events) {
  let previous = 'genesis',
    sequence = 0;
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    const { hash, ...body } = event;
    if (
      body.sequence !== sequence + 1 ||
      body.previousHash !== previous ||
      auditHash(body) !== hash
    )
      return false;
    previous = hash;
    sequence = body.sequence;
  }
  return true;
}
