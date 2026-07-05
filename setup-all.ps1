param(
  [string]$Server = "201.51.12.133",
  [string]$User = "deploy",
  [switch]$IncludeTest
)

$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "setup-server.ps1") -Server $Server -User $User
if ($LASTEXITCODE -ne 0) { throw "Main server setup failed." }

& (Join-Path $PSScriptRoot "setup-vk-server.ps1") -Server $Server -User $User
if ($LASTEXITCODE -ne 0) { throw "VK server setup failed." }

if ($IncludeTest) {
  & (Join-Path $PSScriptRoot "setup-test-server.ps1") -Server $Server -User $User
  if ($LASTEXITCODE -ne 0) { throw "Test server setup failed." }
}

Write-Host "GameHubParty setup complete."
