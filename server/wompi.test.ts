import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eventChecksum, integritySignature, transactionPaysFor, verifyEventChecksum, wompiApiBase } from './wompi';

// Worked example from Wompi's own docs (widget-checkout-web → firma de
// integridad): reference "sk8-438k4-xmxm392-sn2m", 2490000 COP, secret
// "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6".
const DOC = {
  reference: 'sk8-438k4-xmxm392-sn2m',
  amountInCents: 2490000,
  currency: 'COP',
  secret: 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
  signature: '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5',
};

describe('integritySignature', () => {
  it('matches the example in the Wompi docs', () => {
    expect(integritySignature(DOC.reference, DOC.amountInCents, DOC.currency, DOC.secret)).toBe(DOC.signature);
  });

  it('changes if the amount changes by one cent', () => {
    expect(integritySignature(DOC.reference, DOC.amountInCents - 1, DOC.currency, DOC.secret)).not.toBe(DOC.signature);
  });
});

describe('transactionPaysFor', () => {
  const expected = { reference: 'ecx_abc', amountInCents: 3990000, currency: 'COP' };
  const approved = { id: 't1', status: 'APPROVED', reference: 'ecx_abc', amount_in_cents: 3990000, currency: 'COP' };

  it('accepts the exact approved transaction', () => {
    expect(transactionPaysFor(approved, expected)).toBe(true);
  });

  it('rejects a pending, declined or missing transaction', () => {
    expect(transactionPaysFor({ ...approved, status: 'PENDING' }, expected)).toBe(false);
    expect(transactionPaysFor({ ...approved, status: 'DECLINED' }, expected)).toBe(false);
    expect(transactionPaysFor(null, expected)).toBe(false);
  });

  it('rejects a cheaper transaction, another reference or another currency', () => {
    expect(transactionPaysFor({ ...approved, amount_in_cents: 100 }, expected)).toBe(false);
    expect(transactionPaysFor({ ...approved, reference: 'ecx_other' }, expected)).toBe(false);
    expect(transactionPaysFor({ ...approved, currency: 'USD' }, expected)).toBe(false);
  });
});

describe('event checksum', () => {
  const secret = 'test_events_secret';
  const event = {
    event: 'transaction.updated',
    data: { transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 3990000, reference: 'ecx_abc', currency: 'COP' } },
    timestamp: 1530291411,
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum: '',
    },
  };
  // What Wompi documents: the listed properties, concatenated, then the
  // timestamp, then the secret.
  const expected = createHash('sha256').update(`1234-1610641025-49201APPROVED3990000${1530291411}${secret}`).digest('hex');

  it('concatenates the listed properties in order, then timestamp, then secret', () => {
    expect(eventChecksum(event, secret)).toBe(expected);
  });

  it('verifies case-insensitively and rejects a tampered event', () => {
    expect(verifyEventChecksum({ ...event, signature: { ...event.signature, checksum: expected.toUpperCase() } }, secret)).toBe(true);
    const tampered = { ...event, data: { transaction: { ...event.data.transaction, amount_in_cents: 1 } }, signature: { ...event.signature, checksum: expected } };
    expect(verifyEventChecksum(tampered, secret)).toBe(false);
    expect(verifyEventChecksum({ ...event, signature: { ...event.signature, checksum: 'nope' } }, secret)).toBe(false);
  });
});

describe('wompiApiBase', () => {
  it('points at sandbox unless told production', () => {
    expect(wompiApiBase('sandbox')).toContain('sandbox.wompi.co');
    expect(wompiApiBase('production')).toContain('production.wompi.co');
  });
});
