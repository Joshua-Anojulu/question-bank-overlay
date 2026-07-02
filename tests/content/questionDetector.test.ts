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

  it('detects the open question on the educator bank, which has no main/article container', async () => {
    // The educator question bank renders as a filter/table page with no <main>,
    // <article>, or data-question-id; the open question exposes "Question ID: xxxx"
    // as plain text, and metadata labels appear both as filter help text and values.
    document.body.innerHTML = `
      <div>
        <div>Difficulty: Choose one or more difficulty levels for your questions (easy, medium, or hard).</div>
        <div>Skill: Choose a skill area within your chosen domain that you want to focus on.</div>
        <div>Assessment: SAT</div>
        <div>Section: Math</div>
        <div>Domain: Algebra</div>
        <div>Question ID: ac472881</div>
        <div>Difficulty: Hard</div>
        <p>Which of the following equations has a graph in the xy-plane... </p>
      </div>`;

    await expect(detectQuestion(document)).resolves.toMatchObject({
      questionKey: 'ac472881',
      questionKeyMethod: 'visible-id',
      section: 'Math',
      domain: 'Algebra',
      difficulty: 'Hard'
    });
  });

  it('does not fingerprint the educator list page when no question is open', async () => {
    // Filter labels present as help text, plenty of body text, but no "Question ID:"
    // and no question container. Must return null instead of fingerprinting the list.
    document.body.innerHTML = `
      <div>
        <div>Difficulty: Choose one or more difficulty levels for your questions (easy, medium, or hard).</div>
        <div>Skill: Choose a skill area within your chosen domain that you want to focus on.</div>
        <div>Assessment: SAT</div>
        <div>Section: Math</div>
        <div>Domain: Algebra</div>
        <table><tr><td>Question one preview</td></tr><tr><td>Question two preview</td></tr></table>
      </div>`;

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
