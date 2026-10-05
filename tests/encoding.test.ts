import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// UTF-8 text decoded as Windows-1252 and saved again: an em dash turns into "a-circumflex, euro, ...".
const MOJIBAKE = /\u00e2\u20ac|\u00e2\u2020|\u00c3[\u0080-\u00bf]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return name === 'fixtures' ? [] : sourceFiles(file);
    return /\.(ts|tsx|css|html)$/.test(name) ? [file] : [];
  });
}

describe('source encoding', () => {
  it('has no mis-decoded UTF-8 characters', () => {
    const broken = [...sourceFiles('src'), ...sourceFiles('tests')].filter((file) =>
      MOJIBAKE.test(readFileSync(file, 'utf8'))
    );
    expect(broken).toEqual([]);
  });
});
