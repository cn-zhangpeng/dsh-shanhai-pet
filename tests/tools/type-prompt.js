(() => {
  const TEXT = '参考我上传的这张图里的角色：白兔耳兜帽、黑发齐刘海、粉色短裙、白靴、抱粉色小蚂蚁玩偶的小女孩。画她盘腿坐着、双手放在膝上、闭眼吐纳养神的全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，线条柔和，构图居中，适合做桌面宠物动作帧。';
  const ed = document.querySelector('.tiptap.ProseMirror');
  if (!ed) return 'no editor';
  ed.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(ed);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  const ok = document.execCommand('insertText', false, TEXT);
  const current = (ed.innerText || '').trim();
  return JSON.stringify({ ok, len: current.length, tail: current.slice(-80), hasText: current.includes('盘腿坐着') });
})()