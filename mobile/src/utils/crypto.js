/**
 * INGLY SECURITY UTILITIES
 * Legacy generic digest utility. Password/session helpers fail closed.
 * Retained for compatibility; it must not establish authentication,
 * and secure token generation. FIPS 180-4 compliant SHA-256.
 * Zero native dependencies - 100% compatible with React Native, Web, and Node.js.
 */

// Password hashing and custom sessions are retired. Auth belongs to Supabase.

/**
 * Pure JavaScript SHA-256 implementation
 * @param {string} ascii Input string to hash
 * @returns {string} 64-character lowercase hex digest
 */
export function sha256(ascii) {
  if (ascii === null || ascii === undefined) return '';
  const str = String(ascii);

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i;
  let result = '';
  const words = [];
  const utf8 = unescape(encodeURIComponent(str));
  const asciiBitLength = utf8[lengthProperty] * 8;
  const hash = [];
  const k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  for (i = 0; i < utf8[lengthProperty]; i++) {
    words[i >> 2] |= utf8.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (let i = 0; i < words[lengthProperty]; i += 16) {
    const w = words.slice(i, i + 16);
    for (let k = 0; k < 16; k++) {
      if (w[k] === undefined) w[k] = 0;
    }
    const oldHash = hash.slice(0, 8);

    for (let j = 0; j < 64; j++) {
      if (j >= 16) {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Hashes a plaintext password using SHA-256 with a security salt prefix
 * @param {string} password Plain text password
 * @param {string} [customSalt] Optional custom salt
 * @returns {string} 64-character hex hash
 */
export function hashPassword() { throw new Error('Legacy password authentication disabled; use Supabase Auth.'); }

/**
 * Verifies a plaintext password against a stored hash (or legacy plaintext during migration)
 * @param {string} plainPassword User input
 * @param {string} storedHash Stored password hash (or legacy plaintext)
 * @param {string} [customSalt] Optional salt prefix
 * @returns {boolean} True if password matches
 */
export function verifyPassword() { return false; }

/**
 * Generates a cryptographically random session token (hex)
 * @param {number} length Byte length
 * @returns {string} Hex token
 */
export function generateSecureToken() { throw new Error('Custom sessions disabled; use Supabase Auth.'); }
