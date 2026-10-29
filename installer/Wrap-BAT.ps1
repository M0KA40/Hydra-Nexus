param([string]$BatPath,[string]$Output,[string]$Name,[string]$AssetsFolder,[string]$Version,[switch]$Quiet)
$ErrorActionPreference='Stop'
$temporary=$null
try{
 if(!$BatPath){
  Add-Type -AssemblyName System.Windows.Forms
  $picker=New-Object Windows.Forms.OpenFileDialog;$picker.Filter='BAT / CMD (*.bat;*.cmd)|*.bat;*.cmd';$picker.Title='Choose a BAT to wrap'
  try{if($picker.ShowDialog() -ne 'OK'){exit 0};$BatPath=$picker.FileName}finally{$picker.Dispose()}
 }
 $bat=Get-Item -LiteralPath $BatPath
 if($bat.PSIsContainer -or $bat.Extension.ToLowerInvariant() -notin @('.bat','.cmd')){throw 'Choose a BAT or CMD file.'}
 if(!$Output){$Output=Join-Path $bat.DirectoryName ($bat.BaseName+'.exe')}
 $outputPath=[IO.Path]::GetFullPath($Output)
 if([IO.Path]::GetExtension($outputPath) -ine '.exe'){throw 'Output must end in .exe.'}
 if(Test-Path -LiteralPath $outputPath){throw 'Output already exists. Choose a new EXE name; existing installers are preserved.'}
 if(!$Name){$Name=$bat.BaseName}
 . (Join-Path $PSScriptRoot 'wrapper-metadata.ps1')
 $metadata=Get-NexusBatMetadata $bat.FullName $Version
 $assetRoot=$null
 if($AssetsFolder){$assetRoot=(Get-Item -LiteralPath $AssetsFolder).FullName;if($assetRoot -ine $bat.DirectoryName){throw 'AssetsFolder must be the folder containing the BAT.'}}
 Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem
 $temporary=Join-Path ([IO.Path]::GetTempPath()) ('nexus-wrapper-build-'+[guid]::NewGuid().ToString('N'));[IO.Directory]::CreateDirectory($temporary)|Out-Null
 $archive=[IO.Compression.ZipFile]::Open((Join-Path $temporary 'payload.zip'),[IO.Compression.ZipArchiveMode]::Create)
 try{
  $files=if($assetRoot){@(Get-ChildItem -LiteralPath $assetRoot -Recurse -File)}else{@($bat)}
  foreach($file in $files){
   if($file.FullName -ieq $outputPath){continue}
   if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked payload files are not supported.'}
   for($ancestor=$file.Directory;$ancestor;$ancestor=$ancestor.Parent){if($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked payload directories are not supported.'};if(!$assetRoot -or $ancestor.FullName -ieq $assetRoot){break}}
   $relative=if($assetRoot){$file.FullName.Substring($assetRoot.Length).TrimStart('\','/').Replace('\','/')}else{$bat.Name}
   [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,$relative,[IO.Compression.CompressionLevel]::Optimal)|Out-Null
  }
 }finally{$archive.Dispose()}
 function Hash-WrapperFile([string]$File){$algorithm=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($File);try{return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$algorithm.Dispose()}}
 $payloadHash=Hash-WrapperFile (Join-Path $temporary 'payload.zip')
 $configuration=@{schema=1;engine=$bat.Name;name=$Name;version=$metadata.version;revision=$metadata.revision;versionSource=$metadata.versionSource;sha256=(Hash-WrapperFile $bat.FullName)}
 [IO.File]::WriteAllText((Join-Path $temporary 'wrapper.json'),($configuration|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
 foreach($file in @('generic-gui.ps1','setup-copy.json')){[IO.File]::Copy((Join-Path $PSScriptRoot $file),(Join-Path $temporary $file))}
 $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'generic-launcher.cs')).Replace('__NEXUS_PAYLOAD_SHA256__',$payloadHash)
 [IO.File]::WriteAllText((Join-Path $temporary 'launcher.cs'),$source)
 $manifest='<?xml version="1.0"?><assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1"><assemblyIdentity version="1.0.0.0" name="Nexus.Bat.Wrapper"/><trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security></trustInfo></assembly>'
 [IO.File]::WriteAllText((Join-Path $temporary 'app.manifest'),$manifest)
 $compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
 if(!(Test-Path -LiteralPath $compiler)){$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework/v4.0.30319/csc.exe'}
 $arguments=@('/nologo','/target:winexe','/platform:anycpu','/optimize+','/reference:System.Windows.Forms.dll','/reference:System.IO.Compression.FileSystem.dll',('/out:'+$outputPath),('/win32icon:'+(Join-Path $PSScriptRoot 'setup.ico')),('/win32manifest:'+(Join-Path $temporary 'app.manifest')))
 foreach($file in @('payload.zip','generic-gui.ps1','setup-copy.json','wrapper.json')){$arguments+=('/resource:'+(Join-Path $temporary $file)+','+$file)}
 $arguments+=(Join-Path $temporary 'launcher.cs');& $compiler @arguments
 if($LASTEXITCODE -ne 0){throw 'The Windows C# compiler could not create the wrapper.'}
 Write-Output $outputPath
 if(!$Quiet){Add-Type -AssemblyName System.Windows.Forms;[void][Windows.Forms.MessageBox]::Show($outputPath,'EXE created')}
}catch{
 if(!$Quiet){Add-Type -AssemblyName System.Windows.Forms;[void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'BAT Wrapper')}
 Write-Error $_;exit 1
}finally{
 # Delete only the exact private build directory created above, after checking
 # its canonical parent and fixed prefix. Never touch the input BAT/assets.
 if($temporary){$full=[IO.Path]::GetFullPath($temporary);$parent=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\');if((Split-Path -Parent $full) -ieq $parent -and (Split-Path -Leaf $full) -like 'nexus-wrapper-build-*'){Remove-Item -LiteralPath $full -Recurse -Force}}
}
