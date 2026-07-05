param(
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

$Targets = @(
  '$Recycle.Bin',
  '$SysReset',
  '$Windows.~WS',
  '.npm-cache',
  'tmp_generated_contact_sheet.jpg',
  'artifacts\local-server-4173.err.log',
  'artifacts\local-server-4173.log',
  'artifacts\gamehubparty-*.tar.gz'
)

function Assert-InProject([string]$Path) {
  $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
  if (-not ($resolved -eq $ProjectRoot -or $resolved.StartsWith($ProjectRoot + [IO.Path]::DirectorySeparatorChar))) {
    throw "Refusing to remove outside project: $resolved"
  }
  return $resolved
}

foreach ($target in $Targets) {
  $matches = Get-ChildItem -LiteralPath $ProjectRoot -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like $target }

  if ($target.Contains('\') -or $target.Contains('/')) {
    $path = Join-Path $ProjectRoot $target
    $parent = Split-Path -Parent $path
    $leaf = Split-Path -Leaf $path
    if (Test-Path -LiteralPath $parent) {
      $matches = Get-ChildItem -LiteralPath $parent -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like $leaf }
    }
  }

  foreach ($item in $matches) {
    $safePath = Assert-InProject $item.FullName
    if ($WhatIf) {
      Write-Host "Would remove $safePath"
    } else {
      Remove-Item -LiteralPath $safePath -Recurse -Force
      Write-Host "Removed $safePath"
    }
  }
}
