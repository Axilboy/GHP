param(
  [string]$Server = "201.51.12.133",
  [string]$User = "deploy"
)

$ErrorActionPreference = "Stop"
$KeyPath = Join-Path $HOME ".ssh\gamehubparty_deploy"

if (-not (Test-Path $KeyPath)) {
  throw "SSH key not found. Run setup-local-key.ps1 first."
}

& ssh -i $KeyPath -o BatchMode=yes -o ConnectTimeout=10 "${User}@${Server}" `
  "printf 'SSH_OK\n'; id; printf 'HOME=%s\n' ""`$HOME"""

if ($LASTEXITCODE -ne 0) {
  throw "SSH access failed. Add the public key from .deploy-keys\gamehubparty_deploy.pub to deploy's authorized_keys."
}
