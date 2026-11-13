import assert from 'node:assert/strict';
import { renderMarkdown, readingTimeMinutes, headingSlug } from '../lib/cms/markdown';
import { scoreSeo } from '../lib/cms/seo-score';
import { normalizePath } from '../lib/cms/redirects';
import { parseBlocks, serializeBlocks, emptyBlock } from '../lib/cms/blocks';

let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed++; console.error(`  ✗ ${name}\n    ${(e as Error).message}`); }
}

console.log('\n--- CMS: Markdown renderer & SEO ---');

test('raw HTML and script tags are escaped', () => {
  const { html } = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script'), html);
  assert.ok(!/<img src=x/i.test(html), html);
  assert.ok(html.includes('&lt;script&gt;'));
});
test('javascript: and data: links are dropped', () => {
  const { html } = renderMarkdown('[x](javascript:alert(1)) [y](data:text/html,hi) ![z](javascript:1)');
  assert.ok(!/href="javascript/i.test(html) && !/href="data:/i.test(html) && !/src="javascript/i.test(html), html);
});
test('attribute injection through link/image text is escaped', () => {
  const { html } = renderMarkdown('[a" onmouseover="x](https://e.com) ![b" onerror="x](/a.png)');
  assert.ok(!/ onmouseover=/.test(html.replace(/&quot;/g, '')) || html.includes('&quot;'), html);
  assert.ok(!/<a [^>]*" onmouseover=/.test(html), html);
});
test('external links get rel=noopener', () => {
  assert.ok(renderMarkdown('[a](https://example.com)').html.includes('rel="noopener noreferrer"'));
});
test('headings build a table of contents with unique ids; h1 is demoted', () => {
  const { html, toc } = renderMarkdown('# Top\n## Same\n## Same\n### Sub');
  assert.equal(toc.length, 4);
  assert.deepEqual(toc.map((t) => t.id), ['top', 'same', 'same-2', 'sub']);
  assert.ok(!html.includes('<h1'));
});
test('tables, checklists, callouts, video, cta render', () => {
  const md = '| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n\n> [!TIP] hello\n\n::video[https://youtu.be/abcdefghijk]\n\n::cta[T|body|Go|/x]';
  const { html } = renderMarkdown(md);
  for (const needle of ['<table>', 'cms-checklist', 'cms-callout-tip', 'youtube-nocookie.com/embed/abcdefghijk', 'cms-cta']) assert.ok(html.includes(needle), needle);
});
test('video embeds only allow known hosts', () => {
  assert.equal(renderMarkdown('::video[https://evil.example/x]').html.trim(), '');
});
test('reading time and slug helpers', () => {
  assert.equal(readingTimeMinutes('word '.repeat(660)), 3);
  assert.equal(headingSlug('Hello, World!'), 'hello-world');
});
test('SEO score rewards a well-optimised post', () => {
  const body = 'Personalised gifts are special. '.repeat(120) + '\n\n## Why\n\n[shop](/products/x)\n\n## How\n\n[ref](https://example.com)\n\n![i](/a.png)';
  const good = scoreSeo({ title: 'Personalised gifts guide', slug: 'personalised-gifts-guide', content: body, seoTitle: 'Personalised gifts guide for every occasion in 2026', metaDescription: 'Discover personalised gifts for birthdays, weddings and corporate events, with ideas, pricing tips and delivery advice from our Hyderabad studio.', focusKeyword: 'personalised gifts', coverImageUrl: '/a.png', coverImageAlt: 'gift', tagsCount: 2, hasCategory: true });
  const bad = scoreSeo({ title: 'x', slug: 'x', content: 'short' });
  assert.ok(good.score >= 80, `good=${good.score}`);
  assert.ok(bad.score < 30, `bad=${bad.score}`);
});
test('redirect paths normalise', () => {
  assert.equal(normalizePath('Old-Page/'), '/old-page');
  assert.equal(normalizePath('https://x.com/A/B/?q=1'), '/a/b');
});

test('blocks: markdown -> blocks -> markdown is stable for every block type', () => {
  const md =
    [
      '## Heading two',
      'Intro with **bold** and [a link](/x).',
      '![Cover](/uploads/media/a.jpg)',
      '- one\n- two',
      '1. first\n2. second',
      '- [x] done\n- [ ] todo',
      '> a quote',
      '> [!WARNING] careful\n> second line',
      '| A | B |\n|---|---|\n| 1 | 2 |',
      '::video[https://youtu.be/abcdefghijk]',
      '::button[Shop](/#catalog-section)',
      '::cta[T|body|Go|/x]',
      '---',
      '```js\nconst a = 1;\n```',
      '::product[normal-mug-with-print]',
    ].join('\n\n') + '\n';
  const blocks = parseBlocks(md);
  assert.deepEqual(blocks.map((b) => b.type), ['h', 'p', 'img', 'ul', 'ol', 'check', 'quote', 'callout', 'table', 'video', 'button', 'cta', 'divider', 'code', 'product']);
  assert.equal(serializeBlocks(blocks), md);
  assert.equal(renderMarkdown(serializeBlocks(blocks)).html, renderMarkdown(md).html);
});
test('blocks: empty blocks are dropped; CTA fields cannot break the syntax', () => {
  assert.equal(serializeBlocks([emptyBlock('p'), emptyBlock('img'), emptyBlock('ul')]), '');
  const cta = emptyBlock('cta') as any;
  cta.title = 'Hi | there]';
  const out = serializeBlocks([cta]);
  assert.equal(out.match(/\|/g)?.length, 3, out);
  assert.equal((parseBlocks(out)[0] as any).type, 'cta');
});

if (failed) { console.error(`\n${failed} CMS test(s) failed`); process.exit(1); }
console.log('All CMS tests passed.');
