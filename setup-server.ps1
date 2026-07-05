param(
  [string]$Server = "201.51.12.133",
  [string]$User = "deploy"
)

$ErrorActionPreference = "Stop"
$KeyPath = Join-Path $HOME ".ssh\gamehubparty_deploy"
$ConfigPath = Join-Path $PSScriptRoot "nginx-gamehubparty.conf"
$RemoteConfig = "/tmp/gamehubparty-nginx.conf"

& (Join-Path $PSScriptRoot "deploy.ps1") -Server $Server -User $User
if ($LASTEXITCODE -ne 0) { throw "Deployment failed." }

& scp -i $KeyPath $ConfigPath "${User}@${Server}:$RemoteConfig"
if ($LASTEXITCODE -ne 0) { throw "Could not upload nginx config." }

$remoteCommand = @"
set -eu
sudo install -m 644 '$RemoteConfig' /etc/nginx/sites-available/gamehubparty
sudo ln -sfn /etc/nginx/sites-available/gamehubparty /etc/nginx/sites-enabled/gamehubparty
sudo nginx -t
sudo systemctl reload nginx
if command -v certbot >/dev/null 2>&1; then
  sudo certbot --nginx --cert-name gamehubparty.ru -d gamehubparty.ru -d www.gamehubparty.ru --redirect --keep-until-expiring --non-interactive
fi
curl -fsS http://127.0.0.1:3100/api/health
"@

Write-Host "Enter the deploy sudo password when prompted."
& ssh -t -i $KeyPath "${User}@${Server}" $remoteCommand
if ($LASTEXITCODE -ne 0) { throw "Server setup failed." }
