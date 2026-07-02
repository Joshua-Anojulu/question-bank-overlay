import { describe, expect, it } from 'vitest';
import { detectRevealedAnswer, gradeAnswer } from '../../src/content/answerDetector';

describe('detectRevealedAnswer', () => {
  it('reads the multiple-choice correct answer letter from the rationale', () => {
    document.body.innerHTML = `<div>Rationale Correct Answer: B Choice B is correct.</div>`;
    expect(detectRevealedAnswer(document)).toEqual({ letter: 'B' });
  });

  it('reads a readable grid-in value', () => {
    document.body.innerHTML = `<div>Correct Answer: 0.5</div>`;
    expect(detectRevealedAnswer(document)).toEqual({ value: '0.5' });
  });

  it('returns null when no correct answer is revealed', () => {
    document.body.innerHTML = `<div>Question ID: ac472881</div>`;
    expect(detectRevealedAnswer(document)).toBeNull();
  });
});

describe('gradeAnswer', () => {
  it('grades multiple choice case-insensitively', () => {
    expect(gradeAnswer('b', { letter: 'B' }, 'mc')).toBe(true);
    expect(gradeAnswer('A', { letter: 'B' }, 'mc')).toBe(false);
  });

  it('treats equivalent grid-in numbers and fractions as correct', () => {
    expect(gradeAnswer('0.5', { value: '1/2' }, 'grid')).toBe(true);
    expect(gradeAnswer('.5', { value: '0.5' }, 'grid')).toBe(true);
    expect(gradeAnswer('3', { value: '4' }, 'grid')).toBe(false);
  });
});
