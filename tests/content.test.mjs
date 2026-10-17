import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChapter } from '../scripts/build.mjs';

test('local illustrations preserve reading order without counting file names as prose', () => {
  const chapter=parseChapter('# 一\n\n前文。\n\n![凌晨两点](ditide-01.webp)\n\n后文。');
  assert.deepEqual(chapter.blocks.map(b=>b.type),['paragraph','image','paragraph']);
  assert.equal(chapter.blocks[1].src,'ditide-01.webp');
  assert.equal(chapter.blocks[1].alt,'凌晨两点');
  assert.equal(chapter.wordCount,6);
});

test('image syntax rejects remote URLs and parent traversal', () => {
  for(const source of ['../secret.webp','https://example.com/a.webp','/a.webp','javascript:alert(1)','a.svg','a.webp?x=1']) {
    assert.throws(()=>parseChapter(`# 一\n\n正文。\n\n![插图](${source})`),/插图需使用/);
  }
});

test('bold emphasis survives in source and does not inflate the prose count', () => {
  const chapter=parseChapter('# 一\n\n记录 **−31.4**。');
  assert.equal(chapter.blocks[0].text,'记录 **−31.4**。');
  assert.equal(chapter.wordCount,8);
});

test('Windows text and ordinary old chapters retain their paragraph structure', () => {
  const chapter=parseChapter('\ufeff# 旧章\r\n\r\n正文。\r\n\r\n> 一封信。\r\n\r\n---\r\n\r\n结尾。');
  assert.equal(chapter.title,'旧章');
  assert.deepEqual(chapter.blocks.map(b=>b.type),['paragraph','quote','hr','paragraph']);
});
