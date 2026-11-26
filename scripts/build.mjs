import { readFile, writeFile, mkdir, cp, readdir, rm, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const content = path.join(root, 'content');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const string = (v) => typeof v === 'string' && v.trim().length > 0;
const shortHash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 8);
const exists = async (filePath) => { try { await access(filePath); return true; } catch { return false; } };
const safeJsonForHtml = (value) => JSON.stringify(value)
  .replace(/<\//g, '<\\/')
  .replace(/<!--/g, '<\\!--')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

export function parseChapter(source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const [heading, ...rest] = normalized.split('\n');
  assert(/^#\s+\S/.test(heading), '章节第一行必须是 # 标题');
  const blocks = rest.join('\n').trim().split(/\n\s*\n/).filter(Boolean).map((s) => {
    const text = s.trim();
    if (text.startsWith('![')) {
      const image = text.match(/^!\[([^\]\r\n]+)\]\(([a-z0-9][a-z0-9-]*\.(?:webp|png|jpe?g))\)$/);
      assert(image, '插图需使用 ![说明](本地图片文件名.webp)，不能使用外部或越界路径');
      return { type: 'image', alt: image[1], src: image[2] };
    }
    if (/^---+$/.test(text)) return { type: 'hr', text: '' };
    if (/^##\s/.test(text)) return { type: 'heading', text: text.replace(/^##\s+/, '') };
    if (/^>\s?/.test(text)) return { type: 'quote', text: text.replace(/^>\s?/gm, '').replace(/\n/g, ' ') };
    return { type: 'paragraph', text: text.replace(/\n/g, ' ') };
  });
  assert(blocks.some(b => b.type === 'paragraph' && string(b.text)), '章节不能没有正文');
  const wordCount = [...blocks.map(b => b.text || '').join('').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\s/g, '')].length;
  return { title: heading.replace(/^#\s+/, ''), blocks, wordCount };
}

async function build() {
  const catalog = [];
  const chapterOutputs = [];
  const bookIds = new Set();
  for (const entry of (await readdir(content, { withFileTypes: true })).filter(d => d.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
    const dir = path.join(content, entry.name);
    const book = JSON.parse((await readFile(path.join(dir, 'book.json'), 'utf8')).replace(/^\uFEFF/, ''));
    assert(idPattern.test(book.id) && book.id === entry.name && !bookIds.has(book.id), `书籍 ID 无效或重复: ${entry.name}`);
    bookIds.add(book.id);
    for (const field of ['title','author','subtitle','description','status','updated','cover']) assert(string(book[field]), `${book.id} 缺少 ${field}`);
    assert(['连载中','已完结'].includes(book.status), `${book.id} status 必须为连载中或已完结`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(book.updated) && !Number.isNaN(Date.parse(book.updated)), `${book.id} 日期无效`);
    assert(Array.isArray(book.tags) && book.tags.every(string), `${book.id} 标签无效`);
    assert(Array.isArray(book.chapters) && book.chapters.length > 0, `${book.id} 没有章节`);
    assert(/^[a-z0-9][a-z0-9-]*\.(?:svg|webp|png|jpe?g)$/.test(book.cover), `${book.id} 书封路径无效`);
    await readFile(path.join(root, 'assets', book.cover));
    const ids = new Set();
    const chapters = [];
    for (const ch of book.chapters) {
      assert(idPattern.test(ch.id) && !ids.has(ch.id), `${book.id} 章节 ID 无效或重复`);
      ids.add(ch.id);
      assert(string(ch.file) && /^[a-zA-Z0-9_-]+\.md$/.test(ch.file), `${book.id} 章节文件路径无效`);
      const parsed = parseChapter(await readFile(path.join(dir, ch.file), 'utf8'));
      for (const block of parsed.blocks.filter(b => b.type === 'image')) {
        const dimensions = book.images?.[block.src];
        assert(dimensions && Number.isInteger(dimensions.width) && Number.isInteger(dimensions.height) && dimensions.width > 0 && dimensions.height > 0, `${book.id} 插图 ${block.src} 缺少有效长宽`);
        await readFile(path.join(root, 'assets', block.src));
        block.width = dimensions.width;
        block.height = dimensions.height;
        if (await exists(path.join(root, 'assets', 'inline', block.src))) {
          block.thumb = `inline/${block.src}`;
        }
      }
      chapters.push({ id: ch.id, title: parsed.title, wordCount: parsed.wordCount });
      chapterOutputs.push({ file: path.join(out, 'data', book.id, `${ch.id}.json`), data: { id: ch.id, ...parsed } });
    }
    const { images: _images, ...bookMeta } = book;
    const catalogEntry = { ...bookMeta, chapters, wordCount: chapters.reduce((n,c) => n+c.wordCount, 0) };
    if (await exists(path.join(root, 'assets', 'covers', book.cover))) {
      catalogEntry.coverThumb = `covers/${book.cover}`;
    }
    catalog.push(catalogEntry);
  }
  assert(catalog.length > 0, '书架不能为空');
  // out is a fixed child of this repository, never a caller-supplied path.
  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, 'data'), { recursive: true });
  await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });

  const [storageSrc, appSrc, styleSrc, indexHtml] = await Promise.all([
    readFile(path.join(root, 'assets', 'storage.js'), 'utf8'),
    readFile(path.join(root, 'assets', 'app.js'), 'utf8'),
    readFile(path.join(root, 'assets', 'style.css'), 'utf8'),
    readFile(path.join(root, 'index.html'), 'utf8'),
  ]);
  const storageBody = storageSrc.replace(/^\uFEFF/, '').replace(/^export\s+/gm, '');
  const appBody = appSrc.replace(/^\uFEFF/, '').replace(/^\s*import\s+\{[^}]+\}\s+from\s+['"]\.\/storage\.js['"];?\r?\n?/, '');
  const bundleJs = `(() => {\n'use strict';\n${storageBody}\n${appBody}\n})();\n`;
  const jsHash = shortHash(bundleJs);
  const cssHash = shortHash(styleSrc);
  await writeFile(path.join(out, 'assets', `bundle.${jsHash}.js`), bundleJs);
  await writeFile(path.join(out, 'assets', `style.${cssHash}.css`), styleSrc);

  const bootHead = [
    '<script>',
    '(()=>{const o="https://zoe843.github.io/rainbloom-novels/";',
    'if(location.protocol==="file:"){const t=o+location.hash;document.addEventListener("DOMContentLoaded",()=>{const m=document.querySelector(".loading > p"),a=document.querySelector(".loading a");if(m)m.textContent="正在打开在线书阁…";if(a)a.href=t;});location.replace(t);return;}',
    'const m=location.hash.match(/^#\\/?read\\/([a-z0-9]+(?:-[a-z0-9]+)*)\\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);',
    'if(m){window.__preloadChapter={key:m[1]+"/"+m[2],promise:fetch("./data/"+m[1]+"/"+m[2]+".json")};}',
    'window.__bookLoadFail=()=>{const main=document.querySelector("#main");if(!main)return;const box=document.createElement("div");box.className="empty";const h=document.createElement("h2");h.textContent="书阁暂时没有打开";const p=document.createElement("p");p.textContent="阅读脚本没有加载成功，请检查网络后重新加载。";const b=document.createElement("button");b.className="button secondary";b.textContent="重新加载";b.addEventListener("click",()=>location.reload());box.append(h,p,b);main.replaceChildren(box);};',
    '})();',
    '</script>',
    `<script defer src="./assets/bundle.${jsHash}.js" onerror="window.__bookLoadFail&&window.__bookLoadFail()"></script>`,
  ].join('');
  const builtHtml = indexHtml
    .replace('./assets/style.css', `./assets/style.${cssHash}.css`)
    .replace('<script defer src="./assets/entry.js"></script>', bootHead)
    .replace('</body>', `<script id="catalog-data" type="application/json">${safeJsonForHtml(catalog)}</script>\n</body>`);
  await writeFile(path.join(out, 'index.html'), builtHtml);
  await writeFile(path.join(out, '.nojekyll'), '');
  await writeFile(path.join(out, 'data', 'catalog.json'), JSON.stringify(catalog));
  for (const ch of chapterOutputs) {
    await mkdir(path.dirname(ch.file), { recursive: true });
    await writeFile(ch.file, JSON.stringify(ch.data));
  }
  console.log(`Built ${catalog.length} books, ${chapterOutputs.length} chapters, ${catalog.reduce((n,b)=>n+b.wordCount,0)} characters → dist`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().catch(error => { console.error(error.message); process.exitCode = 1; });
}
