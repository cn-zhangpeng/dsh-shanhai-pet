(() => {
  const seen = new Set();
  const out = [];
  for (const img of document.querySelectorAll('img')) {
    const src = img.currentSrc || img.src || '';
    if (!src.startsWith('http')) continue;
    if (img.naturalWidth < 200 || img.naturalHeight < 200) continue;
    const key = src.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ src, w: img.naturalWidth, h: img.naturalHeight });
  }
  return JSON.stringify(out);
})()