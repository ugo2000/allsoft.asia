// Pages Function middleware for allsoft.asia.
//
// Two responsibilities:
//
//   1. Consolidate the default *.pages.dev subdomain onto the canonical
//      allsoft.asia domain (301 redirect; branch preview URLs keep working).
//
//   2. Markdown for Agents content negotiation: requests that send
//      `Accept: text/markdown` get a markdown rendering of the page.
//      Cloudflare's zone-level Markdown for Agents needs a Pro/Business plan,
//      so the conversion runs here in the middleware instead — free-tier safe.
//      Browsers and normal crawlers keep receiving HTML, untouched.
//
// Output format follows Cloudflare's Markdown for Agents spec:
//   https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
// Checklist: https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md
//
// The HTML -> Markdown converter below is zero-dependency so it runs both in
// the Workers runtime and in Node (see test/markdown-negotiation.test.mjs).

const CANONICAL_HOST = 'allsoft.asia';
const PAGES_DEV_HOST = 'allsoft-asia.pages.dev';

// Content Signals policy (https://contentsignals.org/) — matches the default
// Cloudflare adds when Markdown for Agents is enabled for a zone.
const CONTENT_SIGNAL = 'ai-train=yes, search=yes, ai-input=yes';

// Internal / dev-side paths that must never be served to visitors.
// .assetsignore is not honored by `wrangler pages deploy` (dotfiles are not
// uploaded), so the same blocklist is enforced here at request time.
const BLOCKED_PATH_RE = /^\/(\.workbuddy|\.git|\.wrangler|\.github)(\/|$)|\/__pycache__(\/|$)/;
const BLOCKED_EXT_RE = /\.(py|pyc|bat|cmd|sh|log|tmp)$/i;
const BLOCKED_FILES = new Set(['/cross_device_setup.md', '/setup_guide.md']);

function isBlockedPath(pathname) {
  const lower = pathname.toLowerCase();
  return BLOCKED_PATH_RE.test(lower) || BLOCKED_EXT_RE.test(lower) || BLOCKED_FILES.has(lower);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // 1. Canonical-host redirect takes priority (client retries on allsoft.asia).
  if (url.hostname === PAGES_DEV_HOST) {
    const target = 'https://' + CANONICAL_HOST + url.pathname + url.search;
    return new Response(null, {
      status: 301,
      headers: { 'Location': target, 'Cache-Control': 'no-store' }
    });
  }

  // 2. Internal/dev files are never served (see BLOCKED_PATH_RE above).
  if (isBlockedPath(url.pathname)) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. Markdown for Agents content negotiation.
  if (wantsMarkdown(request)) {
    return serveMarkdown(context, url);
  }

  return next();
}

function wantsMarkdown(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const accept = request.headers.get('accept') || '';
  return accept.toLowerCase().includes('text/markdown');
}

async function serveMarkdown(context, url) {
  const { next } = context;
  const response = await next();

  // Only convert successful HTML documents. APIs, assets, redirects and
  // error pages pass through untouched.
  const contentType = response.headers.get('content-type') || '';
  if (response.status !== 200 || !contentType.toLowerCase().includes('text/html')) {
    return response;
  }

  let html;
  try {
    html = await response.text();
  } catch {
    return response;
  }

  let markdown;
  try {
    markdown = htmlToMarkdown(html, url);
  } catch (err) {
    // Never break a page for agents: fall back to the HTML response.
    console.error('htmlToMarkdown failed for', url.pathname, err);
    return response;
  }

  const headers = new Headers(response.headers);
  // Headers that describe the original HTML body no longer apply.
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('content-range');
  headers.delete('transfer-encoding');
  headers.delete('etag');
  headers.delete('last-modified');
  headers.set('content-type', 'text/markdown; charset=utf-8');
  headers.set('vary', mergeVary(headers.get('vary')));
  headers.set('x-markdown-tokens', String(estimateTokens(markdown)));
  headers.set('content-signal', CONTENT_SIGNAL);

  return new Response(markdown, { status: 200, headers });
}

function mergeVary(existing) {
  const value = (existing || '').trim();
  if (!value) return 'Accept';
  const parts = value.toLowerCase().split(',').map((s) => s.trim());
  if (parts.includes('accept')) return value;
  return value + ', Accept';
}

// Rough token estimate: CJK characters cost ~1 token each, others ~1/4.
export function estimateTokens(text) {
  const cjk = (text.match(/[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/g) || []).length;
  return cjk + Math.ceil((text.length - cjk) / 4);
}

// ---------------------------------------------------------------------------
// HTML -> Markdown converter
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);
const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

// Removed together with their content: scripts, styles, site chrome
// (nav/header/footer), interactive UI and embedded media. Mirrors the
// pre-processing Cloudflare documents for its own converter.
const STRIP_WITH_CONTENT = new Set([
  'script', 'style', 'noscript', 'template', 'nav', 'header', 'footer', 'aside',
  'svg', 'canvas', 'iframe', 'form', 'input', 'button', 'select', 'textarea',
  'option', 'optgroup', 'label', 'fieldset', 'legend', 'datalist', 'output',
  'progress', 'meter', 'dialog', 'menu', 'picture', 'source', 'audio', 'video',
  'track', 'map', 'area', 'object', 'embed', 'param', 'head', 'link', 'meta',
  'base', 'title'
]);

const BLOCK_LEVEL = new Set([
  'html', 'body', 'div', 'section', 'article', 'main', 'figure', 'figcaption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote',
  'pre', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'dl', 'dt', 'dd', 'details', 'summary', 'hgroup', 'center', 'address'
]);

const INLINE_ELEMENTS = new Set([
  'a', 'span', 'strong', 'b', 'em', 'i', 'code', 'small', 'sup', 'sub', 'u',
  's', 'strike', 'del', 'ins', 'mark', 'abbr', 'time', 'cite', 'q', 'dfn',
  'var', 'kbd', 'samp', 'bdi', 'bdo', 'data', 'ruby', 'rt', 'rp', 'wbr',
  'br', 'img', 'font', 'nobr', 'big', 'tt', 'acronym'
]);

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  copy: '\u00a9', reg: '\u00ae', trade: '\u2122', hellip: '\u2026',
  mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201c', rdquo: '\u201d', bull: '\u2022', middot: '\u00b7',
  laquo: '\u00ab', raquo: '\u00bb', times: '\u00d7', divide: '\u00f7',
  deg: '\u00b0', plusmn: '\u00b1', para: '\u00b6', sect: '\u00a7',
  euro: '\u20ac', pound: '\u00a3', yen: '\u00a5', cent: '\u00a2',
  larr: '\u2190', rarr: '\u2192', uarr: '\u2191', darr: '\u2193', harr: '\u2194',
  dagger: '\u2020', permil: '\u2030', prime: '\u2032', Prime: '\u2033',
  frac12: '\u00bd', frac14: '\u00bc', frac34: '\u00be', sup2: '\u00b2', sup3: '\u00b3',
  micro: '\u00b5', not: '\u00ac', shy: '\u00ad', ensp: '\u2002', emsp: '\u2003',
  thinsp: '\u2009', zwnj: '\u200c', zwj: '\u200d', lrm: '\u200e', rlm: '\u200f'
};

function decodeEntities(input) {
  return input.replace(/&(#[Xx]?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/g, (match, ent) => {
    if (ent[0] === '#') {
      const isHex = ent[1] === 'x' || ent[1] === 'X';
      const code = parseInt(isHex ? ent.slice(2) : ent.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[ent];
    return named !== undefined ? named : match;
  });
}

// --- Tokenizer -------------------------------------------------------------

function findTagEnd(html, start) {
  // Start is the index of '<'. Returns index of the closing '>', honouring
  // quoted attribute values (which may themselves contain '>').
  let quote = null;
  for (let i = start + 1; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return -1;
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    if (!name || name === '/') continue;
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

function tokenize(html) {
  const tokens = [];
  let i = 0;
  const pushText = (text) => { if (text) tokens.push({ type: 'text', text }); };

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { pushText(html.slice(i)); break; }
    if (lt > i) pushText(html.slice(i, lt));

    const next = html[lt + 1];
    if (next === '!') {
      if (html.startsWith('<!--', lt)) {
        const end = html.indexOf('-->', lt + 4);
        i = end === -1 ? html.length : end + 3;
      } else {
        const end = html.indexOf('>', lt);
        i = end === -1 ? html.length : end + 1;
      }
      continue;
    }
    if (next === '?') {
      const end = html.indexOf('>', lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }
    if (next === '/') {
      const end = html.indexOf('>', lt);
      if (end === -1) { pushText(html.slice(lt)); break; }
      tokens.push({ type: 'endtag', name: html.slice(lt + 2, end).trim().toLowerCase() });
      i = end + 1;
      continue;
    }
    if (!/[A-Za-z]/.test(next || '')) {
      // A stray '<' in text (e.g. "a < b").
      pushText('<');
      i = lt + 1;
      continue;
    }

    const end = findTagEnd(html, lt);
    if (end === -1) { pushText(html.slice(lt)); break; }
    const inner = html.slice(lt + 1, end);
    const nameMatch = inner.match(/^([A-Za-z][A-Za-z0-9:-]*)/);
    if (!nameMatch) { pushText(html.slice(lt, end + 1)); i = end + 1; continue; }
    const name = nameMatch[1].toLowerCase();
    const attrRaw = inner.slice(nameMatch[1].length);
    const selfClosing = /\/\s*$/.test(attrRaw);
    tokens.push({ type: 'starttag', name, attrs: parseAttrs(attrRaw), selfClosing });
    i = end + 1;

    if (RAW_TEXT_ELEMENTS.has(name) && !selfClosing) {
      // Consume raw text until the matching close tag.
      const closeRe = new RegExp('</' + name + '[\\s>]', 'i');
      const rest = html.slice(i);
      const closeMatch = rest.match(closeRe);
      if (closeMatch) {
        const rawText = rest.slice(0, closeMatch.index);
        if (rawText) tokens.push({ type: 'rawtext', name, text: rawText });
        i += closeMatch.index;
      } else {
        pushText(rest);
        i = html.length;
      }
    }
  }
  return tokens;
}

// --- Tree ------------------------------------------------------------------

function buildTree(tokens) {
  const root = { type: 'element', name: '#root', attrs: {}, children: [] };
  const stack = [root];

  for (const tok of tokens) {
    const top = stack[stack.length - 1];
    if (tok.type === 'text') {
      const text = decodeEntities(tok.text);
      if (text) top.children.push({ type: 'text', text });
    } else if (tok.type === 'rawtext') {
      top.children.push({ type: 'rawtext', name: tok.name, text: tok.text });
    } else if (tok.type === 'starttag') {
      const el = { type: 'element', name: tok.name, attrs: tok.attrs, children: [] };
      top.children.push(el);
      if (!tok.selfClosing && !VOID_ELEMENTS.has(tok.name)) stack.push(el);
    } else if (tok.type === 'endtag') {
      // Tolerant close: pop up to the nearest matching open tag.
      for (let j = stack.length - 1; j >= 1; j--) {
        if (stack[j].name === tok.name) { stack.length = j; break; }
      }
    }
  }
  return root;
}

// --- Helpers ---------------------------------------------------------------

function collectRawText(node) {
  let out = '';
  for (const child of node.children) {
    if (child.type === 'text' || child.type === 'rawtext') out += child.text;
    else if (child.type === 'element') {
      out += child.name === 'br' ? '\n' : collectRawText(child);
    }
  }
  return out;
}

function findFirstElement(node, name) {
  for (const child of node.children) {
    if (child.type !== 'element') continue;
    if (child.name === name) return child;
    const found = findFirstElement(child, name);
    if (found) return found;
  }
  return null;
}

function resolveUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function escapeMdText(text) {
  return text.replace(/([\\`*_[\]])/g, '\\$1');
}

function escapeBlockStart(text) {
  // Escape leading markdown syntax so a paragraph is never mistaken for a
  // heading, list item, blockquote or table row.
  return text.replace(/^(#{1,6}(?=\s|$)|>(?=\s|$)|\d+\.(?=\s|$)|[-*+](?=\s|$)|\|)/, '\\$&');
}

function wrapUrl(url) {
  return /[\s()]/.test(url) ? '<' + url + '>' : url;
}

// --- Metadata collection (frontmatter + JSON-LD) ---------------------------

function collectMeta(root, pageUrl) {
  const found = {
    titleMeta: '', titleOg: '', titleTag: '',
    descMeta: '', descOg: '', imageOg: '', imageTw: '',
    jsonld: []
  };

  const visit = (node) => {
    for (const child of node.children) {
      if (child.type !== 'element') continue;
      if (child.name === 'meta') {
        const key = (child.attrs.name || child.attrs.property || '').toLowerCase();
        const content = child.attrs.content || '';
        if (!content) continue;
        if (key === 'title' && !found.titleMeta) found.titleMeta = content;
        else if (key === 'og:title' && !found.titleOg) found.titleOg = content;
        else if (key === 'description' && !found.descMeta) found.descMeta = content;
        else if (key === 'og:description' && !found.descOg) found.descOg = content;
        else if (key === 'og:image' && !found.imageOg) found.imageOg = resolveUrl(content, pageUrl);
        else if (key === 'twitter:image' && !found.imageTw) found.imageTw = resolveUrl(content, pageUrl);
      } else if (child.name === 'title') {
        const text = collectRawText(child).trim();
        if (text && !found.titleTag) found.titleTag = text;
      } else if (child.name === 'script' && (child.attrs.type || '').toLowerCase() === 'application/ld+json') {
        for (const c of child.children) {
          if (c.type !== 'rawtext') continue;
          const raw = c.text.trim();
          if (!raw) continue;
          try {
            found.jsonld.push(JSON.stringify(JSON.parse(raw)));
          } catch {
            found.jsonld.push(raw);
          }
        }
      }
      visit(child);
    }
  };
  visit(root);

  return {
    // Standard <meta name> wins over Open Graph, matching the Cloudflare spec.
    title: found.titleMeta || found.titleOg || found.titleTag,
    description: found.descMeta || found.descOg,
    image: found.imageOg || found.imageTw,
    jsonld: found.jsonld
  };
}

// --- Renderer --------------------------------------------------------------

class Renderer {
  constructor(pageUrl) {
    this.pageUrl = pageUrl;
    this.blocks = [];
    this.current = '';
    this.listDepth = 0;
  }

  appendText(text) {
    let s = text.replace(/\s+/g, ' ');
    if (!s) return;
    if (/^\s/.test(s) && (this.current === '' || /[ \n]$/.test(this.current))) {
      s = s.replace(/^ +/, '');
    }
    if (s === ' ') {
      if (this.current && !/[ \n]$/.test(this.current)) this.current += ' ';
      return;
    }
    this.current += s;
  }

  appendInline(s) {
    if (s) this.current += s;
  }

  flushCurrent() {
    if (this.current.trim()) {
      this.blocks.push(this.current.trim().replace(/[ \t]+$/gm, ''));
    }
    this.current = '';
  }

  addBlock(text) {
    this.flushCurrent();
    const trimmed = text.trim();
    if (trimmed) this.blocks.push(trimmed);
  }

  // Block-flow rendering of one node.
  render(node) {
    if (node.type === 'text') { this.appendText(node.text); return; }
    if (node.type === 'rawtext') return;
    const name = node.name;
    if (STRIP_WITH_CONTENT.has(name)) return;

    switch (name) {
      case 'h1': case 'h2': case 'h3':
      case 'h4': case 'h5': case 'h6': {
        const text = this.renderInlineChildren(node).trim();
        if (text) this.addBlock('#'.repeat(Number(name[1])) + ' ' + escapeBlockStart(text));
        return;
      }
      case 'p': {
        const text = this.renderInlineChildren(node).trim();
        if (text) this.addBlock(escapeBlockStart(text));
        return;
      }
      case 'ul': this.renderList(node, false); return;
      case 'ol': this.renderList(node, true); return;
      case 'blockquote': this.renderBlockquote(node); return;
      case 'pre': this.renderPre(node); return;
      case 'hr': this.addBlock('---'); return;
      case 'table': this.renderTable(node); return;
      case 'dt': {
        const text = this.renderInlineChildren(node).trim();
        if (text) this.addBlock('**' + escapeBlockStart(text) + '**');
        return;
      }
      case 'dd': {
        const text = this.renderInlineChildren(node).trim();
        if (text) this.addBlock(': ' + escapeBlockStart(text));
        return;
      }
      default:
        if (INLINE_ELEMENTS.has(name)) this.appendInline(this.renderInline(node));
        else this.renderContainer(node);
    }
  }

  // Container with mixed block/inline children (div, section, body, li, ...).
  renderContainer(node) {
    for (const child of node.children) {
      if (child.type === 'text') { this.appendText(child.text); continue; }
      if (child.type === 'rawtext') continue;
      if (STRIP_WITH_CONTENT.has(child.name)) continue;
      if (BLOCK_LEVEL.has(child.name)) {
        this.flushCurrent();
        this.render(child);
      } else {
        this.appendInline(this.renderInline(child));
      }
    }
    this.flushCurrent();
  }

  // Inline rendering of one node; returns a markdown string.
  renderInline(node) {
    if (node.type === 'text') return escapeMdText(node.text.replace(/\s+/g, ' '));
    if (node.type === 'rawtext') return '';
    const name = node.name;
    if (STRIP_WITH_CONTENT.has(name)) return '';

    switch (name) {
      case 'a': return this.renderLink(node);
      case 'img': return this.renderImage(node);
      case 'br': return '\n';
      case 'strong': case 'b': {
        const t = this.renderInlineChildren(node);
        return t ? '**' + t + '**' : '';
      }
      case 'em': case 'i': {
        const t = this.renderInlineChildren(node);
        return t ? '*' + t + '*' : '';
      }
      case 'code': {
        const t = this.renderInlineChildren(node).replace(/`/g, '');
        return t ? '`' + t + '`' : '';
      }
      case 'del': case 's': case 'strike': {
        const t = this.renderInlineChildren(node);
        return t ? '~~' + t + '~~' : '';
      }
      default:
        return this.renderInlineChildren(node);
    }
  }

  renderInlineChildren(node) {
    let out = '';
    for (const child of node.children) {
      if (child.type === 'text') out += escapeMdText(child.text.replace(/\s+/g, ' '));
      else out += this.renderInline(child);
    }
    return out
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .trim();
  }

  renderLink(node) {
    const text = this.renderInlineChildren(node);
    const href = (node.attrs.href || '').trim();
    if (!href || /^(javascript|data):/i.test(href)) return text;
    const url = resolveUrl(href, this.pageUrl);
    const label = text || url;
    return '[' + label + '](' + wrapUrl(url) + ')';
  }

  renderImage(node) {
    const src = (node.attrs.src || '').trim();
    if (!src || src.startsWith('data:')) return '';
    const url = resolveUrl(src, this.pageUrl);
    const alt = (node.attrs.alt || '').replace(/[[\]]/g, '');
    return '![' + alt + '](' + wrapUrl(url) + ')';
  }

  renderList(node, ordered) {
    this.flushCurrent();
    const indent = '  '.repeat(Math.max(0, this.listDepth));
    let counter = 1;
    const start = parseInt(node.attrs.start, 10);
    if (Number.isFinite(start) && start > 0) counter = start;

    const lines = [];
    for (const child of node.children) {
      if (child.type !== 'element' || child.name !== 'li') continue;
      // The sub-renderer's output is placed after this item's marker, so it
      // inherits our list depth (nested lists align to the content column).
      const sub = new Renderer(this.pageUrl);
      sub.listDepth = this.listDepth;
      sub.renderContainer(child);
      const blocks = sub.blocks.length ? sub.blocks : [''];
      const marker = ordered ? counter++ + '. ' : '- ';
      lines.push(indent + marker + blocks[0]);
      const pad = indent + ' '.repeat(marker.length);
      for (let i = 1; i < blocks.length; i++) {
        // Indent every line of multi-line continuation blocks (nested lists,
        // code fences, tables) to the item's content column.
        lines.push(blocks[i] ? pad + blocks[i].split('\n').join('\n' + pad) : '');
      }
    }
    // Tight list: items joined by single newlines, one block per list.
    if (lines.length) this.blocks.push(lines.join('\n'));
  }

  renderBlockquote(node) {
    this.flushCurrent();
    const sub = new Renderer(this.pageUrl);
    sub.listDepth = this.listDepth;
    sub.renderContainer(node);
    if (!sub.blocks.length) return;
    const parts = sub.blocks.map((b) => b.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n'));
    this.blocks.push(parts.join('\n>\n'));
  }

  renderPre(node) {
    this.flushCurrent();
    let lang = '';
    const own = (node.attrs.class || '').match(/language-([\w+#-]+)/i);
    if (own) {
      lang = own[1];
    } else {
      // <pre><code class="language-x"> is the common shape.
      for (const child of node.children) {
        if (child.type === 'element' && child.name === 'code') {
          const m = (child.attrs.class || '').match(/language-([\w+#-]+)/i);
          if (m) { lang = m[1]; break; }
        }
      }
    }
    const code = collectRawText(node).replace(/\r\n/g, '\n').replace(/\n+$/, '');
    if (code.trim()) this.blocks.push('```' + lang + '\n' + code + '\n```');
  }

  renderTable(node) {
    this.flushCurrent();
    const rows = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (c.type !== 'element') continue;
        if (c.name === 'tr') rows.push(this.renderRow(c));
        else if (c.name === 'thead' || c.name === 'tbody' || c.name === 'tfoot') walk(c);
      }
    };
    walk(node);
    if (!rows.length) return;

    const width = Math.max(...rows.map((r) => r.length), 1);
    const pad = (r) => { const c = r.slice(); while (c.length < width) c.push(''); return c; };
    const lines = [];
    lines.push('| ' + pad(rows[0]).join(' | ') + ' |');
    lines.push('| ' + pad(rows[0]).map(() => '---').join(' | ') + ' |');
    for (let i = 1; i < rows.length; i++) lines.push('| ' + pad(rows[i]).join(' | ') + ' |');
    this.blocks.push(lines.join('\n'));
  }

  renderRow(tr) {
    const cells = [];
    for (const c of tr.children) {
      if (c.type === 'element' && (c.name === 'td' || c.name === 'th')) {
        cells.push(this.renderInlineChildren(c).replace(/\|/g, '\\|'));
      }
    }
    if (!cells.length) cells.push(this.renderInlineChildren(tr).replace(/\|/g, '\\|'));
    return cells;
  }
}

// --- Public API ------------------------------------------------------------

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

export function htmlToMarkdown(html, pageUrl) {
  const tree = buildTree(tokenize(String(html)));
  const meta = collectMeta(tree, pageUrl);

  const renderer = new Renderer(pageUrl);
  const body = findFirstElement(tree, 'body') || tree;
  renderer.render(body);

  const bodyMd = renderer.blocks.join('\n\n').trim();
  if (!bodyMd && !meta.jsonld.length) return '';

  let out = '';
  const frontmatter = [];
  if (meta.title) frontmatter.push('title: ' + yamlScalar(meta.title));
  if (meta.description) frontmatter.push('description: ' + yamlScalar(meta.description));
  if (meta.image) frontmatter.push('image: ' + yamlScalar(meta.image));
  if (frontmatter.length) out += '---\n' + frontmatter.join('\n') + '\n---\n\n';

  if (bodyMd) out += bodyMd + '\n';

  if (meta.jsonld.length) {
    if (!out.endsWith('\n')) out += '\n';
    out += '\n```json\n' + meta.jsonld.join('\n') + '\n```\n';
  }
  return out;
}
