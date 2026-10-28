const { SecretBox } = require('../secretBox');

describe('SecretBox', () => {
  const key = Buffer.alloc(32, 9);
  const box = new SecretBox(key);

  test('round-trips a secret', () => {
    const encrypted = box.encrypt('nexapay-live-secret');
    expect(encrypted).not.toContain('nexapay-live-secret');
    expect(box.decrypt(encrypted)).toBe('nexapay-live-secret');
  });

  test('produces a different ciphertext every time', () => {
    const a = box.encrypt('same-secret');
    const b = box.encrypt('same-secret');
    expect(a).not.toBe(b);
    expect(box.decrypt(a)).toBe(box.decrypt(b));
  });

  test('detects tampering with the ciphertext', () => {
    const encrypted = box.encrypt('nexapay-live-secret');
    const [iv, tag, payload] = encrypted.split('.');

    const bytes = Buffer.from(payload, 'base64');
    bytes[0] = bytes[0] ^ 0xff;

    const tampered = [iv, tag, bytes.toString('base64')].join('.');
    expect(() => box.decrypt(tampered)).toThrow();
  });

  test('detects tampering with the auth tag', () => {
    const encrypted = box.encrypt('nexapay-live-secret');
    const [iv, tag, payload] = encrypted.split('.');

    const bytes = Buffer.from(tag, 'base64');
    bytes[0] = bytes[0] ^ 0xff;

    const tampered = [iv, bytes.toString('base64'), payload].join('.');
    expect(() => box.decrypt(tampered)).toThrow();
  });

  test('cannot be decrypted with a different key', () => {
    const other = new SecretBox(Buffer.alloc(32, 1));
    const encrypted = box.encrypt('nexapay-live-secret');
    expect(() => other.decrypt(encrypted)).toThrow();
  });

  test('rejects a key that is not 32 bytes', () => {
    expect(() => new SecretBox(Buffer.alloc(16))).toThrow(/32 bytes/);
    expect(() => new SecretBox(Buffer.alloc(64))).toThrow(/32 bytes/);
  });

  test('accepts a base64 encoded key', () => {
    const encoded = Buffer.alloc(32, 3).toString('base64');
    const fromBase64 = new SecretBox(encoded);
    expect(fromBase64.decrypt(fromBase64.encrypt('secret'))).toBe('secret');
  });

  test('rejects malformed payloads', () => {
    expect(() => box.decrypt('not-a-payload')).toThrow(/Malformed/);
    expect(() => box.decrypt('a.b')).toThrow(/Malformed/);
    expect(() => box.decrypt(null)).toThrow(/Malformed/);
  });

  test('rejects an empty secret', () => {
    expect(() => box.encrypt('')).toThrow();
  });
});
