# Interface only. No worker, approval, installation, shutdown or restart is launched.
param([string]$Language)
$ErrorActionPreference='Stop'
$catalog=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'setup-copy.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(!$Language){$Language=[Globalization.CultureInfo]::CurrentUICulture.Name}
if(!$catalog.$Language){$Language=$Language.Split('-')[0]};if(!$catalog.$Language){$Language='en'}
$id=[guid]::NewGuid().ToString('N');$directory=Join-Path $PSScriptRoot ('job-'+$id);[IO.Directory]::CreateDirectory($directory)|Out-Null
$request=@{schema=2;id=$id;token=([guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'));version='__NEXUS_RELEASE_VERSION__';revision=__NEXUS_RELEASE_REVISION__;presentation=$catalog.$Language}
$file=Join-Path $directory 'request.json';[IO.File]::WriteAllText($file,($request|ConvertTo-Json -Depth 8 -Compress),[Text.UTF8Encoding]::new($false))
& (Join-Path $PSScriptRoot 'update-progress.ps1') -JobFile $file -PreviewOnly
