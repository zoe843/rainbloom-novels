const KEY = 'rainbloom-reading-v1';
export const defaults = { theme:'night', fontSize:21, lineHeight:2, width:720, font:'serif' };
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const finite = (n, min, max, fallback) => Number.isFinite(n) && n>=min && n<=max ? n : fallback;
const safeId = (s) => typeof s === 'string' && idPattern.test(s);
export function sanitize(input) {
  const result = { version:1, settings:{...defaults}, records:{}, bookmarks:[] };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  const s = input.settings || {};
  result.settings = { theme:s.theme==='paper'?'paper':'night', font:s.font==='sans'?'sans':'serif', fontSize:finite(s.fontSize,18,28,21), lineHeight:finite(s.lineHeight,1.6,2.4,2), width:finite(s.width,560,900,720) };
  if (input.records && typeof input.records==='object' && !Array.isArray(input.records)) {
    for (const [id,r] of Object.entries(input.records).slice(0,2000)) {
      if (!safeId(id) || !r || !safeId(r.chapterId)) continue;
      result.records[id] = { chapterId:r.chapterId, anchorIndex:Math.trunc(finite(r.anchorIndex,0,100000,0)), anchorOffset:finite(r.anchorOffset,-2,2,0), ratio:finite(r.ratio,0,1,0), updatedAt:finite(r.updatedAt,0,8640000000000000,0) };
    }
  }
  if (Array.isArray(input.bookmarks)) {
    const unique = new Set();
    result.bookmarks = input.bookmarks.slice(0,3000).filter(b=>b&&safeId(b.bookId)&&safeId(b.chapterId)&&typeof b.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(b.id)&&!unique.has(b.id)&&unique.add(b.id)).map(b=>({ id:b.id, bookId:b.bookId, chapterId:b.chapterId, anchorIndex:Math.trunc(finite(b.anchorIndex,0,100000,0)), anchorOffset:finite(b.anchorOffset,-2,2,0), excerpt:typeof b.excerpt==='string'?b.excerpt.slice(0,100):'', updatedAt:finite(b.updatedAt,0,8640000000000000,0) }));
  }
  return result;
}
let state;
let available = true;
try { state=sanitize(JSON.parse(localStorage.getItem(KEY))); }
catch { state=sanitize(null); }
export function getState() { return state; }
export function persist() {
  try { localStorage.setItem(KEY,JSON.stringify(state)); available=true; return true; }
  catch { if (available) window.dispatchEvent(new Event('reading-storage-failed')); available=false; return false; }
}
export function setSettings(patch) { state.settings=sanitize({settings:{...state.settings,...patch}}).settings; persist(); }
export function saveRecord(bookId, record) { state.records[bookId]=record; persist(); }
export function addBookmark(bookmark) { state.bookmarks.unshift(bookmark); persist(); }
export function removeBookmark(id) { state.bookmarks=state.bookmarks.filter(b=>b.id!==id); persist(); }
export function importState(input) {
  if (!input || input.version!==1 || typeof input.records!=='object' || !Array.isArray(input.bookmarks)) throw new Error('这不是书阁导出的阅读记录文件。');
  const next=sanitize(input);
  state.settings=next.settings;
  for (const [id,record] of Object.entries(next.records)) if (!state.records[id] || record.updatedAt>state.records[id].updatedAt) state.records[id]=record;
  const marks=new Map(state.bookmarks.map(b=>[b.id,b]));
  next.bookmarks.forEach(b=>{ if (!marks.has(b.id)) marks.set(b.id,b); });
  state.bookmarks=[...marks.values()].sort((a,b)=>b.updatedAt-a.updatedAt);
  return persist();
}
