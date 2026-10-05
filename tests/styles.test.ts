import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/client/styles.css', 'utf8');
const html = readFileSync('src/client/index.html', 'utf8');

describe('styles', () => {
  it('loads no web fonts or external stylesheets', () => {
    for (const src of [css, html]) {
      expect(src).not.toContain('fonts.googleapis.com');
      expect(src).not.toMatch(/@import\s+url\(/i);
      expect(src).not.toMatch(/@font-face/i);
    }
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
  });

  it('defines the CRT tokens and a system monospace stack', () => {
    expect(css).toMatch(/--bg:\s*#0f1320/i);
    expect(css).toMatch(/--font-display:[^;]*Consolas[^;]*monospace/);
    for (const tone of ['not_started', 'on_track', 'at_risk', 'behind', 'done'])
      for (const suffix of ['', '-fg', '-bg']) expect(css).toContain(`--s-${tone}${suffix}:`);
  });
});
