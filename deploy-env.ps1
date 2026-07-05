param(
  [string]$Server = "201.51.12.133",
  [string]$User = "deploy",
  [string]$Source = "artifacts\deploy\gamehubparty.shared.env"
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot
$SourcePath = Join-Path $ProjectDir $Source

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Env file not found: $SourcePath"
}

$EnvContent = Get-Content -LiteralPath $SourcePath -Raw
if ($EnvContent -match "PASTE_.*_HERE") {
  throw "Replace placeholders in $Source before uploading."
}

function Test-ReadablePath([string]$Path) {
  try {
    return Test-Path -LiteralPath $Path
  } catch {
    return $false
  }
}

$HomeKeyPathNew = Join-Path $HOME ".ssh\gamehubparty_deploy_20260619"
$ProjectKeyPathNew = Join-Path $ProjectDir ".deploy-keys\gamehubparty_deploy_20260619"
$ProjectKeyPath = Join-Path $ProjectDir ".deploy-keys\gamehubparty_deploy"
$HomeKeyPath = Join-Path $HOME ".ssh\gamehubparty_deploy"
$KeyPath = if (Test-ReadablePath $ProjectKeyPath) {
  $ProjectKeyPath
} elseif (Test-ReadablePath $HomeKeyPath) {
  $HomeKeyPath
} elseif (Test-ReadablePath $ProjectKeyPathNew) {
  $ProjectKeyPathNew
} else {
  $HomeKeyPathNew
}

Write-Host "Using SSH key: $KeyPath"
$RemoteTmp = "/tmp/gamehubparty.shared.env"
$RemoteEnv = "/home/$User/apps/gamehubparty/shared/.env"

& scp -i $KeyPath -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=no $SourcePath "${User}@${Server}:$RemoteTmp"
if ($LASTEXITCODE -ne 0) { throw "Could not upload env file." }

$remoteCommand = @"
set -eu
mkdir -p '/home/$User/apps/gamehubparty/shared'
cp '$RemoteTmp' '$RemoteEnv'
chmod 600 '$RemoteEnv'
rm -f '$RemoteTmp'
if [ -d '/home/$User/apps/gamehubparty/current' ]; then
  cd '/home/$User/apps/gamehubparty/current'
  docker compose -p gamehubparty up -d --build
fi
printf 'ENV_DEPLOY_OK %s\n' '$RemoteEnv'
"@

& ssh -i $KeyPath -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=no "${User}@${Server}" $remoteCommand
if ($LASTEXITCODE -ne 0) { throw "Remote env update failed." }
