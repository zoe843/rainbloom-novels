// A classic bootstrap also runs when this source file is opened by double-click.
// Browser modules and chapter fetches need HTTP(S), so file URLs use the live site.
(() => {
  const online = 'https://zoe843.github.io/rainbloom-novels/';
  if (window.location.protocol === 'file:') {
    const target = online + window.location.hash;
    const message = document.querySelector('.loading > p');
    const link = document.querySelector('.loading a');
    if (message) message.textContent = '正在打开在线书阁…';
    if (link) link.href = target;
    window.location.replace(target);
    return;
  }
  import('./app.js').catch(() => {
    const main = document.querySelector('#main');
    const box = document.createElement('div');
    box.className = 'empty';
    const title = document.createElement('h2');
    title.textContent = '书阁暂时没有打开';
    const message = document.createElement('p');
    message.textContent = '阅读脚本没有加载成功，请检查网络后重新加载。';
    const retry = document.createElement('button');
    retry.className = 'button secondary';
    retry.textContent = '重新加载';
    retry.addEventListener('click', () => window.location.reload());
    box.append(title, message, retry);
    main.replaceChildren(box);
  });
})();
