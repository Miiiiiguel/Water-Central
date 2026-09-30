import { describe, expect, it } from 'vitest';
import { ACTIONS } from './diagnosticActions';
import { FLAT } from '../client/src/lib/diagnosticContent';

describe('the recommended actions', () => {
  it('exist for every scored question and only for those', () => {
    for (const q of FLAT) {
      if (q.type === 'input') expect(ACTIONS[q.index], `open question must not have an action`).toBeUndefined();
      else expect(ACTIONS[q.index], `action missing for: ${q.t}`).toBeTruthy();
    }
    expect(Object.keys(ACTIONS)).toHaveLength(16);
  });

  it('only ever link out with safe anchors', () => {
    for (const html of Object.values(ACTIONS)) {
      // The client renders these as React anchors, not raw HTML — but the
      // source should still only contain <a> tags with https targets.
      const tags = html.match(/<\/?[a-z]+/g) ?? [];
      for (const tag of tags) expect(tag === '<a' || tag === '</a').toBe(true);
      for (const href of html.matchAll(/href="([^"]+)"/g)) expect(href[1].startsWith('https://')).toBe(true);
    }
  });
});
