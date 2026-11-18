(() => {
  const target = 'Q版二次元兔子连体衣女孩插画';
  const all = Array.from(document.querySelectorAll('div,span,a,button'));
  const matches = all.filter(e => {
    const t = (e.innerText || '').trim();
    return t === target && e.offsetWidth > 0 && e.offsetHeight > 0;
  });
  if (!matches.length) return 'not found';
  const el = matches[matches.length - 1];
  el.click();
  return 'clicked ' + el.tagName + ' cls=' + String(el.className).slice(0, 60) + ' n=' + matches.length;
})()