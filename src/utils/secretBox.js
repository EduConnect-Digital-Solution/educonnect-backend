const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * AES-256-GCM envelope for per-tenant gateway secrets at rest.
 *
 * Payload format: base64(iv) + '.' + base64(authTag) + '.' + base64(ciphertext)
 * The GCM auth tag makes tampering detectable: decryption throws if the
 * ciphertext, tag or key do not match.
 */
class SecretBox {
  constructor(key) {
    const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key || '', 'base64');
    if (buffer.length !== KEY_LENGTH) {
      throw new Error('SECRETS_ENC_KEY must decode to exactly 32 bytes (base64)');
    }
    this.key = buffer;
  }

  encrypt(plain) {
    if (typeof plain !== 'string' || plain.length === 0) {
      throw new Error('Cannot encrypt an empty secret');
    }
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
  }

  decrypt(payload) {
    if (typeof payload !== 'string') {
      throw new Error('Malformed encrypted secret');
    }
    const parts = payload.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted secret');
    }
    const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, 'base64'));
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      throw new Error('Malformed encrypted secret');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    // decipher.final() throws when the auth tag does not match - that is the
    // tamper detection we rely on.
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}

module.exports = { SecretBox, SECRET_BOX_KEY_LENGTH: KEY_LENGTH };
