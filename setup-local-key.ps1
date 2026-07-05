$ErrorActionPreference = "Stop"
$SourceKey = Join-Path $PSScriptRoot ".deploy-keys\gamehubparty_deploy"
$SshDir = Join-Path $HOME ".ssh"
$TargetKey = Join-Path $SshDir "gamehubparty_deploy"
$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

New-Item -ItemType Directory -Force -Path $SshDir | Out-Null
Copy-Item -LiteralPath $SourceKey -Destination $TargetKey -Force

& icacls.exe $TargetKey /inheritance:r /grant:r "${CurrentUser}:(R)" | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Could not secure the local SSH key."
}

Write-Host "Local SSH key is ready: $TargetKey"
