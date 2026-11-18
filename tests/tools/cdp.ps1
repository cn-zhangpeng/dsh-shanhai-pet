# CDP helper: attach to Doubao via remote debugging and evaluate JS / screenshot.
# Usage:
#   pwsh -File cdp.ps1 -ExprFile script.js          (prints JSON result)
#   pwsh -File cdp.ps1 -Screenshot out.png
#   pwsh -File cdp.ps1 -Targets
param(
  [string]$ExprFile,
  [string]$Screenshot,
  [switch]$Targets,
  [string]$Upload,
  [string[]]$UploadFiles,
  [int]$Port = 9222
)

$ErrorActionPreference = "Stop"
try { Add-Type -AssemblyName System.Net.WebSockets.Client -ErrorAction Stop } catch { }
try { Add-Type -AssemblyName System.Net.WebSockets -ErrorAction Stop } catch { }

function Get-Targets {
  Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 5
}

function Get-PageWs {
  $targets = Get-Targets
  $page = $targets | Where-Object { $_.type -eq "page" -and $_.url -match "doubao-chat/chat" } | Select-Object -First 1
  if (-not $page) { $page = $targets | Where-Object { $_.type -eq "page" -and $_.url -notmatch "devtools|background" } | Select-Object -First 1 }
  if (-not $page) { throw "no page target" }
  return $page.webSocketDebuggerUrl
}

$script:nextId = 0
$script:ws = $null
$script:buf = New-Object byte[] 4194304

function Connect($url) {
  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([Uri]$url, [Threading.CancellationToken]::None).Wait()
  $script:ws = $ws
}

function Send($method, $params) {
  $script:nextId++
  $id = $script:nextId
  $msg = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
  $seg = [ArraySegment[byte]]::new($bytes)
  $script:ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
  while ($true) {
    $sb = New-Object System.Text.StringBuilder
    do {
      $seg = [ArraySegment[byte]]::new($script:buf)
      $r = $script:ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).Result
      $sb.Append([Text.Encoding]::UTF8.GetString($script:buf, 0, $r.Count)) | Out-Null
    } while (-not $r.EndOfMessage)
    $obj = $sb.ToString() | ConvertFrom-Json
    if ($obj.id -eq $id) {
      if ($obj.error) { throw ("CDP error: " + ($obj.error | ConvertTo-Json -Compress)) }
      return $obj.result
    }
  }
}

if ($Targets) {
  Get-Targets | Select-Object type, url, title, id, webSocketDebuggerUrl | Format-List | Out-String
  exit 0
}

Connect (Get-PageWs)

if ($Screenshot) {
  Send "Page.enable" @{}  | Out-Null
  Start-Sleep -Milliseconds 300
  $res = Send "Page.captureScreenshot" @{ format = "png" }
  [IO.File]::WriteAllBytes($Screenshot, [Convert]::FromBase64String($res.data))
  "screenshot saved: $Screenshot"
  exit 0
}

if ($Upload) {
  $doc = Send "DOM.getDocument" @{ depth = 1 }
  $q = Send "DOM.querySelector" @{ nodeId = $doc.root.nodeId; selector = $Upload }
  if (-not $q.nodeId) { throw ("selector not found: " + $Upload) }
  Send "DOM.setFileInputFiles" @{ nodeId = $q.nodeId; files = @($UploadFiles) } | Out-Null
  "uploaded: $($UploadFiles -join ', ') -> nodeId $($q.nodeId)"
  exit 0
}

if ($ExprFile) {
  $expr = [IO.File]::ReadAllText((Resolve-Path $ExprFile), [Text.Encoding]::UTF8)
  $res = Send "Runtime.evaluate" @{ expression = $expr; awaitPromise = $true; returnByValue = $true; userGesture = $true }
  if ($res.exceptionDetails) {
    "EXCEPTION: " + ($res.exceptionDetails | ConvertTo-Json -Depth 10 -Compress)
    exit 2
  }
  $val = $res.result.value
  if ($null -eq $val) { $val = $res.result.description }
  if ($val -is [string]) { $val } else { $val | ConvertTo-Json -Depth 20 }
  exit 0
}

throw "nothing to do: pass -ExprFile, -Screenshot, or -Targets"
