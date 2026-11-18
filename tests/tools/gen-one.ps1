param(
  [Parameter(Mandatory = $true)][string]$Name,
  [Parameter(Mandatory = $true)][string]$Prompt
)

$ErrorActionPreference = "Stop"
$tools = "E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\tools"
$inbox = "E:\Workspace\ProjectWorkspace\harness-plugin\dsh-shanhai-pet\tests\new-frames\inbox"
Set-Location $tools

function Get-Imgs {
  $raw = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\cdp.ps1 -ExprFile .\list-imgs.js
  return ($raw | ConvertFrom-Json)
}

$seen = @{}
foreach ($im in (Get-Imgs)) { $seen[$im.src.Split('?')[0]] = $true }

$textJson = $Prompt | ConvertTo-Json -Compress
$js = "(() => { const TEXT = $textJson; const ed = document.querySelector('.tiptap.ProseMirror'); if (!ed) return 'no editor'; ed.focus(); const sel = window.getSelection(); const range = document.createRange(); range.selectNodeContents(ed); range.collapse(false); sel.removeAllRanges(); sel.addRange(range); const ok = document.execCommand('insertText', false, TEXT); return JSON.stringify({ ok, len: (ed.innerText||'').length }); })()"
[IO.File]::WriteAllText("$tools\_type.js", $js, (New-Object System.Text.UTF8Encoding($false)))
$typed = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\cdp.ps1 -ExprFile .\_type.js
"typed: $typed"
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
  $target = Join-Path $inbox "$Name.png"
  Invoke-WebRequest -Uri $got.src -OutFile $target -TimeoutSec 60 -UseBasicParsing
  "ok $Name -> $target ($((Get-Item $target).Length) bytes)"
} else { "TIMEOUT $Name"; exit 1 }
