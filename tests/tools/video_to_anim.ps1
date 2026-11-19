param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Name,
  [ValidateSet('green', 'none')][string]$Bg = 'green',
  [int]$Fps = 14,
  [double]$Start = 0,
  [double]$Duration = 0
)

# Thin wrapper: locate a usable Python, then run video_to_anim.py.
# Kept ASCII-only so Windows PowerShell 5.1 always parses it correctly.
$ErrorActionPreference = 'Stop'

$candidates = @()
if ($env:DSH_PYTHON) { $candidates += $env:DSH_PYTHON }
$candidates += (Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe')
$candidates += 'python'

$python = $null
foreach ($candidate in $candidates) {
  if (-not $candidate) { continue }
  if ($candidate -eq 'python') {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -notlike '*WindowsApps*') { $python = $cmd.Source; break }
    continue
  }
  if (Test-Path $candidate) { $python = $candidate; break }
}

if (-not $python) {
  throw 'No usable Python found. Set $env:DSH_PYTHON or put python on PATH.'
}

$tool = Join-Path $PSScriptRoot 'video_to_anim.py'
& $python $tool -i $In -n $Name --bg $Bg --fps $Fps --start $Start --duration $Duration
exit $LASTEXITCODE
