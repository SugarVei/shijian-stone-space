$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$electronRoot=Join-Path $projectRoot 'node_modules\electron\dist'
$outputRoot=Join-Path $projectRoot 'release\石间-Windows'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
foreach($entry in Get-ChildItem -LiteralPath $electronRoot -Force){
  if($entry.Name -eq 'electron.exe'){
    Copy-Item -LiteralPath $entry.FullName -Destination (Join-Path $outputRoot '石间.exe') -Force
  }else{Copy-Item -LiteralPath $entry.FullName -Destination $outputRoot -Recurse -Force}
}
$appDestination=Join-Path $outputRoot 'resources\app'
New-Item -ItemType Directory -Path $appDestination -Force | Out-Null
foreach($entry in Get-ChildItem -LiteralPath (Join-Path $projectRoot '.desktop-app') -Force){Copy-Item -LiteralPath $entry.FullName -Destination $appDestination -Recurse -Force}
Write-Output ('Windows app ready: '+(Join-Path $outputRoot '石间.exe'))
