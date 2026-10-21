// Tests for Markdown for Agents content negotiation on allsoft.asia.
// Run with: node --test test/
//
// Covers the HTML -> Markdown converter (functions/_middleware.js) and the
// middleware negotiation behavior (Accept: text/markdown handling).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequest, htmlToMarkdown, estimateTokens } from '../functions/_middleware.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE = 'https://allsoft.asia/products';

function md(html, url = PAGE) {
  return htmlToMarkdown(html, url);
}

function htmlResponse(body, headers = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers }
  });
}

function ctx(request, next) {
  return { request, next, env: {} };
}

// ---------------------------------------------------------------------------
// Converter
// ---------------------------------------------------------------------------

test('frontmatter: meta priority, og fallback, absolute image, JSON-LD block', () => {
  const out = md(`<!DOCTYPE html><html><head>
<title>Fallback Title</title>
<meta property="og:title" content="OG Title">
<meta name="description" content="页面描述">
<meta property="og:image" content="/assets/og.jpg">
<script type="application/ld+json">{"@type":"Organization","name":"AllSoft"}</script>
</head><body><h1>Hello</h1><p>World</p></body></html>`);

  assert.match(out, /^---\ntitle: "OG Title"\ndescription: "页面描述"\nimage: "https:\/\/allsoft\.asia\/assets\/og\.jpg"\n---\n/);
  assert.match(out, /# Hello/);
  assert.match(out, /```json\n\{"@type":"Organization","name":"AllSoft"\}\n```/);
  assert.ok(!out.includes('Fallback Title'));
});

test('frontmatter: meta[name=title] wins over og:title', () => {
  const out = md(`<html><head>
<meta property="og:title" content="OG">
<meta name="title" content="Standard">
</head><body><p>x</p></body></html>`);
  assert.match(out, /title: "Standard"/);
  assert.ok(!out.includes('title: OG'));
});

test('frontmatter omitted when no supported meta tags', () => {
  const out = md('<html><body><p>just text</p></body></html>');
  assert.ok(!out.startsWith('---'));
  assert.match(out, /just text/);
});

test('strips nav, header, footer, script, svg, button, form', () => {
  const out = md(`<html><body>
<nav><a href="/">HomeLink</a></nav>
<header><span>BrandMark</span></header>
<main><h2>Real</h2><p>Content <a href="/about">about</a></p></main>
<footer><p>FooterText</p></footer>
<script>var x = 1 < 2;</script>
<svg><rect width="10"/></svg>
<button>ButtonText</button>
<form><input><textarea>t</textarea></form>
</body></html>`);

  assert.match(out, /## Real/);
  assert.match(out, /Content \[about\]\(https:\/\/allsoft\.asia\/about\)/);
  for (const gone of ['HomeLink', 'BrandMark', 'FooterText', 'var x', 'rect', 'ButtonText']) {
    assert.ok(!out.includes(gone), `expected "${gone}" to be stripped`);
  }
});

test('headings, paragraphs, emphasis, inline code', () => {
  const out = md(`<body>
<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>
<p>plain <strong>bold</strong> and <b>bold2</b> and <em>italic</em> and <i>italic2</i> and <code>code()</code></p>
</body>`);
  assert.match(out, /# H1\n/);
  assert.match(out, /## H2\n/);
  assert.match(out, /### H3\n/);
  assert.match(out, /#### H4\n/);
  assert.match(out, /##### H5\n/);
  assert.match(out, /###### H6\n/);
  assert.match(out, /plain \*\*bold\*\* and \*\*bold2\*\* and \*italic\* and \*italic2\* and `code\(\)`/);
});

test('lists: unordered, nested, ordered with start attribute', () => {
  const out = md(`<body>
<ul><li>一</li><li>二<ul><li>2.1</li><li>2.2</li></ul></li><li>三</li></ul>
<ol start="3"><li>三</li><li>四</li></ol>
</body>`);
  assert.match(out, /- 一\n- 二\n {2}- 2\.1\n {2}- 2\.2\n- 三/);
  assert.match(out, /3\. 三\n4\. 四/);
});

test('table: header, separator, escaped pipes, padded rows', () => {
  const out = md(`<body><table>
<thead><tr><th>A</th><th>B</th></tr></thead>
<tbody><tr><td>1</td><td>x|y</td></tr><tr><td>only</td></tr></tbody>
</table></body>`);
  assert.match(out, /\| A \| B \|\n\| --- \| --- \|\n\| 1 \| x\\\|y \|\n\| only \|  \|/);
});

test('pre/code blocks and hard line breaks', () => {
  const out = md(`<body>
<pre><code class="language-js">const a = 1 &lt; 2;</code></pre>
<p>line1<br>line2 <strong>粗</strong></p>
</body>`);
  assert.match(out, /```js\nconst a = 1 < 2;\n```/);
  assert.match(out, /line1\nline2 \*\*粗\*\*/);
});

test('blockquote with multiple paragraphs', () => {
  const out = md(`<body><blockquote><p>引用一段</p><p>第二段</p></blockquote></body>`);
  assert.match(out, /> 引用一段\n>\n> 第二段/);
});

test('hr, images (absolute + data-uri skip), links (relative/absolute/mailto/anchor)', () => {
  const out = md(`<body>
<hr>
<img src="/a.png" alt="图">
<img src="data:image/png;base64,AAAA" alt="skipme">
<p><a href="/about">rel</a> <a href="https://x.com/p">abs</a> <a href="mailto:h@e.com">mail</a> <a href="#sec">anchor</a> <a href="javascript:void(0)">js</a></p>
</body>`, 'https://allsoft.asia/faq');
  assert.match(out, /---/);
  assert.match(out, /!\[图\]\(https:\/\/allsoft\.asia\/a\.png\)/);
  assert.ok(!out.includes('skipme'));
  assert.match(out, /\[rel\]\(https:\/\/allsoft\.asia\/about\)/);
  assert.match(out, /\[abs\]\(https:\/\/x\.com\/p\)/);
  assert.match(out, /\[mail\]\(mailto:h@e\.com\)/);
  assert.match(out, /\[anchor\]\(https:\/\/allsoft\.asia\/faq#sec\)/);
  // javascript: links degrade to plain text, never to a markdown link.
  assert.match(out, /\bjs\b/);
  assert.ok(!out.includes('(javascript:'));
});

test('entities decoded, markdown specials escaped', () => {
  const out = md(`<body><p>a &amp; b &lt;tag&gt; &copy; 2026 &#8212; &#x2764; end</p><p># not a heading</p><p>- not a list</p><p>1. not ordered</p></body>`);
  assert.match(out, /a & b <tag> © 2026 — ❤ end/);
  assert.match(out, /\\# not a heading/);
  assert.match(out, /\\- not a list/);
  assert.match(out, /1\. not ordered/); // paragraph starting with digits+dot is escaped
});

test('malformed HTML is tolerated', () => {
  const out = md('<body><p>unclosed <strong>bold <em>both</p><div>next</div><ul><li>item');
  assert.match(out, /unclosed \*\*bold \*both\*\*/);
  assert.match(out, /next/);
  assert.match(out, /- item/);
});

test('empty and head-only input', () => {
  assert.equal(md(''), '');
  assert.equal(md('<html><head><title>t</title></head></html>'), '');
  assert.doesNotThrow(() => md('<p>ok</p>'));
});

test('stray < in text does not break parsing', () => {
  const out = md('<body><p>5 < 6 and 7 > 3</p></body>');
  assert.match(out, /5 < 6 and 7 > 3/);
});

// ---------------------------------------------------------------------------
// Middleware negotiation
// ---------------------------------------------------------------------------

test('Accept: text/markdown returns a markdown response with required headers', async () => {
  const request = new Request('https://allsoft.asia/products', {
    headers: { Accept: 'text/markdown' }
  });
  const res = await onRequest(ctx(request, async () => htmlResponse(
    '<html><head><meta name="title" content="T"></head><body><h1>Hi</h1></body></html>',
    { 'Cache-Control': 'public, max-age=3600', 'X-Frame-Options': 'SAMEORIGIN' }
  )));

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(res.headers.get('vary'), 'Accept');
  assert.match(res.headers.get('x-markdown-tokens') || '', /^\d+$/);
  assert.equal(res.headers.get('content-signal'), 'ai-train=yes, search=yes, ai-input=yes');
  // Origin headers preserved, body-describing headers dropped.
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=3600');
  assert.equal(res.headers.get('etag'), null);
  const text = await res.text();
  assert.match(text, /^---\ntitle: "T"\n---\n\n# Hi\n/);
});

test('browser request passes the HTML response through untouched', async () => {
  const request = new Request('https://allsoft.asia/');
  const original = htmlResponse('<h1>Hi</h1>');
  const res = await onRequest(ctx(request, async () => original));
  assert.equal(res, original);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
});

test('Accept list containing text/markdown still negotiates', async () => {
  const request = new Request('https://allsoft.asia/', {
    headers: { Accept: 'text/html,application/xhtml+xml,text/markdown;q=0.9' }
  });
  const res = await onRequest(ctx(request, async () => htmlResponse('<h1>Hi</h1>')));
  assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
});

test('non-HTML responses pass through even with markdown accept', async () => {
  const request = new Request('https://allsoft.asia/api/team', {
    headers: { Accept: 'text/markdown' }
  });
  const original = new Response('{"ok":true}', {
    headers: { 'Content-Type': 'application/json' }
  });
  const res = await onRequest(ctx(request, async () => original));
  assert.equal(res, original);
});

test('404 responses pass through', async () => {
  const request = new Request('https://allsoft.asia/nope', {
    headers: { Accept: 'text/markdown' }
  });
  const original = new Response('<h1>404</h1>', {
    status: 404,
    headers: { 'Content-Type': 'text/html' }
  });
  const res = await onRequest(ctx(request, async () => original));
  assert.equal(res.status, 404);
});

test('HEAD requests are not converted', async () => {
  const request = new Request('https://allsoft.asia/', {
    method: 'HEAD',
    headers: { Accept: 'text/markdown' }
  });
  const original = htmlResponse('<h1>Hi</h1>');
  const res = await onRequest(ctx(request, async () => original));
  assert.equal(res, original);
});

test('pages.dev redirect still wins over markdown negotiation', async () => {
  const request = new Request('https://allsoft-asia.pages.dev/products?x=1', {
    headers: { Accept: 'text/markdown' }
  });
  const res = await onRequest(ctx(request, async () => {
    throw new Error('next() must not be called for pages.dev host');
  }));
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), 'https://allsoft.asia/products?x=1');
});

test('existing Vary header is extended, not duplicated', async () => {
  const request = new Request('https://allsoft.asia/', {
    headers: { Accept: 'text/markdown' }
  });
  const res = await onRequest(ctx(request, async () => htmlResponse(
    '<p>x</p>', { 'Vary': 'Accept-Encoding, accept' }
  )));
  assert.equal(res.headers.get('vary'), 'Accept-Encoding, accept');
});

test('estimateTokens counts CJK and latin', () => {
  assert.ok(estimateTokens('hello world') >= 2);
  assert.ok(estimateTokens('中文内容测试一下') >= 8);
});

// ---------------------------------------------------------------------------
// Smoke test over the real site pages
// ---------------------------------------------------------------------------

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      files.push(...await walk(full));
    } else if (entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

test('every real site page converts without throwing and yields content', async () => {
  const files = await walk(ROOT);
  assert.ok(files.length >= 15, `expected the site's HTML pages, found ${files.length}`);

  for (const file of files) {
    const html = await readFile(file, 'utf8');
    const rel = relative(ROOT, file).split(sep).join('/');
    const url = 'https://allsoft.asia/' + rel.replace(/index\.html$/, '');
    const out = htmlToMarkdown(html, url);
    assert.ok(out.length > 0, `${rel} produced empty markdown`);
    assert.ok(!/\u0000/.test(out), `${rel} contains NUL bytes`);
    // Structural sanity: no raw block-level HTML tags leaked into the output.
    assert.ok(!/<(div|nav|footer|header|script|style|button)[\s>]/i.test(out),
      `${rel} leaked raw HTML into markdown`);
  }
});
