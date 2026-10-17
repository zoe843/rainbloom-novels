import { readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const content = path.join(root, 'content');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const string = (v) => typeof v === 'string' && v.trim().length > 0;

export function parseChapter(source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const [heading, ...rest] = normalized.split('\n');
  assert(/^#\s+\S/.test(heading), '章节第一行必须是 # 标题');
  const blocks = rest.join('\n').trim().split(/\n\s*\n/).filter(Boolean).map((s) => {
    const text = s.trim();
    if (/^---+$/.test(text)) return { type: 'hr', text: '' };
    if (/^##\s/.test(text)) return { type: 'heading', text: text.replace(/^##\s+/, '') };
    if (/^>\s?/.test(text)) return { type: 'quote', text: text.replace(/^>\s?/gm, '').replace(/\n/g, ' ') };
    return { type: 'paragraph', text: text.replace(/\n/g, ' ') };
  });
  assert(blocks.some(b => b.type === 'paragraph' && string(b.text)), '章节不能没有正文');
  const wordCount = [...blocks.map(b => b.text).join('').replace(/\s/g, '')].length;
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
    assert(/^[a-z0-9-]+\.svg$/.test(book.cover), `${book.id} 书封路径无效`);
    await readFile(path.join(root, 'assets', book.cover));
    const ids = new Set();
    const chapters = [];
    for (const ch of book.chapters) {
      assert(idPattern.test(ch.id) && !ids.has(ch.id), `${book.id} 章节 ID 无效或重复`);
      ids.add(ch.id);
      assert(string(ch.file) && /^[a-zA-Z0-9_-]+\.md$/.test(ch.file), `${book.id} 章节文件路径无效`);
      const parsed = parseChapter(await readFile(path.join(dir, ch.file), 'utf8'));
      chapters.push({ id: ch.id, title: parsed.title, wordCount: parsed.wordCount });
      chapterOutputs.push({ file: path.join(out, 'data', book.id, `${ch.id}.json`), data: { id: ch.id, ...parsed } });
    }
    catalog.push({ ...book, chapters, wordCount: chapters.reduce((n,c) => n+c.wordCount, 0) });
  }
  assert(catalog.length > 0, '书架不能为空');
  // out is a fixed child of this repository, never a caller-supplied path.
  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, 'data'), { recursive: true });
  await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
  await cp(path.join(root, 'index.html'), path.join(out, 'index.html'));
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
