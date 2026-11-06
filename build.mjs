// build.mjs — content/*.md + src/code/*.js  ->  situs statis (HTML, markdown mentah, llms.txt, index.json, sitemap)
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const SITE = 'https://makespritewithclaude.pages.dev';
const NAME = 'Make Sprite With Claude';
const TAGLINE = 'Teknik membuat sprite pixel art prosedural yang bagus — ditulis agar mudah dibaca dan ditiru oleh AI.';
const CATS = {
  rendering: { title: 'Teknik Rendering', desc: 'Dari render halus ke grid piksel, palet, dithering, buffer, sprite sheet.' },
  efek: { title: 'Efek (VFX)', desc: 'Tracer, ledakan, lubang, api, bola neutron & pulsar — semua prosedural.' },
  karakter: { title: 'Karakter Prosedural', desc: 'Menggambar karakter dari persamaan, bukan dari piksel manual.' },
  ai: { title: 'Panduan untuk AI', desc: 'Template prompt, aturan ketat, dan checklist agar hasil AI konsisten.' },
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (f) => fs.readFileSync(f, 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

// --- kode sumber: 1 file = 1 potongan; bundle = urut nama file
const codeFiles = fs.readdirSync('src/code').filter((f) => f.endsWith('.js')).sort();
const code = Object.fromEntries(codeFiles.map((f) => [f.replace(/\.js$/, ''), read('src/code/' + f).trim()]));
write('assets/px.js', codeFiles.map((f) => `/* ${f} */\n` + read('src/code/' + f)).join('\n'));

// --- artikel
const articles = fs.readdirSync('content').filter((f) => f.endsWith('.md')).map((f) => {
  const raw = read('content/' + f), m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
  return { slug: f.replace(/\.md$/, ''), ...meta, order: +meta.order, body: m[2].trim() };
}).sort((a, b) => a.order - b.order);

const tokens = (body, mode) => (mode === 'md' ? body.replace(/\]\(([\w-]+)\.html\)/g, `](${SITE}/md/$1.md)`) : body)
  .replace(/\{\{demo:([\w-]+)\}\}/g, (_, n) => mode === 'md' ? `> **Demo interaktif "${n}"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.` : `\n\n@@DEMO:${n}@@\n\n`)
  .replace(/\{\{code:([\w-]+)\}\}/g, (_, n) => {
    if (!code[n]) throw new Error('kode tidak ada: ' + n);
    return mode === 'md' ? `\n**Kode: \`src/code/${n}.js\`**\n\n\`\`\`js\n${code[n]}\n\`\`\`\n` : `\n\n@@CODE:${n}@@\n\n`;
  });

const toHtml = (a) => marked.parse(tokens(a.body, 'html'), { gfm: true })
  .replace(/<p>@@DEMO:([\w-]+)@@<\/p>/g, (_, n) => `<div class="demo" data-demo="${n}"><p class="nojs">Demo interaktif butuh JavaScript. Kode lengkap ada di bawah.</p></div>`)
  .replace(/<p>@@CODE:([\w-]+)@@<\/p>/g, (_, n) => `<details class="code" open><summary>Kode: <code>src/code/${n}.js</code></summary><pre><code class="language-js">${esc(code[n])}</code></pre></details>`);

const layout = ({ title, desc, url, body, depth, jsonld, md }) => {
  const r = '../'.repeat(depth);
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="stylesheet" href="${r}assets/site.css">
<link rel="alternate" type="text/plain" href="${SITE}/llms.txt" title="llms.txt">
${md ? `<link rel="alternate" type="text/markdown" href="${SITE}/${md}" title="Markdown">` : ''}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<header class="top"><a class="brand" href="${r}index.html"><span class="logo" aria-hidden="true"></span>${NAME}</a>
<nav aria-label="Navigasi"><a href="${r}index.html#rendering">Rendering</a><a href="${r}index.html#efek">Efek</a><a href="${r}index.html#karakter">Karakter</a><a href="${r}index.html#ai">Untuk AI</a></nav></header>
${body}
<footer><p>Akses mesin: <a href="${r}llms.txt">llms.txt</a> · <a href="${r}llms-full.txt">llms-full.txt</a> · <a href="${r}index.json">index.json</a> · <a href="${r}sitemap.xml">sitemap.xml</a> · <a href="https://github.com/kintil555/makespritewithclaude">GitHub</a></p></footer>
<script src="${r}assets/px.js"></script><script src="${r}assets/site.js"></script>
</body></html>`;
};

for (const [i, a] of articles.entries()) {
  const prev = articles[i - 1], next = articles[i + 1], url = `${SITE}/articles/${a.slug}.html`;
  const body = `<main><article>
<p class="crumb"><a href="../index.html#${a.category}">${CATS[a.category].title}</a></p>
<h1>${esc(a.title)}</h1><p class="lead">${esc(a.summary)}</p>
<p class="meta">Versi mentah untuk AI: <a href="../md/${a.slug}.md">md/${a.slug}.md</a></p>
${toHtml(a)}
<nav class="pn">${prev ? `<a href="${prev.slug}.html">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${next.slug}.html">${esc(next.title)} →</a>` : ''}</nav>
</article></main>`;
  write(`articles/${a.slug}.html`, layout({ title: `${a.title} — ${NAME}`, desc: a.summary, url, body, depth: 1, md: `md/${a.slug}.md`,
    jsonld: { '@context': 'https://schema.org', '@type': 'TechArticle', headline: a.title, description: a.summary, inLanguage: 'id', url, articleSection: CATS[a.category].title, author: { '@type': 'Person', name: 'kintil555' } } }));
  write(`md/${a.slug}.md`, `# ${a.title}\n\n> ${a.summary}\n\nKategori: ${CATS[a.category].title} · URL: ${url}\n\n${tokens(a.body, 'md')}\n`);
}

// --- beranda
const sections = Object.entries(CATS).map(([k, c]) => `<section id="${k}"><h2>${c.title}</h2><p>${c.desc}</p><ul class="cards">${articles.filter((a) => a.category === k).map((a) => `<li><a href="articles/${a.slug}.html"><strong>${esc(a.title)}</strong><span>${esc(a.summary)}</span></a></li>`).join('')}</ul></section>`).join('\n');
write('index.html', layout({ title: `${NAME} — sprite pixel prosedural`, desc: TAGLINE, url: SITE + '/', depth: 0, md: null,
  jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, description: TAGLINE, url: SITE, inLanguage: 'id' },
  body: `<main><section class="hero"><h1>Sprite pixel yang bagus, dibuat dengan kode.</h1><p class="lead">${TAGLINE}</p>
<div class="demo" data-demo="hires"><p class="nojs">Demo butuh JavaScript.</p></div></section>
<section class="ai"><h2>Untuk AI &amp; agen</h2><p>Semua konten tersedia sebagai teks bersih tanpa JavaScript:</p>
<ul><li><a href="llms.txt"><code>/llms.txt</code></a> — indeks ringkas + tautan markdown per artikel</li><li><a href="llms-full.txt"><code>/llms-full.txt</code></a> — seluruh isi + seluruh kode dalam 1 berkas</li><li><a href="index.json"><code>/index.json</code></a> — metadata mesin-terbaca</li><li><code>/md/&lt;slug&gt;.md</code> — tiap artikel dalam markdown</li></ul>
<p>Mulai dari <a href="articles/ai-prompt-playbook.html">Panduan prompt untuk AI</a>, lalu <a href="articles/hires-to-pixel.html">teknik inti</a>.</p></section>
${sections}</main>` }));

// --- berkas mesin
write('llms.txt', `# ${NAME}\n\n> ${TAGLINE} Semua sprite dibuat secara prosedural (kode, bukan gambar manual). Bahasa: Indonesia.\n\nCatatan: kode di situs ini adalah JavaScript murni tanpa dependensi, berjalan di browser. Baca llms-full.txt untuk seluruh isi sekaligus.\n\n${Object.entries(CATS).map(([k, c]) => `## ${c.title}\n\n${articles.filter((a) => a.category === k).map((a) => `- [${a.title}](${SITE}/md/${a.slug}.md): ${a.summary}`).join('\n')}`).join('\n\n')}\n\n## Optional\n\n- [llms-full.txt](${SITE}/llms-full.txt): seluruh artikel + kode\n- [index.json](${SITE}/index.json): metadata\n- [Repositori](https://github.com/kintil555/makespritewithclaude): sumber\n`);
write('llms-full.txt', `# ${NAME}\n\n> ${TAGLINE}\n\n` + articles.map((a) => read(`md/${a.slug}.md`)).join('\n\n---\n\n'));
write('index.json', JSON.stringify({ name: NAME, url: SITE, language: 'id', categories: CATS, articles: articles.map((a) => ({ slug: a.slug, title: a.title, category: a.category, summary: a.summary, html: `${SITE}/articles/${a.slug}.html`, markdown: `${SITE}/md/${a.slug}.md`, code: [...a.body.matchAll(/\{\{code:([\w-]+)\}\}/g)].map((m) => `${SITE}/src/code/${m[1]}.js`) })) }, null, 2));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[SITE + '/', ...articles.map((a) => `${SITE}/articles/${a.slug}.html`)].map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write('.nojekyll', '');
console.log(`ok: ${articles.length} artikel`);
