$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Server = "201.51.12.133"
$User = "deploy"
$ProjectKeyPath = Join-Path $ProjectRoot ".deploy-keys\gamehubparty_deploy"
$HomeKeyPath = Join-Path $HOME ".ssh\gamehubparty_deploy"
$SourceKeyPath = if (Test-Path -LiteralPath $ProjectKeyPath) { $ProjectKeyPath } else { $HomeKeyPath }
$KeyPath = Join-Path $env:TEMP ("gamehubparty_deploy_current_" + [guid]::NewGuid().ToString("N"))
$Archive = Join-Path $env:TEMP "gamehubparty-current.tar.gz"
$PublicUrl = "https://gamehubparty.ru/admin?deploy_check=$(Get-Date -Format yyyyMMddHHmmss)"

function Invoke-NativeChecked {
  param([string]$FilePath, [string[]]$Arguments, [string]$ErrorMessage)
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$ErrorMessage (exit code $LASTEXITCODE)"
  }
}

Write-Host "Packing current local project..."
Copy-Item -LiteralPath $SourceKeyPath -Destination $KeyPath -Force
icacls $KeyPath /inheritance:r | Out-Null
icacls $KeyPath /grant:r "$($env:USERNAME):R" | Out-Null
Push-Location $ProjectRoot
try {
  Write-Host "Building frontend..."
  Invoke-NativeChecked "npm.cmd" @("run", "build") "Frontend build failed"
  if (Test-Path $Archive) { Remove-Item $Archive -Force }
  $includeItems = @(
    "package.json",
    "package-lock.json",
    "Dockerfile",
    "docker-compose.yml",
    ".dockerignore",
    "index.html",
    "vite.config.js",
    "src",
    "public",
    "dist",
    "server",
    "tools"
  )
  $existingItems = $includeItems | Where-Object { Test-Path (Join-Path $ProjectRoot $_) }
  Write-Host "Deploy archive includes: $($existingItems -join ', ')"
  $tarArgs = @("-czf", $Archive) + $existingItems
  Invoke-NativeChecked "tar" $tarArgs "Failed to create deploy archive"
}
finally {
  Pop-Location
}

$ArchiveB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Archive))
$RemoteTemplate = @'
#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="/tmp/gamehubparty-current.tar.gz"
ARCHIVE_B64="/tmp/gamehubparty-current.tar.gz.b64"
cat > "$ARCHIVE_B64" <<'B64EOF'
__ARCHIVE_B64__
B64EOF
base64 -d "$ARCHIVE_B64" > "$ARCHIVE"
rm -f "$ARCHIVE_B64"

APP_DIR="/home/deploy/apps/gamehubparty"
RELEASE="$APP_DIR/releases/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$APP_DIR/releases" "$APP_DIR/shared"
mkdir -p "$RELEASE"
tar -xzf "$ARCHIVE" -C "$RELEASE"
rm -f "$ARCHIVE"

ENV_TARGET="$RELEASE/.env"
ENV_SOURCE=""
for candidate in \
  "$APP_DIR/.env" \
  "$APP_DIR/shared/.env" \
  "$APP_DIR/current/.env" \
  "/opt/gamehubparty/.env" \
  "/home/deploy/gamehubparty/.env"; do
  if [ -f "$candidate" ] && [ -r "$candidate" ]; then
    ENV_SOURCE="$candidate"
    break
  fi
done

if [ -z "$ENV_SOURCE" ]; then
  ENV_SOURCE="$(find "$APP_DIR/releases" -maxdepth 2 -name .env -type f -readable 2>/dev/null | grep -v "^$ENV_TARGET$" | sort | tail -n 1 || true)"
fi

if [ -n "$ENV_SOURCE" ] && [ -f "$ENV_SOURCE" ]; then
  cp "$ENV_SOURCE" "$ENV_TARGET"
else
  cat > "$ENV_TARGET" <<'ENVEOF'
BASE_URL=https://gamehubparty.ru
VITE_BASE_URL=https://gamehubparty.ru
ENVEOF
fi

cat > "$RELEASE/docker-compose.override.yml" <<'YAMLEOF'
services:
  gamehubparty:
    ports:
      - "127.0.0.1:8000:3100"
YAMLEOF

ln -sfn "$RELEASE" "$APP_DIR/current"
cd "$APP_DIR/current"
rm -f "$APP_DIR/current/docker-compose.override.yml.broken" 2>/dev/null || true

OLD_CONTAINERS="$(docker ps -q --filter publish=8000 || true)"
if [ -n "$OLD_CONTAINERS" ]; then
  docker stop $OLD_CONTAINERS >/dev/null 2>&1 || true
fi

docker compose -p gamehubparty up -d --build
sleep 2
curl -fsS http://127.0.0.1:8000/api/health || true
printf "\nDEPLOY_OK %s\n" "$RELEASE"
'@
$RemoteScript = $RemoteTemplate.Replace("__ARCHIVE_B64__", $ArchiveB64)
$RemoteScript = $RemoteScript.Replace(([string][char]13 + [string][char]10), ([string][char]10))

Write-Host "Deploying on server with one SSH connection..."
$sshArgs = @("-i", $KeyPath, "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=no", "${User}@${Server}", "bash -s")
$RemoteScript | & ssh @sshArgs
if ($LASTEXITCODE -ne 0) {
  throw "ssh deploy failed with exit code $LASTEXITCODE"
}

Write-Host "Checking public admin page..."
try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $PublicUrl -TimeoutSec 20
  Write-Host "Public check status: $($response.StatusCode)"
}
catch {
  Write-Warning "Deploy finished, but public check failed: $($_.Exception.Message)"
}

Write-Host "GameHubParty deploy complete."
if (Test-Path -LiteralPath $KeyPath) { Remove-Item -LiteralPath $KeyPath -Force }
