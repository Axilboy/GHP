param(
  [string]$Server = "201.51.12.133",
  [string]$User = "deploy"
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot
$KeyPath = Join-Path $HOME ".ssh\gamehubparty_deploy"
$ArchivePath = Join-Path $env:TEMP "gamehubparty-test-deploy.tar.gz"
$Release = Get-Date -Format "yyyyMMdd-HHmmss"
$RemoteArchive = "/tmp/gamehubparty-test-$Release.tar.gz"
$RemoteRoot = "/home/$User/apps/gamehubparty-test"

Push-Location $ProjectDir
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw "Tests failed." }

  if (Test-Path $ArchivePath) { Remove-Item -LiteralPath $ArchivePath -Force }
  & tar.exe -czf $ArchivePath dist server package.json package-lock.json Dockerfile docker-compose.test.yml
  if ($LASTEXITCODE -ne 0) { throw "Could not create test deployment archive." }

  & scp -i $KeyPath -o BatchMode=yes $ArchivePath "${User}@${Server}:$RemoteArchive"
  if ($LASTEXITCODE -ne 0) { throw "Could not upload test deployment archive." }

  $remoteCommand = @"
set -eu
release='$RemoteRoot/releases/$Release'
mkdir -p "`$release"
tar -xzf '$RemoteArchive' -C "`$release"
ln -sfn "`$release" '$RemoteRoot/current.next'
mv -Tf '$RemoteRoot/current.next' '$RemoteRoot/current'
rm -f '$RemoteArchive'
docker compose -p gamehubparty-test -f '$RemoteRoot/current/docker-compose.test.yml' up -d --build
find '$RemoteRoot/releases' -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +6 | xargs -r rm -rf
printf 'TEST_DEPLOY_OK %s\n' "`$release"
"@
  & ssh -i $KeyPath -o BatchMode=yes "${User}@${Server}" $remoteCommand
  if ($LASTEXITCODE -ne 0) { throw "Remote test deployment failed." }
}
finally {
  Pop-Location
  if (Test-Path $ArchivePath) { Remove-Item -LiteralPath $ArchivePath -Force }
}
