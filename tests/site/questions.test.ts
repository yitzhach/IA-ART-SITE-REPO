import {beforeEach, describe, expect, it} from 'vitest';
import {api, fixture, get, reset, SLUG} from './fake-api';
import {siteData} from '../../worker/site/data';
import {sitemap} from '../../worker/site/extras';
import {QUESTIONS, savedAnswers} from '../../worker/site/optional';

beforeEach(reset);

const ld = (text: string) =>
  [...text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]!));

describe('/questions (card B)', () => {
  it('shows each saved answer under its question, in the Site screen order, with FAQPage data', async () => {
    const {status, text} = await get('/questions');
    expect(status).toBe(200);
    expect(text).toContain('<title>Questions — Test Studio</title>');
    expect(text).toContain('<h1>Questions</h1>');
    const heads = [...text.matchAll(/<h2 id="q-([a-zA-Z]+)">([^<]+)<\/h2>/g)].map(m => m[1]);
    expect(heads).toEqual(['shipping', 'hanging', 'care']);
    expect(text).toContain('How does shipping work?');
    expect(text).toContain('<p>Large pieces get a quote within two working days.</p>');
    const faq = ld(text).find(o => o['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(3);
    expect(faq.mainEntity[1]).toEqual({
      '@type': 'Question',
      name: 'How do I hang a piece?',
      acceptedAnswer: {'@type': 'Answer', text: 'Every piece arrives ready to hang on a French cleat.'},
    });
    expect(text).toContain('Start a conversation');
  });

  it('never shows an empty answer, an unknown topic or words as HTML', async () => {
    fixture.answers = {
      care: '   ',
      secretTopic: 'Not a topic the studio can save',
      materials: '<img src=x onerror=alert(1)>',
    };
    const {text} = await get('/questions');
    expect(text).not.toContain('How do I care for a piece?');
    expect(text).not.toContain('Not a topic');
    expect(text).not.toContain('<img src=x');
    expect(text).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(text).toContain('What materials do you use?');
  });

  it('with no saved answer: not found, and no footer link or sitemap entry', async () => {
    fixture.answers = {};
    const r = await get('/questions');
    expect(r.status).toBe(404);
    expect((await get('/about')).text).not.toContain('href="/questions"');
    const x = await (await sitemap('https://a.test', siteData(api, SLUG))).text();
    expect(x).not.toContain('/questions');
  });

  it('with answers: in the footer nav and the sitemap', async () => {
    const about = (await get('/about')).text;
    expect(about).toMatch(/<nav aria-label="Footer">[\s\S]*href="\/questions"[\s\S]*<\/nav>/);
    expect(about.split('<nav aria-label="Main">')[1]!.split('</nav>')[0]).not.toContain('/questions');
    const x = await (await sitemap('https://a.test', siteData(api, SLUG))).text();
    expect(x).toContain('<loc>https://a.test/questions</loc>');
  });

  it('covers every topic the Site screen saves', async () => {
    const {TOPICS} = await import('../../src/lib/assistant-form');
    expect(QUESTIONS.map(q => q.key)).toEqual(TOPICS.map(t => t.key));
    expect(savedAnswers(null)).toEqual([]);
  });
});
