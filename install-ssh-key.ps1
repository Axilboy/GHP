param(
  [string]$Server = "201.51.12.133",
  [string]$User = "deploy"
)

$ErrorActionPreference = "Stop"
$PublicKeyPath = Join-Path $PSScriptRoot ".deploy-keys\gamehubparty_deploy.pub"
$PublicKey = (Get-Content -LiteralPath $PublicKeyPath -Raw).Trim()

Write-Host "Enter the password for ${User}@${Server} when prompted."
& ssh "${User}@${Server}" "umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; grep -qxF '$PublicKey' ~/.ssh/authorized_keys || printf '%s\n' '$PublicKey' >> ~/.ssh/authorized_keys"

if ($LASTEXITCODE -ne 0) {
  throw "Could not install the SSH public key."
}

& (Join-Path $PSScriptRoot "setup-local-key.ps1")
& (Join-Path $PSScriptRoot "test-ssh.ps1") -Server $Server -User $User
