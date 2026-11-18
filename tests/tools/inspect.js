(() => {
  const out = { url: location.href, title: document.title, inner: document.body ? document.body.innerText.slice(0, 600) : null, inputs: [], images: [], buttons: [] };
  document.querySelectorAll('input, textarea, [contenteditable="true"]').forEach((el, i) => {
    out.inputs.push({ i, tag: el.tagName, type: el.type || null, placeholder: el.getAttribute('placeholder') || null, ce: el.getAttribute('contenteditable'), cls: String(el.className).slice(0, 80), visible: !!(el.offsetWidth && el.offsetHeight) });
  });
  document.querySelectorAll('img').forEach((el, i) => {
    if (i < 30) out.images.push({ i, src: String(el.currentSrc || el.src).slice(0, 160), w: el.naturalWidth, h: el.naturalHeight });
  });
  document.querySelectorAll('button').forEach((el, i) => {
    if (i < 60) { const t = (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 20); if (t) out.buttons.push({ i, t }); }
  });
  return JSON.stringify(out);
})()