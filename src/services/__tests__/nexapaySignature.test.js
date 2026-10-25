const crypto = require('crypto');
const nexapayService = require('../nexapayService');

/**
 * The NexaPay docs only state that the signature is an HMAC SHA-256 over the
 * raw body plus the timestamp. The exact layout and digest encoding are not
 * published, so several candidates are accepted. These tests pin the
 * behaviour that must hold for every candidate: the correct secret verifies,
 * and any change to the body, the timestamp or the secret does not.
 */

const SECRET = 'whsec_test_secret';
const BODY = Buffer.from(JSON.stringify({ event: 'deposit.received', data: { amount: 50000 } }));

const sign = (secret, timestamp, body, layout) => {
  const payloads = {
    'timestamp.body': Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), body]),
    timestampbody: Buffer.concat([Buffer.from(timestamp, 'utf8'), body]),
    'body.timestamp': Buffer.concat([body, Buffer.from(`.${timestamp}`, 'utf8')]),
    bodytimestamp: Buffer.concat([body, Buffer.from(timestamp, 'utf8')])
  };
  return crypto.createHmac('sha256', secret).update(payloads[layout]).digest('hex');
};

describe('NexaPay webhook signature verification', () => {
  const now = Date.now();
  const timestamp = String(Math.floor(now / 1000));

  test.each(nexapayService.SIGNATURE_LAYOUTS.map((l) => l.name))(
    'accepts a valid hex signature using the %s layout',
    (layout) => {
      const signature = sign(SECRET, timestamp, BODY, layout);
      const result = nexapayService.verifyWebhookSignature(
        BODY,
        { signature, timestamp },
        SECRET
      );
      expect(result.valid).toBe(true);
      expect(result.layout).toBe(layout);
    }
  );

  test('accepts a base64 encoded signature', () => {
    const signature = crypto
      .createHmac('sha256', SECRET)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), BODY]))
      .digest('base64');
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature, timestamp },
      SECRET
    );
    expect(result.valid).toBe(true);
  });

  test('accepts a base64url encoded signature', () => {
    const signature = crypto
      .createHmac('sha256', SECRET)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), BODY]))
      .digest('base64url');
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature, timestamp },
      SECRET
    );
    expect(result.valid).toBe(true);
  });

  test('rejects a signature made with a different secret', () => {
    const signature = sign('other-secret', timestamp, BODY, 'timestamp.body');
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature, timestamp },
      SECRET
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('SIGNATURE_MISMATCH');
  });

  test('rejects a tampered body', () => {
    const signature = sign(SECRET, timestamp, BODY, 'timestamp.body');
    const tampered = Buffer.from(BODY.toString('utf8').replace('50000', '90000'));
    const result = nexapayService.verifyWebhookSignature(
      tampered,
      { signature, timestamp },
      SECRET
    );
    expect(result.valid).toBe(false);
  });

  test('rejects a signature made for a different timestamp', () => {
    const signature = sign(SECRET, String(Math.floor(now / 1000) + 60), BODY, 'timestamp.body');
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature, timestamp },
      SECRET
    );
    expect(result.valid).toBe(false);
  });

  test('rejects a stale timestamp', () => {
    const stale = String(Math.floor((now - 48 * 60 * 60 * 1000) / 1000));
    const signature = sign(SECRET, stale, BODY, 'timestamp.body');
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature, timestamp: stale },
      SECRET
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STALE_TIMESTAMP');
  });

  test('rejects a timestamp far in the future', () => {
    const future = String(Math.floor((now + 48 * 60 * 60 * 1000) / 1000));
    const signature = sign(SECRET, future, BODY, 'timestamp.body');
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature, timestamp: future },
      SECRET
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('STALE_TIMESTAMP');
  });

  test('rejects a missing signature', () => {
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature: undefined, timestamp },
      SECRET
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MISSING_SIGNATURE');
  });

  test('rejects a missing timestamp', () => {
    const signature = sign(SECRET, timestamp, BODY, 'timestamp.body');
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature, timestamp: undefined },
      SECRET
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MISSING_TIMESTAMP');
  });

  test('rejects an empty body', () => {
    const signature = sign(SECRET, timestamp, Buffer.alloc(0), 'timestamp.body');
    const result = nexapayService.verifyWebhookSignature(
      Buffer.alloc(0),
      { signature, timestamp },
      SECRET
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EMPTY_BODY');
  });

  test('rejects a malformed signature', () => {
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature: 'not-a-signature', timestamp },
      SECRET
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MALFORMED_SIGNATURE');
  });

  test('rejects when no secret is configured', () => {
    const signature = sign(SECRET, timestamp, BODY, 'timestamp.body');
    const result = nexapayService.verifyWebhookSignature(
      BODY,
      { signature, timestamp },
      ''
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('NO_SECRET');
  });

  test('parses second, millisecond and ISO timestamps', () => {
    const seconds = String(Math.floor(now / 1000));
    const millis = String(now);
    const iso = new Date(now).toISOString();

    expect(nexapayService.parseTimestampMs(seconds)).toBe(Math.floor(now / 1000) * 1000);
    expect(nexapayService.parseTimestampMs(millis)).toBe(now);
    expect(nexapayService.parseTimestampMs(iso)).toBe(now);
    expect(nexapayService.parseTimestampMs('not-a-timestamp')).toBeNull();
  });

  test('converts between naira and kobo at the provider boundary', () => {
    expect(nexapayService.Naira(500000)).toBe(5000);
    expect(nexapayService.Kobo(5000)).toBe(500000);
  });
});
