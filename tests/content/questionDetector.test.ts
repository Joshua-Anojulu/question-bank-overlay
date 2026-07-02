import { describe, expect, it } from 'vitest';
import { detectQuestion } from '../../src/content/questionDetector';

describe('detectQuestion', () => {
  it('prefers a visible question id when present', async () => {
    document.body.innerHTML = `
      <main><article data-question-id="cb-12345">
        <h2>Question ID: cb-12345</h2>
        <p>Which expression is equivalent to 2x + 4?</p>
        <span>Domain: Algebra</span><span>Skill: Linear equations</span><span>Difficulty: Hard</span>
      </article></main>`;

    await expect(detectQuestion(document)).resolves.toMatchObject({
      questionKey: 'cb-12345',
      questionKeyMethod: 'visible-id',
      domain: 'Algebra',
      skill: 'Linear equations',
      difficulty: 'Hard'
    });
  });

  it('uses a local fingerprint when no visible id exists', async () => {
    document.body.innerHTML = `
      <main><article>
        <p>A student solves a linear equation and makes a sign error. Which step first shows the error?</p>
        <ol><li>Choice A</li><li>Choice B</li><li>Choice C</li><li>Choice D</li></ol>
      </article></main>`;

    const detected = await detectQuestion(document);
    expect(detected?.questionKeyMethod).toBe('fingerprint');
    expect(detected?.questionKey).toMatch(/^sha256_/);
  });

  it('returns null when the page has too little visible question content', async () => {
    document.body.innerHTML = '<main><p>Loading</p></main>';
    await expect(detectQuestion(document)).resolves.toBeNull();
  });

  it('keeps fingerprints stable across harmless whitespace changes', async () => {
    document.body.innerHTML = `
      <main><article>
        <p>A student solves a linear equation and makes a sign error. Which step first shows the error?</p>
        <ol><li>Choice A</li><li>Choice B</li><li>Choice C</li><li>Choice D</li></ol>
      </article></main>`;
    const first = await detectQuestion(document);

    document.body.innerHTML = `
      <main>
        <article>
          <p>A student solves a linear equation and makes a sign error.
          Which step first shows the error?</p>
          <ol>
            <li>Choice A</li><li>Choice B</li><li>Choice C</li><li>Choice D</li>
          </ol>
        </article>
      </main>`;
    const second = await detectQuestion(document);

    expect(second?.questionKey).toBe(first?.questionKey);
  });
});
