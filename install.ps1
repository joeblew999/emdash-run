# Put the emdash-run harness in the current directory and bring EmDash up — Windows.
#   irm https://raw.githubusercontent.com/joeblew999/emdash-run/main/install.ps1 | iex
# Pick a template (default starter-cloudflare; `starter` is plain Node.js, no Cloudflare):
#   $env:EMDASH_TEMPLATE = "starter"; irm …/install.ps1 | iex
$ErrorActionPreference = "Stop"
if (-not (Get-Command mise -ErrorAction SilentlyContinue)) { Write-Host "x mise is not installed - get it first: https://mise.jdx.dev/getting-started.html"; exit 1 }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "x git is not installed"; exit 1 }
if (-not (Test-Path .git)) { git init -q }
Write-Host "-> fetching the harness into $(Get-Location)"
$archive = Join-Path $env:TEMP "emdash-harness.tar.gz"
Invoke-WebRequest -Uri "https://github.com/joeblew999/emdash-run/releases/latest/download/emdash-harness.tar.gz" -OutFile $archive
tar -xzf $archive
Remove-Item $archive
if (Test-Path mise.toml) {
  if (-not (Select-String -Path mise.toml -Pattern "^TEMPLATE" -Quiet)) {
    Write-Host "x you already have a mise.toml, and it has no EmDash settings."
    Write-Host "  copy the [env] block from nu/project.example.toml into it, then run: mise trust --all; mise run setup"
    exit 1
  }
} else {
  Copy-Item nu/project.example.toml mise.toml
  if ($env:EMDASH_TEMPLATE) { mise set "TEMPLATE=$($env:EMDASH_TEMPLATE)"; mise fmt }
  Write-Host "  ok mise.toml - your settings; edit it any time, then: mise run dev"
}
mise trust --all -q
Write-Host "-> mise run setup (a few minutes the first time)"
mise run setup
