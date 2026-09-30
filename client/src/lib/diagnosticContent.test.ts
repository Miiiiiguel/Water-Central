import { describe, expect, it } from 'vitest';
import {
  FLAT, OFFERS, SCORED_QUESTIONS, SECTIONS, TIERS, TOTAL_QUESTIONS, WEIGHT_PER_YES,
  gapsIn, isComplete, scorePct, tierFor, type Answer,
} from './diagnosticContent';

// The questionnaire is the product: these tests pin the shape the team
// signed off on, so a careless edit to the content file fails the build
// instead of quietly changing what a paying client receives.

const allYes = (): Answer[] => FLAT.map((q) => (q.type === 'input' ? null : 'si'));
const allNo = (): Answer[] => FLAT.map((q) => (q.type === 'input' ? null : 'no'));

describe('the questionnaire', () => {
  it('has the five stages, in order', () => {
    expect(SECTIONS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
    expect(SECTIONS.map((s) => s.title)).toEqual([
      'Constitución y marca', 'Logística', 'Marketing', 'País de origen', 'Expectativas',
    ]);
  });

  it('scores exactly 16 questions, which is what makes 100%', () => {
    expect(SCORED_QUESTIONS).toBe(16);
    expect(SCORED_QUESTIONS * WEIGHT_PER_YES).toBe(100);
  });

  it('carries one open question that never scores', () => {
    expect(TOTAL_QUESTIONS - SCORED_QUESTIONS).toBe(1);
    expect(FLAT.filter((q) => q.type === 'input')).toHaveLength(1);
  });

  it('gives every scored question both comments', () => {
    for (const q of FLAT.filter((x) => x.type !== 'input')) {
      expect(q.comSi, `comSi missing: ${q.t}`).toBeTruthy();
      expect(q.comNo, `comNo missing: ${q.t}`).toBeTruthy();
    }
  });

  it('never ships a recommended action to the browser', () => {
    // The actions are the paid product; they live in server/diagnosticActions.ts.
    for (const q of FLAT) expect((q as Record<string, unknown>).act).toBeUndefined();
  });
});

describe('scorePct', () => {
  it('runs from 0 to 100', () => {
    expect(scorePct(allNo())).toBe(0);
    expect(scorePct(allYes())).toBe(100);
  });

  it('adds 6.25 per yes, rounded', () => {
    const answers = allNo();
    answers[FLAT.find((q) => q.type !== 'input')!.index] = 'si';
    expect(scorePct(answers)).toBe(6); // 6.25 rounds to 6
    const eight = allNo();
    FLAT.filter((q) => q.type !== 'input').slice(0, 8).forEach((q) => { eight[q.index] = 'si'; });
    expect(scorePct(eight)).toBe(50);
  });

  it('ignores the open question entirely', () => {
    const answers = allYes();
    const open = FLAT.find((q) => q.type === 'input')!;
    answers[open.index] = 'no';
    expect(scorePct(answers)).toBe(100);
  });

  it('treats unanswered as not scoring', () => {
    expect(scorePct(FLAT.map(() => null))).toBe(0);
  });
});

describe('tierFor', () => {
  it('puts each score in the band the team defined', () => {
    expect(tierFor(0).name).toBe('Explorador');
    expect(tierFor(25).name).toBe('Explorador');
    expect(tierFor(26).name).toBe('Constructor');
    expect(tierFor(50).name).toBe('Constructor');
    expect(tierFor(51).name).toBe('Retador');
    expect(tierFor(75).name).toBe('Retador');
    expect(tierFor(76).name).toBe('Exportador');
    expect(tierFor(100).name).toBe('Exportador');
  });

  it('covers the whole range with no gaps', () => {
    for (let s = 0; s <= 100; s++) expect(tierFor(s), `no tier for ${s}`).toBeTruthy();
  });
});

describe('gapsIn', () => {
  it('returns one gap per "no"', () => {
    expect(gapsIn(allNo())).toHaveLength(16);
    expect(gapsIn(allYes())).toHaveLength(0);
  });

  it('never counts the open question as a gap', () => {
    const answers = allYes();
    answers[FLAT.find((q) => q.type === 'input')!.index] = 'no';
    expect(gapsIn(answers)).toHaveLength(0);
  });
});

describe('isComplete', () => {
  it('needs every scored question answered, and no more', () => {
    expect(isComplete(allYes())).toBe(true);
    expect(isComplete(FLAT.map(() => null))).toBe(false);
    const missingOne = allYes();
    missingOne[0] = null;
    expect(isComplete(missingOne)).toBe(false);
  });
});

describe('the offers', () => {
  it('lists exactly one free option, and it is the call', () => {
    const free = OFFERS.filter((o) => o.free);
    expect(free).toHaveLength(1);
    expect(free[0].p).toBe(0);
  });

  it('flags exactly one as the most requested', () => {
    expect(OFFERS.filter((o) => o.feat)).toHaveLength(1);
  });
});

describe('the tiers', () => {
  it('are ordered and end at 100', () => {
    expect(TIERS.map((t) => t.max)).toEqual([25, 50, 75, 100]);
  });
});
