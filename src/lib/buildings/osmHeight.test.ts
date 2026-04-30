import { describe, expect, it } from 'vitest';
import { resolveHeightM } from './osmHeight';

describe('resolveHeightM', () => {
  it('parses a numeric height tag in metres', () => {
    expect(resolveHeightM({ height: '12' })).toBe(12);
  });

  it('strips a trailing unit on the height tag', () => {
    expect(resolveHeightM({ height: '12.5 m' })).toBeCloseTo(12.5);
  });

  it('falls back to building:height when height is absent', () => {
    expect(resolveHeightM({ 'building:height': '8' })).toBe(8);
  });

  it('multiplies building:levels by 3 metres when height is missing', () => {
    expect(resolveHeightM({ 'building:levels': '4' })).toBe(12);
  });

  it('prefers an explicit height over building:levels', () => {
    expect(resolveHeightM({ height: '20', 'building:levels': '4' })).toBe(20);
  });

  it('defaults to 6 metres when neither tag is set', () => {
    expect(resolveHeightM({})).toBe(6);
  });

  it('defaults to 6 metres on garbage values', () => {
    expect(resolveHeightM({ height: 'tall', 'building:levels': 'NaN' })).toBe(6);
  });

  it('treats zero or negative heights as missing', () => {
    expect(resolveHeightM({ height: '0' })).toBe(6);
    expect(resolveHeightM({ 'building:levels': '0' })).toBe(6);
  });
});
