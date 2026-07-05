param(
  [string]$Server = "201.51.12.133",
  [string]$User = "deploy",
  [string]$KeyPath = ""
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot
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
if (-not $KeyPath) {
  $KeyPath = if (Test-ReadablePath $ProjectKeyPath) {
    $ProjectKeyPath
  } elseif (Test-ReadablePath $HomeKeyPath) {
    $HomeKeyPath
  } elseif (Test-ReadablePath $ProjectKeyPathNew) {
    $ProjectKeyPathNew
  } else {
    $HomeKeyPathNew
  }
}
Write-Host "Using SSH key: $KeyPath"
$KeyAuthOk = $false
if (Test-ReadablePath $KeyPath) {
  try {
    $oldErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & ssh -i $KeyPath -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=8 "${User}@${Server}" "echo KEY_OK" *> $null
    $KeyAuthOk = ($LASTEXITCODE -eq 0)
  } catch {
    $KeyAuthOk = $false
  } finally {
    $ErrorActionPreference = $oldErrorActionPreference
  }
}
if ($KeyAuthOk) {
  Write-Host "SSH key authentication: OK"
} else {
  Write-Host "SSH key authentication: not available, falling back to password prompts."
}
$Release = Get-Date -Format "yyyyMMdd-HHmmss"
$ArchivePath = Join-Path $env:TEMP "gamehubparty-deploy-$Release.tar.gz"
$RemoteArchive = "/tmp/gamehubparty-$Release.tar.gz"
$RemoteRoot = "/home/$User/apps/gamehubparty"

Push-Location $ProjectDir
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw "Tests failed." }

  if (Test-Path $ArchivePath) { Remove-Item -LiteralPath $ArchivePath -Force }
  & tar.exe -czf $ArchivePath dist server package.json package-lock.json Dockerfile docker-compose.yml .env
  if ($LASTEXITCODE -ne 0) { throw "Could not create deployment archive." }

  if ($KeyAuthOk) {
    & scp -i $KeyPath -o BatchMode=yes -o IdentitiesOnly=yes $ArchivePath "${User}@${Server}:$RemoteArchive"
  } else {
    & scp $ArchivePath "${User}@${Server}:$RemoteArchive"
  }
  if ($LASTEXITCODE -ne 0) { throw "Could not upload deployment archive." }

  $remoteCommand = @"
set -eu
release='$RemoteRoot/releases/$Release'
mkdir -p "`$release"
tar -xzf '$RemoteArchive' -C "`$release"
mkdir -p '$RemoteRoot/shared'
if [ -f "`$release/.env" ]; then
  cp "`$release/.env" '$RemoteRoot/shared/.env'
elif [ -f '$RemoteRoot/shared/.env' ]; then
  cp '$RemoteRoot/shared/.env' "`$release/.env"
elif [ -f '$RemoteRoot/current/.env' ]; then
  cp '$RemoteRoot/current/.env' "`$release/.env"
fi
ln -sfn "`$release" '$RemoteRoot/current.next'
mv -Tf '$RemoteRoot/current.next' '$RemoteRoot/current'
rm -f '$RemoteArchive'
cd '$RemoteRoot/current'
docker compose -p gamehubparty up -d --build
find '$RemoteRoot/releases' -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +6 | xargs -r rm -rf
printf 'DEPLOY_OK %s\n' "`$release"
"@
  if ($KeyAuthOk) {
    & ssh -i $KeyPath -o BatchMode=yes -o IdentitiesOnly=yes "${User}@${Server}" $remoteCommand
  } else {
    & ssh "${User}@${Server}" $remoteCommand
  }
  if ($LASTEXITCODE -ne 0) { throw "Remote deployment failed." }
}
finally {
  Pop-Location
  if (Test-Path $ArchivePath) { Remove-Item -LiteralPath $ArchivePath -Force }
}
