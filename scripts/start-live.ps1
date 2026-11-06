$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$ready=$false
try { $page=Invoke-WebRequest -Uri 'http://127.0.0.1:5186' -TimeoutSec 2; $ready=$page.StatusCode -eq 200 -and $page.Content.Contains('石间') } catch {}
if(-not $ready){
  $viteEntry=Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
  Start-Process -FilePath 'node.exe' -ArgumentList @(('"'+$viteEntry+'"'),'--host','127.0.0.1','--port','5186','--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden
  for($attempt=0;$attempt -lt 30;$attempt++){
    Start-Sleep -Milliseconds 500
    try { $page=Invoke-WebRequest -Uri 'http://127.0.0.1:5186' -TimeoutSec 1; if($page.StatusCode -eq 200){$ready=$true;break} } catch {}
  }
}
if(-not $ready){throw '预览服务未能启动，请检查 5186 端口。'}
Start-Process 'http://127.0.0.1:5186'
$env:STONE_DEV_URL='http://127.0.0.1:5186'
$electronExe=Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'
Start-Process -FilePath $electronExe -ArgumentList @(('"'+$projectRoot+'"')) -WorkingDirectory $projectRoot -WindowStyle Hidden
