(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const send = btns.find(b => /发送|send/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.title || '') + ' ' + String(b.className || '')));
  if (send) { send.click(); return 'clicked send: ' + (send.getAttribute('aria-label') || String(send.className).slice(0, 40)); }
  const ed = document.querySelector('.tiptap.ProseMirror');
  if (!ed) return 'no editor';
  ed.focus();
  ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  return 'enter dispatched';
})()