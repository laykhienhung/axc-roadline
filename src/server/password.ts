import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

const CURRENT: ScryptParams = { N, r: R, p: P };

function scryptWithOptions(
  password: string,
  salt: Buffer,
  params: ScryptParams,
  callback: (error: Error | null, derivedKey: Buffer) => void
): void {
  // maxmem must cover 128·N·r bytes; leave headroom for raised cost parameters.
  const maxmem = 256 * params.N * params.r;
  scrypt(password, salt, KEY_LENGTH, { ...params, maxmem }, callback);
}

const scryptAsync = promisify(scryptWithOptions);

function encodePart(value: Buffer): string {
  return value.toString('base64');
}

function decodePart(value: string, length: number): Buffer | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === length && encodePart(decoded) === value ? decoded : null;
}

/** Cost parameters stored in a hash, bounded so a crafted hash can't trigger a huge scrypt run. */
function parseParams(n: string, r: string, p: string): ScryptParams | null {
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  const powerOfTwo =
    Number.isInteger(params.N) && params.N >= 2 && (params.N & (params.N - 1)) === 0;
  if (!powerOfTwo || params.N > 1 << 20) return null;
  if (!Number.isInteger(params.r) || params.r < 1 || params.r > 32) return null;
  if (!Number.isInteger(params.p) || params.p < 1 || params.p > 16) return null;
  return params;
}

async function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return scryptAsync(password, salt, params);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await derive(password, salt, CURRENT);
  return `scrypt$${N}$${R}$${P}$${encodePart(salt)}$${encodePart(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const params = parseParams(parts[1], parts[2], parts[3]);
    const salt = decodePart(parts[4], SALT_LENGTH);
    const expected = decodePart(parts[5], KEY_LENGTH);
    if (!params || !salt || !expected) return false;
    const actual = await derive(password, salt, params);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Used for unknown accounts so sign-in takes the same scrypt path as a wrong password.
export const DUMMY_HASH = await hashPassword('roadline-dummy-password');
