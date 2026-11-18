param(
  [string]$Only = ""
)

$ErrorActionPreference = "Stop"
$tools = "E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\tools"
$inbox = "E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\new-frames\inbox"
Set-Location $tools
New-Item -ItemType Directory -Force -Path $inbox | Out-Null

$actions = @(
  @{ n = "gaze";     p = "同一个角色（参考图里的白兔耳兜帽小女孩）。画她站着微微仰头望向远方，一只手搭在额头上遮光远眺，风吹动裙摆和发丝，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，线条柔和，适合做桌面宠物望山动作帧。" },
  @{ n = "divine";   p = "同一个角色。画她盘腿坐在小凳上，双手抬起在胸前掐诀推算，眉头微蹙，眼睛半闭，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物掐指推算动作帧。" },
  @{ n = "earperk";  p = "同一个角色。画她坐着，白色兔耳朵高高竖起并向一侧倾斜，身体微微前倾，睁大眼睛侧耳倾听，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物竖耳倾听动作帧。" },
  @{ n = "unroll";   p = "同一个角色。画她双手展开一卷展开的卷轴书卷，低头认真阅读，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物展卷阅读动作帧。" },
  @{ n = "grindink"; p = "同一个角色。画她跪坐在矮桌前，双手握墨锭在砚台上磨墨，低着头专注，桌上铺着宣纸，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物磨墨动作帧。" },
  @{ n = "ridewind"; p = "同一个角色。画她张开双臂御风而行的站姿，衣摆和发丝向后飘动，脚边有一缕淡青色风纹，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物御风动作帧。" },
  @{ n = "sniff";    p = "同一个角色。画她微微踮脚、鼻子轻嗅，一绺发丝和耳朵朝风向歪，眼睛亮亮的，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物嗅风动作帧。" },
  @{ n = "chess";    p = "同一个角色。画她坐在棋盘前，手捏一枚棋子正要落下，微微歪头思考，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物摆棋动作帧。" },
  @{ n = "lantern";  p = "同一个角色。画她双手捧着一盏暖黄色小灯笼，暖光映在脸上，安静地微笑，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物点灯动作帧。" },
  @{ n = "tailhug";  p = "同一个角色。画她坐下来抱住自己毛绒绒的白色兔尾巴，脸轻轻靠在尾巴上，安安静静地出神，全身正面立绘，浅米色干净背景，Q版二次元软水彩风格，适合做桌面宠物抱尾动作帧。" }
)

$seen = @{}
function Get-Imgs {
  $raw = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\cdp.ps1 -ExprFile .\list-imgs.js
  return ($raw | ConvertFrom-Json)
}
function Log($m) { $line = "$(Get-Date -Format 'HH:mm:ss') $m"; $line | Out-Host; Add-Content -Path "$inbox\..\gen.log" -Value $line -Encoding UTF8 }

foreach ($im in (Get-Imgs)) { $seen[$im.src.Split('?')[0]] = $true }

$queue = $actions
if ($Only) { $queue = $actions | Where-Object { $_.n -eq $Only } }

foreach ($a in $queue) {
  $name = $a.n; $prompt = $a.p
  $target = Join-Path $inbox "$name.png"
  if (Test-Path $target) { Log "skip $name (exists)"; continue }

  $textJson = $prompt | ConvertTo-Json -Compress
  $js = "(() => { const TEXT = $textJson; const ed = document.querySelector('.tiptap.ProseMirror'); if (!ed) return 'no editor'; ed.focus(); const sel = window.getSelection(); const range = document.createRange(); range.selectNodeContents(ed); range.collapse(false); sel.removeAllRanges(); sel.addRange(range); const ok = document.execCommand('insertText', false, TEXT); return JSON.stringify({ ok, len: (ed.innerText||'').length }); })()"
  [IO.File]::WriteAllText("$tools\_type.js", $js, (New-Object System.Text.UTF8Encoding($false)))
  $typed = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\cdp.ps1 -ExprFile .\_type.js
  Log "type $name -> $typed"
  Start-Sleep -Milliseconds 500
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\cdp.ps1 -ExprFile .\send.js | Out-Null

  $got = $null
  for ($i = 0; $i -lt 18; $i++) {
    Start-Sleep -Seconds 7
    foreach ($im in (Get-Imgs)) {
      $key = $im.src.Split('?')[0]
      if ($seen.ContainsKey($key)) { continue }
      if ($im.w -lt 900 -or $im.h -lt 900) { continue }
      $got = $im; break
    }
    if ($got) { break }
  }
  if ($got) {
    try {
      Invoke-WebRequest -Uri $got.src -OutFile $target -TimeoutSec 60 -UseBasicParsing
      $seen[$got.src.Split('?')[0]] = $true
      Log "ok $name $($got.w)x$($got.h) -> $target ($((Get-Item $target).Length) bytes)"
    } catch { Log "download fail $name : $($_.Exception.Message)" }
  } else {
    Log "TIMEOUT $name"
    foreach ($im in (Get-Imgs)) { if ($im.w -ge 900) { $seen[$im.src.Split('?')[0]] = $true } }
  }
  Start-Sleep -Seconds 2
}
Log "DONE"
