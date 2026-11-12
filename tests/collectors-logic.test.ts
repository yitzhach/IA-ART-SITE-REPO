// The Collectors screens' small rules (stage 6): stages, first look, links and the show QR code.
import {describe, expect, it} from 'vitest';
import {firstLookState, linkUrl, nextStage, qrSvg, showFollowUrl, stageLabel} from '../src/lib/collectors';

describe('collectors logic', () => {
  it('walks the five stages and stops at Finished', () => {
    expect(nextStage('surface')).toBe('layering');
    expect(nextStage('erosion')).toBe('finished');
    expect(nextStage('finished')).toBeNull();
    expect(stageLabel('color')).toBe('Color');
  });
  it('says whether first look is on, off or over', () => {
    const now = Date.parse('2026-11-12T12:00:00Z');
    expect(firstLookState(null, now)).toBe('off');
    expect(firstLookState('2026-11-19T12:00:00.000Z', now)).toBe('on');
    expect(firstLookState('2026-11-01T12:00:00.000Z', now)).toBe('ended');
  });
  it('builds the page and follow addresses on this site', () => {
    expect(linkUrl('/c/abc', 'https://site.example/')).toBe('https://site.example/c/abc');
    expect(showFollowUrl('01JC0000000000000000000ABC', 'https://site.example')).toBe(
      'https://site.example/follow/01JC0000000000000000000ABC',
    );
  });
  it('draws a QR code as plain SVG squares', () => {
    const svg = qrSvg('https://site.example/follow/01JC0000000000000000000ABC');
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toMatch(/<path d="(M\d+ \d+h\d+v\d+h-\d+z)+" fill="#000"\/>/);
    expect(svg).not.toMatch(/<script|on\w+=/i);
  });
});
