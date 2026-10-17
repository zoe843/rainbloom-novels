import { defaults, getState, persist, setSettings, saveRecord, addBookmark, removeBookmark, importState } from './storage.js';

const $ = (selector, root=document) => root.querySelector(selector);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  search:'<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4 4"/>',
  book:'<path d="M3 4h6a4 4 0 0 1 3 1.5A4 4 0 0 1 15 4h6v15h-6a4 4 0 0 0-3 1.5A4 4 0 0 0 9 19H3zM12 6v14"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12M3 6h.1M3 12h.1M3 18h.1"/>',
  settings:'<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;
const main=$('#main');
const settingsDialog=$('#settings-dialog');
const tocDialog=$('#toc-dialog');
let catalog=[];
let reader=null;
let serial=0;
let toastTimer;
let saveTimer;
let scrollFrame;
let pendingAnchor=null;
const chapterCache=new Map();
$('.skip-link').addEventListener('click',e=>{e.preventDefault();main.focus();main.scrollIntoView();});
$('#mobile-toc').addEventListener('click',e=>{if(e.target.closest('a'))tocDialog.close();});

function toast(message) {
  const node=$('#toast');
  node.textContent=message; node.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{node.hidden=true;},3500);
}
window.addEventListener('reading-storage-failed',()=>toast('浏览器未允许保存，当前阅读位置暂时无法记住。'));
const bookById = (id) => catalog.find(b=>b.id===id);
const words = (n) => n>=10000?`${(n/10000).toFixed(1)} 万字`:`${n.toLocaleString('zh-CN')} 字`;
const shortDate = (s) => s.replace(/-/g,'.');
const readHref = (book, chapterId) => `#/read/${book.id}/${chapterId||book.chapters[0].id}`;
const bookHref = (book) => `#/book/${book.id}`;
const recordFor = (book) => {
  const record=getState().records[book.id];
  return record && book.chapters.some(c=>c.id===record.chapterId) ? record : null;
};
const continueHref = (book) => readHref(book,recordFor(book)?.chapterId);
const percentage = (book,record) => Math.round((book.chapters.findIndex(c=>c.id===record.chapterId)+record.ratio)/book.chapters.length*100);
const dateLabel = (timestamp) => new Date(timestamp).toLocaleDateString('zh-CN',{month:'long',day:'numeric'});
function button(href,text,type='solid') { return `<a class="button ${type}" href="${href}">${esc(text)}${icon('arrow')}</a>`; }
function tags(book) { return `<div class="book-tags">${book.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`; }
function backLink(href,text) { return `<a class="back-link" href="${href}">${icon('back')}${esc(text)}</a>`; }
function shell(content) { return `<div class="page-shell">${content}</div>`; }
function latestReading() {
  return catalog.filter(b=>recordFor(b)).sort((a,b)=>recordFor(b).updatedAt-recordFor(a).updatedAt)[0];
}
function card(book) {
  return `<article class="book-card"><a class="book-cover-link" href="${bookHref(book)}" aria-label="查看《${esc(book.title)}》简介与目录"><img class="book-cover" src="./assets/${esc(book.cover)}" width="480" height="660" alt="《${esc(book.title)}》书封"></a><div class="book-info"><div class="book-meta"><span>${esc(book.status)}</span><span>${words(book.wordCount)}</span>${book.sample?'<span class="sample">示例短篇</span>':''}</div><h3><a href="${bookHref(book)}">${esc(book.title)}</a></h3><p class="book-description">${esc(book.description)}</p>${tags(book)}<div class="book-bottom"><a class="read-link" href="${continueHref(book)}">${recordFor(book)?'继续阅读':'开始阅读'}${icon('arrow')}</a><time datetime="${esc(book.updated)}">${shortDate(book.updated)} 更新</time></div></div></article>`;
}
function renderShelf() {
  const latest=latestReading();
  const first=catalog.find(b=>b.id==='rain-before-dawn')||catalog[0];
  const current=latest||first;
  const record=recordFor(current);
  const chapter=record&&current.chapters.find(c=>c.id===record.chapterId);
  const shelfNote=catalog.some(b=>b.sample)?'标为“示例短篇”的故事，可以用来试试这间书阁的阅读体验。':'喜欢的故事，留在这里慢慢读完。';
  main.innerHTML=shell(`<section class="hero"><div class="hero-copy"><h1 class="hero-title">雨声在窗外，<br>故事在此处。</h1><p>把喜欢的故事收进花庭。<br>从上次停下的那一页，慢慢读下去。</p><div class="hero-note">今夜，读一个故事。</div></div><div class="continue-panel"><span class="small-label">${latest?'接着上次读':'从这里翻开'}</span><h2>${esc(current.title)}</h2><p>${chapter?`${esc(chapter.title)} · 已读 ${percentage(current,record)}%`:esc(current.subtitle)}</p>${button(continueHref(current),latest?'继续阅读':'开始阅读','')}</div></section><section aria-labelledby="shelf-title"><div class="section-bar"><div class="section-heading"><h2 id="shelf-title">我的书架</h2><span>${catalog.length} 本藏书</span></div><label class="search-wrap">${icon('search')}<input id="book-search" class="search-input" type="search" placeholder="找一本书、一种心情" aria-label="搜索书名、简介或题材" autocomplete="off"></label></div><div class="book-grid" id="book-grid">${catalog.map(card).join('')}</div><p id="search-result" class="sr-only" aria-live="polite"></p></section><div class="shelf-note"><p>${shelfNote}</p><a href="#/about">关于这间书阁</a></div>`);
  $('#book-search').addEventListener('input',(e)=>{
    const query=e.target.value.trim().toLocaleLowerCase();
    const books=catalog.filter(b=>[b.title,b.description,...b.tags].join(' ').toLocaleLowerCase().includes(query));
    $('#book-grid').innerHTML=books.length?books.map(card).join(''):'<div class="empty"><h2>还没有找到这本书</h2><p>换个书名或题材试试，也可以清空搜索看看全部藏书。</p><button class="button secondary" id="clear-search">查看全部</button></div>';
    $('#search-result').textContent=`找到 ${books.length} 本书`;
    $('#clear-search')?.addEventListener('click',()=>{const input=$('#book-search');input.value='';input.dispatchEvent(new Event('input'));input.focus();});
  });
}
function renderDetail(book) {
  const record=recordFor(book);
  main.innerHTML=shell(`${backLink('#/shelf','返回书架')}<section class="detail-hero"><div class="detail-cover"><img src="./assets/${esc(book.cover)}" width="480" height="660" alt="《${esc(book.title)}》书封"></div><div class="detail-content"><h1>${esc(book.title)}</h1><p class="detail-subtitle">${esc(book.subtitle)}</p><p class="detail-author">${esc(book.author)}<span aria-hidden="true">　</span>${esc(book.status)}<span aria-hidden="true">　</span>${words(book.wordCount)}</p>${tags(book)}<div class="detail-actions">${button(continueHref(book),record?'继续阅读':'开始阅读')}${record?button(readHref(book),'从头阅读','secondary'):''}</div></div><div class="detail-description-full"><p class="detail-description">${esc(book.description)}</p>${book.sample?'<p class="sample-note">这是一篇为书阁制作的 AI 示例短篇，用于体验阅读功能。</p>':''}</div></section><section aria-labelledby="catalog-title"><div class="section-bar"><div class="section-heading"><h2 id="catalog-title">章节目录</h2><span>共 ${book.chapters.length} 章</span></div><span class="small-label">${shortDate(book.updated)} 更新</span></div><ol class="chapter-list">${book.chapters.map(c=>`<li><a href="${readHref(book,c.id)}"><span>${esc(c.title)}${record?.chapterId===c.id?' <span class="reading-here">· 上次读到</span>':''}</span><small>${words(c.wordCount)}</small></a></li>`).join('')}</ol></section>`);
  if (record) {
    const firstLink=$('.detail-actions a.secondary');
    firstLink?.addEventListener('click',()=>{pendingAnchor={bookId:book.id,chapterId:book.chapters[0].id,record:{anchorIndex:0,anchorOffset:0,ratio:0}};});
  }
}
function renderHistory() {
  const books=catalog.filter(b=>recordFor(b)).sort((a,b)=>recordFor(b).updatedAt-recordFor(a).updatedAt);
  const marks=getState().bookmarks.filter(m=>bookById(m.bookId)?.chapters.some(c=>c.id===m.chapterId));
  main.innerHTML=shell(`<div class="page-heading"><h1>阅读记录</h1><p>故事读到了哪里，替你留在这里。</p></div><section class="history-section"><h2>最近读过</h2>${books.length?books.map(b=>{const r=recordFor(b),c=b.chapters.find(c=>c.id===r.chapterId);return `<article class="history-row"><a href="${bookHref(b)}" aria-label="${esc(b.title)}目录"><img src="./assets/${esc(b.cover)}" alt="" width="54" height="74"></a><div class="history-body"><h3><a href="${bookHref(b)}">${esc(b.title)}</a></h3><p>${esc(c.title)} · 已读 ${percentage(b,r)}% · ${dateLabel(r.updatedAt)}</p><div class="progress-track" aria-hidden="true"><span style="width:${percentage(b,r)}%"></span></div></div>${button(continueHref(b),'继续读','secondary')}</article>`;}).join(''):'<div class="history-empty">还没开始阅读。<a class="read-link" href="#/shelf">去书架翻开一本书</a>，下次会记得你读到的地方。</div>'}</section><section class="history-section"><h2>我的书签 <span class="small-label">${marks.length?marks.length:''}</span></h2>${marks.length?marks.map(m=>{const b=bookById(m.bookId),c=b.chapters.find(c=>c.id===m.chapterId);return `<article class="bookmark-row"><a href="${readHref(b,m.chapterId)}" data-bookmark="${esc(m.id)}"><h3>${esc(b.title)}<span class="small-label">　${esc(c.title)}</span></h3><p>${esc(m.excerpt)||'已保存的阅读位置'}</p></a><button class="icon-button" data-delete-bookmark="${esc(m.id)}" aria-label="删除《${esc(b.title)}》的这条书签">${icon('trash')}</button></article>`;}).join(''):'<p class="history-empty">读到想留下的地方，点阅读页右上角的书签。</p>'}</section><div class="record-tools"><button class="button secondary" id="export-records">导出阅读记录</button><button class="button secondary" id="import-records">导入阅读记录</button></div><p class="help-text">阅读进度、书签和设置只保存在当前浏览器，不会自动跨设备同步。<br>换设备或清理浏览器前，可以导出记录；在新设备导入即可继续读。</p>`);
  $$('[data-bookmark]').forEach(node=>node.addEventListener('click',()=>{
    const mark=getState().bookmarks.find(b=>b.id===node.dataset.bookmark);
    if (mark) pendingAnchor={bookId:mark.bookId,chapterId:mark.chapterId,record:{...mark,ratio:.5}};
  }));
  $$('[data-delete-bookmark]').forEach(node=>node.addEventListener('click',()=>{removeBookmark(node.dataset.deleteBookmark);renderHistory();toast('书签已删除');}));
  $('#export-records').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(getState(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=`花庭阅读记录-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('阅读记录已导出');
  });
  $('#import-records').addEventListener('click',()=>$('#import-file').click());
}
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
function renderAbout() {
  const samples=catalog.filter(b=>b.sample);
  const sampleNote=samples.length?`书架上的${samples.map(b=>`《${esc(b.title)}》`).join('、')}是为展示阅读体验创作的 AI 示例短篇。它们是这间书阁最初的住客，之后可以换成自己的故事。`:'这里的小说由站外创作、整理后放入书架。新章节会随故事的进展慢慢更新。';
  main.innerHTML=shell(`<div class="page-heading"><h1>关于书阁</h1><p>花庭里，一间留给故事的房间。</p></div><div class="about-content"><p class="quote">留一盏灯，读一个故事。</p><p>有些故事适合在夜里读。窗外有一点雨声，手边有一杯热茶，不用赶时间，也不必一口气读完。</p><p>这间书阁收着 AI 写下的小说。故事在别处慢慢写好，再被放到这里。你只需要挑一本，翻开，然后在喜欢的地方停一会儿。</p><h2>关于这些故事</h2><p>${sampleNote}</p><h2>替你记住读到哪里</h2><p>阅读时会自动保存章节与位置。字号、行距、正文宽度、字体和阅读底色都可以调整；喜欢的段落旁，也可以留下一枚书签。</p><p>这些记录只保存在当前浏览器。换手机或电脑时，可以在<a href="#/history">阅读记录</a>中导出，再到另一台设备导入。清理浏览器数据前也建议留一份备份。</p><h2>回到花庭</h2><p>小说读累了，也可以回到<a href="https://rainbloom.xin/">雨落花庭</a>坐坐，看看随笔、照片和最近的日常。</p></div>`);
}
function renderError(message, retry=false) {
  main.innerHTML=shell(`<div class="empty"><h2>这一页暂时没有打开</h2><p>${esc(message)}</p>${retry?'<button class="button secondary" id="retry-page">重新加载</button>':button('#/shelf','回到书架','secondary')}</div>`);
  $('#retry-page')?.addEventListener('click',()=>route());
}
function toc(book,current) { return `<div class="toc-links">${book.chapters.map(c=>`<a href="${readHref(book,c.id)}"${c.id===current?' aria-current="page"':''}>${esc(c.title)}</a>`).join('')}</div>`; }
function applySettings() {
  const s=getState().settings;
  document.body.classList.toggle('paper',Boolean(reader)&&s.theme==='paper');
  const root=document.documentElement;
  root.style.setProperty('--reading-size',`${s.fontSize}px`);
  root.style.setProperty('--reading-leading',s.lineHeight);
  root.style.setProperty('--reading-width',`${s.width}px`);
  root.style.setProperty('--reading-font',s.font==='sans'?'var(--sans)':'var(--serif)');
}
function currentAnchor() {
  if (!reader) return null;
  const blocks=$$('[data-block]',reader.article);
  if (!blocks.length) return {anchorIndex:0,anchorOffset:0,ratio:0};
  const baseline=$('.reader-header').getBoundingClientRect().bottom+24;
  let index=0;
  for(let i=0;i<blocks.length;i++){if(blocks[i].getBoundingClientRect().top<=baseline)index=i;else break;}
  const rect=blocks[index].getBoundingClientRect();
  const total=document.documentElement.scrollHeight-window.innerHeight;
  return {anchorIndex:index,anchorOffset:Math.max(-2,Math.min(2,(baseline-rect.top)/Math.max(1,rect.height))),ratio:Math.max(0,Math.min(1,total>0?window.scrollY/total:0))};
}
function restoreAnchor(record) {
  if (!reader || !record || record.ratio===0) { window.scrollTo({top:0,behavior:'instant'});return; }
  const blocks=$$('[data-block]',reader.article);
  const target=blocks[Math.min(record.anchorIndex||0,blocks.length-1)];
  if (!target) return;
  const rect=target.getBoundingClientRect();
  const header=$('.reader-header').getBoundingClientRect().height;
  window.scrollTo({top:window.scrollY+rect.top+(record.anchorOffset||0)*rect.height-header-24,behavior:'instant'});
}
function updateReadingIndicator() {
  if (!reader?.ready) return;
  const anchor=currentAnchor();
  reader.lastAnchor=anchor;
  const ratio=Math.round(anchor.ratio*100);
  $('#chapter-progress').textContent=`本章 ${ratio}%`;
  $('#chapter-progress-bar').style.width=`${ratio}%`;
}
function saveCurrent() {
  if (!reader?.ready) return;
  const anchor=currentAnchor();
  reader.lastAnchor=anchor;
  saveRecord(reader.book.id,{chapterId:reader.chapter.id,...anchor,updatedAt:Date.now()});
}
async function renderReader(book,chapter,routeId) {
  main.innerHTML='<div class="loading"><span class="loading-moon" aria-hidden="true">☾</span><p>正在翻开这一章…</p></div>';
  let data;
  const key=`${book.id}/${chapter.id}`;
  try {
    if(chapterCache.has(key)) data=chapterCache.get(key);
    else {
      const response=await fetch(`./data/${book.id}/${chapter.id}.json`);
      if(!response.ok)throw new Error('chapter not found');
      data=await response.json();
      if(!Array.isArray(data.blocks))throw new Error('invalid chapter');
      chapterCache.set(key,data);
    }
  } catch {
    if(routeId===serial){document.body.classList.remove('reading','paper');renderError('章节暂时加载失败。检查网络后可以重新试一次。',true);}return;
  }
  if(routeId!==serial)return;
  document.body.classList.add('reading');
  const index=book.chapters.findIndex(c=>c.id===chapter.id);
  const previous=book.chapters[index-1],next=book.chapters[index+1];
  const content=data.blocks.map((b,i)=>{
    const attr=`data-block="${i}"`;
    if(b.type==='hr')return `<hr ${attr}>`;
    if(b.type==='heading')return `<h2 ${attr}>${esc(b.text)}</h2>`;
    if(b.type==='quote')return `<blockquote ${attr}>${esc(b.text)}</blockquote>`;
    return `<p ${attr}>${esc(b.text)}</p>`;
  }).join('');
  main.innerHTML=`<header class="reader-header"><div class="reader-header-left"><a class="reader-back" href="#/shelf" aria-label="返回书架">${icon('back')}书架</a><a class="reader-book-name" href="${bookHref(book)}" aria-label="查看《${esc(book.title)}》目录">${esc(book.title)}</a></div><div class="reader-header-actions"><button class="tool-button mobile-only" id="open-toc" aria-label="打开章节目录">${icon('list')}<span>目录</span></button><button class="tool-button" id="add-bookmark" aria-label="在当前位置添加书签">${icon('bookmark')}<span>书签</span></button><button class="tool-button" id="open-settings" aria-label="打开阅读设置">${icon('settings')}<span>设置</span></button></div></header><div class="reader-layout"><aside class="desktop-toc"><p class="small-label">章节目录</p><nav aria-label="章节目录">${toc(book,chapter.id)}</nav><p class="toc-summary">${esc(book.status)} · 共 ${book.chapters.length} 章<br>阅读位置会自动保存</p></aside><div class="reader-content"><article id="chapter-article"><header class="chapter-heading"><p>${esc(book.title)}</p><h1>${esc(chapter.title)}</h1><p class="chapter-info">第 ${index+1} / ${book.chapters.length} 章　${words(chapter.wordCount)}　约 ${Math.max(1,Math.ceil(chapter.wordCount/450))} 分钟</p></header><div class="chapter-text">${content}</div></article><div class="chapter-end"><span>${next?'这一章，先读到这里。':book.status==='已完结'?'故事完，灯还亮着。':'故事还在继续。'}</span><p>${next?'留一点余味，或继续翻下一章。':book.status==='已完结'?'谢谢你陪这个故事走到这里。':'下一章写好后，会放到这里。'}</p></div><nav class="chapter-navigation" aria-label="前后章节">${previous?button(readHref(book,previous.id),'上一章','secondary'):button(bookHref(book),'小说目录','secondary')}${next?button(readHref(book,next.id),'下一章'):button('#/shelf','回到书架','')}</nav></div></div><div class="reader-bottom"><div class="reader-position"><span>第 ${index+1} / ${book.chapters.length} 章</span><div class="progress-track" aria-hidden="true"><span id="chapter-progress-bar"></span></div><span id="chapter-progress">本章 0%</span></div><button class="text-button" id="back-to-top">回到章首</button></div>`;
  reader={book,chapter,article:$('#chapter-article'),ready:false,lastAnchor:null};
  applySettings();
  $('#mobile-toc').innerHTML=toc(book,chapter.id);
  $('#open-toc').addEventListener('click',()=>tocDialog.showModal());
  $('#open-settings').addEventListener('click',()=>{saveCurrent();syncSettingsForm();settingsDialog.showModal();});
  $('#add-bookmark').addEventListener('click',()=>{
    const anchor=currentAnchor();
    const existing=getState().bookmarks.some(b=>b.bookId===book.id&&b.chapterId===chapter.id&&b.anchorIndex===anchor.anchorIndex);
    if(existing){toast('这个段落已经留过书签了');return;}
    const block=data.blocks[anchor.anchorIndex];
    addBookmark({id:crypto.randomUUID(),bookId:book.id,chapterId:chapter.id,...anchor,excerpt:(block?.text||chapter.title).slice(0,80),updatedAt:Date.now()});
    toast('书签已留好，可在阅读记录中查看');
  });
  $('#back-to-top').addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
  let resume=recordFor(book);
  if(pendingAnchor?.bookId===book.id&&pendingAnchor.chapterId===chapter.id){resume=pendingAnchor.record;pendingAnchor=null;}
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(routeId!==serial||!reader)return;
  restoreAnchor(resume?.chapterId===chapter.id || !resume?.chapterId ? resume : null);
  reader.ready=true;
  updateReadingIndicator();saveCurrent();
}
function syncSettingsForm() {
  const s=getState().settings,form=$('#settings-form');
  form.elements.theme.value=s.theme;form.elements.font.value=s.font;
  form.elements.fontSize.value=s.fontSize;form.elements.lineHeight.value=s.lineHeight;form.elements.width.value=s.width;
  $('#font-size-value').textContent=`${s.fontSize} px`;
  $('#line-height-value').textContent=s.lineHeight.toFixed(1);
  $('#reading-width-value').textContent=`${s.width} px`;
}
function changeSettings(patch) {
  const anchor=reader?currentAnchor():null;
  if(reader)reader.ready=false;
  setSettings(patch);applySettings();syncSettingsForm();
  requestAnimationFrame(()=>{if(reader){restoreAnchor(anchor);reader.ready=true;updateReadingIndicator();saveCurrent();}});
}
$('#settings-form').addEventListener('submit',e=>e.preventDefault());
$('#settings-form').addEventListener('input',e=>{
  const {name,value}=e.target;
  if(!name)return;
  changeSettings({[name]:['fontSize','lineHeight','width'].includes(name)?Number(value):value});
});
$('#reset-settings').addEventListener('click',()=>{changeSettings({...defaults});toast('已恢复默认阅读设置');});
$$('[data-close]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{
  if(e.target!==dialog)return;
  const rect=dialog.getBoundingClientRect();
  if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();
}));
$('#import-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try {
    if(file.size>5*1024*1024)throw new Error('记录文件过大，请选择书阁导出的 JSON 文件。');
    const data=JSON.parse(await file.text());
    const saved=importState(data);if(location.hash==='#/history')renderHistory();
    toast(saved?'阅读记录已合并，较新的进度会保留':'记录已载入本次会话，但浏览器未允许保存。');
  } catch(error){toast(error instanceof SyntaxError?'文件格式不正确，请选择书阁导出的 JSON 文件。':error.message);}
  finally{e.target.value='';}
});
async function route() {
  saveCurrent();reader=null;clearTimeout(saveTimer);
  const routeId=++serial;
  main.setAttribute('aria-busy','true');
  settingsDialog.close();tocDialog.close();
  document.body.classList.remove('reading','paper');
  const parts=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
  const type=parts[0]||'shelf';
  $$('[data-nav]').forEach(a=>{if(a.dataset.nav===type||(type==='book'&&a.dataset.nav==='shelf'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title='书阁 · 雨落花庭';
  window.scrollTo({top:0,behavior:'instant'});
  if(type==='shelf'&&parts.length<=1)renderShelf();
  else if(type==='history'&&parts.length===1)renderHistory();
  else if(type==='about'&&parts.length===1)renderAbout();
  else if(type==='book'&&parts.length===2){const b=bookById(parts[1]);if(b){renderDetail(b);document.title=`${b.title} · 花庭书阁`;}else renderError('没有找到这本书，回书架看看其他故事吧。');}
  else if(type==='read'&&parts.length===3){const b=bookById(parts[1]),c=b?.chapters.find(c=>c.id===parts[2]);if(b&&c){document.title=`${c.title} · ${b.title}`;await renderReader(b,c,routeId);}else renderError('没有找到这一章，可以回书架重新打开小说。');}
  else renderError('这个地址没有对应的页面，可以回到书架重新选择。');
  if(routeId===serial){main.setAttribute('aria-busy','false');main.dataset.route=location.hash||'#/shelf';main.focus({preventScroll:true});}
}
window.addEventListener('hashchange',route);
window.addEventListener('scroll',()=>{
  if(!reader?.ready)return;
  if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=null;updateReadingIndicator();});
  clearTimeout(saveTimer);saveTimer=setTimeout(saveCurrent,250);
},{passive:true});
window.addEventListener('resize',()=>{
  if(!reader?.ready||settingsDialog.open)return;
  const anchor=reader.lastAnchor;reader.ready=false;
  requestAnimationFrame(()=>{if(reader){restoreAnchor(anchor);reader.ready=true;updateReadingIndicator();}});
});
window.addEventListener('pagehide',saveCurrent);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveCurrent();});
window.addEventListener('keydown',e=>{
  if(!reader||settingsDialog.open||tocDialog.open||e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName))return;
  const index=reader.book.chapters.findIndex(c=>c.id===reader.chapter.id);
  const next=e.key==='ArrowRight'?reader.book.chapters[index+1]:e.key==='ArrowLeft'?reader.book.chapters[index-1]:null;
  if(next){e.preventDefault();location.hash=readHref(reader.book,next.id).slice(1);}
});
async function boot() {
  try {
    const response=await fetch('./data/catalog.json');if(!response.ok)throw new Error();
    catalog=await response.json();if(!Array.isArray(catalog)||!catalog.length)throw new Error();
    // Put the opening story first without coupling later additions to folder order.
    catalog.sort((a,b)=>b.updated.localeCompare(a.updated)||(a.id==='rain-before-dawn'?-1:b.id==='rain-before-dawn'?1:a.title.localeCompare(b.title,'zh-CN')));
    await route();
  } catch {
    main.innerHTML=shell('<div class="empty"><h2>书架暂时没有打开</h2><p>检查网络后，再试一次。</p><button class="button secondary" id="retry-boot">重新加载</button></div>');
    $('#retry-boot').addEventListener('click',boot);
  }
}
boot();
