@echo off
setlocal DisableDelayedExpansion
title Hydra Patch Manager
set "HYDRA_SUITE_SELF=%~f0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';try{$lines=[IO.File]::ReadAllLines($env:HYDRA_SUITE_SELF,[Text.Encoding]::UTF8);$i=[Array]::IndexOf($lines,':: === HYDRA_SUITE_PS_START ===');if($i -lt 0){throw 'Manager marker not found.'};& ([scriptblock]::Create([string]::Join([char]10,$lines[($i+1)..($lines.Length-1)])))}catch{Write-Host ('ERROR: '+$_.Exception.Message) -ForegroundColor Red;exit 1}"
set "HYDRA_SUITE_EXIT=%errorlevel%"
if not "%HYDRA_SUITE_EXIT%"=="0" pause
exit /b %HYDRA_SUITE_EXIT%
:: === HYDRA_SUITE_PS_START ===
param(
    [switch]$LibraryOnly,
    [switch]$TestMode,
    [ValidateSet('Menu','Install','Remove','Status')][string]$Action = 'Menu',
    [ValidateSet('steam','gameshift','backup')][string]$PatchId = 'steam',
    [string]$HydraDir,
    [string]$GameShiftDir
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
$script:HydraDir = $HydraDir
$script:GameShiftDir = $GameShiftDir
$script:SuiteRoot = if ($env:HYDRA_SUITE_SELF) { Split-Path -Parent $env:HYDRA_SUITE_SELF } else { $PSScriptRoot }

# Built-in registry: stable menu numbers; the original JavaScript bridges are embedded.
$script:BuiltInPatches = @(
    [pscustomobject]@{
        Number = 1; Id = 'steam'; Name = 'Hydra Steam'; Kind = 'BuiltIn'
        Description = 'Steam accounts, launch modes and achievement bridge'
        BridgeName = 'hydra-steam-bridge.cjs'
        CjsHook = 'require("./hydra-steam-bridge.cjs");'
        EsmHook = 'import { createRequire as __hsbCreateRequire } from "module"; __hsbCreateRequire(import.meta.url)("./hydra-steam-bridge.cjs");'
        BridgeBase64 = ''
    },
    [pscustomobject]@{
        Number = 2; Id = 'gameshift'; Name = 'Hydra GameShift'; Kind = 'BuiltIn'
        Description = 'GameShift launch settings for each game'
        BridgeName = 'hydra-gameshift-bridge.cjs'
        CjsHook = 'require("./hydra-gameshift-bridge.cjs"); // HYDRA_GAMESHIFT_HOOK_V1'
        EsmHook = 'import { createRequire as __hgsCreateRequire } from "module"; __hgsCreateRequire(import.meta.url)("./hydra-gameshift-bridge.cjs"); // HYDRA_GAMESHIFT_HOOK_V1'
        BridgeBase64 = ''
    }
)


$script:BuiltInPatches += [pscustomobject]@{
    Number = 3; Id = 'backup'; Name = 'Hydra Backup'; Kind = 'BuiltIn'
    Description = 'Per-game save files, achievements, recovery points and Google Drive upload'
    BridgeName = 'hydra-backup-bridge.cjs'
    CjsHook = 'require("./hydra-backup-bridge.cjs"); // HYDRA_BACKUP_HOOK_V2'
    EsmHook = 'import { createRequire as __hbkCreateRequire } from "module"; __hbkCreateRequire(import.meta.url)("./hydra-backup-bridge.cjs"); // HYDRA_BACKUP_HOOK_V2'
    BridgeBase64 = ''
}

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
public static class HydraSuiteAsar {
    public static string ReadHeader(string file, out int dataOffset) {
        using(var stream=File.OpenRead(file)) using(var reader=new BinaryReader(stream)) {
            if(reader.ReadUInt32()!=4) throw new InvalidDataException("Invalid ASAR signature.");
            uint headerSize=reader.ReadUInt32(); reader.ReadUInt32(); uint length=reader.ReadUInt32();
            if(length>67108864 || length>stream.Length-16) throw new InvalidDataException("Invalid ASAR header.");
            var bytes=reader.ReadBytes((int)length);
            dataOffset=checked((int)(8+headerSize));
            return Encoding.UTF8.GetString(bytes);
        }
    }
    public static byte[] ReadFile(string file,int dataOffset,long offset,int size) {
        using(var stream=File.OpenRead(file)) {
            long start=checked(dataOffset+offset);
            if(start<0 || size<0 || start+size>stream.Length) throw new InvalidDataException("ASAR file is out of bounds.");
            stream.Position=start; var result=new byte[size]; int total=0;
            while(total<size) { int n=stream.Read(result,total,size-total); if(n==0) throw new EndOfStreamException(); total+=n; }
            return result;
        }
    }
    public static void Write(string source,int oldOffset,string destination,string header,byte[] appended) {
        var json=Encoding.UTF8.GetBytes(header); int pad=(4-json.Length%4)%4;
        using(var input=File.OpenRead(source)) using(var output=new FileStream(destination,FileMode.CreateNew,FileAccess.Write)) using(var writer=new BinaryWriter(output)) {
            writer.Write((uint)4); writer.Write((uint)(json.Length+pad+8)); writer.Write((uint)(json.Length+pad+4)); writer.Write((uint)json.Length);
            writer.Write(json); if(pad!=0) writer.Write(new byte[pad]);
            input.Position=oldOffset; input.CopyTo(output); writer.Write(appended); output.Flush(true);
        }
    }
    private static int FuseWireStart(byte[] bytes) {
        var marker=Encoding.ASCII.GetBytes("dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX"); int found=-1;
        for(int i=0;i<=bytes.Length-marker.Length-2;i++) {
            if(bytes[i]!=marker[0]) continue; bool match=true;
            for(int j=1;j<marker.Length;j++) if(bytes[i+j]!=marker[j]) {match=false;break;}
            if(match) {found=i;break;}
        }
        if(found<0) throw new InvalidDataException("Electron integrity settings could not be located. No installation was applied.");
        // Electron FuseVersion.V1 is the numeric byte 1 (not 0 or ASCII '1').
        if(bytes[found+marker.Length]!=1) throw new InvalidDataException("Unsupported Electron fuse version.");
        int count=bytes[found+marker.Length+1],start=found+marker.Length+2;
        if(count<6 || count>bytes.Length-start) throw new InvalidDataException("Unsupported or truncated Electron fuse layout.");
        return start;
    }
    public static bool EnableModifiedAsar(string executable) {
        if(!File.Exists(executable)) throw new FileNotFoundException("Hydra executable not found.");
        var bytes=File.ReadAllBytes(executable);int start=FuseWireStart(bytes);bool changed=false;
        // Only disable embedded ASAR integrity, which a patched archive cannot match.
        // Keep OnlyLoadAppFromAsar and every unrelated protection unchanged.
        foreach(int index in new int[]{4}) {
            if(bytes[start+index]==(byte)'1') {bytes[start+index]=(byte)'0';changed=true;}
            else if(bytes[start+index]!=(byte)'0') throw new InvalidDataException("Unsupported Electron fuse state.");
        }
        if(changed) {
            string backup=executable+".before-hydra-suite.bak";
            if(!File.Exists(backup)) File.Copy(executable,backup);
            string temporary=executable+".hydra-suite.tmp"; File.WriteAllBytes(temporary,bytes);
            File.Replace(temporary,executable,null);
        }
        return changed;
    }
    public static bool RestoreOriginalFuses(string executable) {
        string backup=executable+".before-hydra-suite.bak";
        if(!File.Exists(backup)) return false;
        var current=File.ReadAllBytes(executable);var original=File.ReadAllBytes(backup);
        if(current.Length!=original.Length) return false;
        int start;try{start=FuseWireStart(current);if(FuseWireStart(original)!=start)return false;}catch(InvalidDataException){return false;}
        foreach(int index in new int[]{4,5})if((current[start+index]!=(byte)'0'&&current[start+index]!=(byte)'1')||(original[start+index]!=(byte)'0'&&original[start+index]!=(byte)'1'))return false;
        for(int i=0;i<current.Length;i++)if(i!=start+4&&i!=start+5&&current[i]!=original[i])return false;
        // Restore only when the original executable is the same build.
        current[start+4]=original[start+4];current[start+5]=original[start+5];
        string temporary=executable+".nexus-fuses-"+Guid.NewGuid().ToString("N")+".tmp";
        File.WriteAllBytes(temporary,current);File.Replace(temporary,executable,null);return true;
    }
}
'@
function Find-Hydra {
    $candidates=@()
    foreach($root in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')) {
        foreach($key in @(Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)) {
            $item=Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
            if($item.DisplayName -match '^Hydra( Launcher)?$' -and $item.InstallLocation){$candidates+=,$item.InstallLocation}
        }
    }
    $candidates+=@("$env:LOCALAPPDATA\Programs\Hydra","$env:LOCALAPPDATA\Programs\hydralauncher","$env:LOCALAPPDATA\hydralauncher","$env:ProgramFiles\Hydra","${env:ProgramFiles(x86)}\Hydra","$env:ProgramFiles\hydralauncher")
    foreach($candidate in $candidates){if($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'resources\app.asar'))){return [IO.Path]::GetFullPath($candidate)}}
    try {
        $shell=New-Object -ComObject WScript.Shell
        foreach ($folder in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'))) {
            foreach ($link in @(Get-ChildItem -LiteralPath $folder -Filter '*Hydra*.lnk' -Recurse -ErrorAction SilentlyContinue)) {
                $candidate=Split-Path -Parent ($shell.CreateShortcut($link.FullName).TargetPath)
                if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'resources\app.asar'))) { return $candidate }
            }
        }
    } catch {}
    return $null
}
function Find-GameShift {
    $candidates=@()
    foreach($key in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GameShift','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GameShift')) {
        $item=Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
        if($item.InstallLocation){$candidates+=,$item.InstallLocation}
    }
    $candidates+=@("$env:LOCALAPPDATA\GameShift","$env:APPDATA\GameShift","$env:ProgramFiles\GameShift","${env:ProgramFiles(x86)}\GameShift")
    foreach($candidate in $candidates){if($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'Engine.ps1')) -and (Test-Path -LiteralPath (Join-Path $candidate 'Core.ps1'))){return [IO.Path]::GetFullPath($candidate)}}
    try {
        $shell=New-Object -ComObject WScript.Shell
        foreach($folder in @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'))) {
            foreach($link in @(Get-ChildItem -LiteralPath $folder -Filter '*GameShift*.lnk' -Recurse -ErrorAction SilentlyContinue)) {
                $candidate=Split-Path -Parent ($shell.CreateShortcut($link.FullName).TargetPath)
                if(Test-Path -LiteralPath (Join-Path $candidate 'Engine.ps1')){return $candidate}
            }
        }
    }catch{}
    return $null
}
function Get-Integrity([byte[]]$Bytes) {
    $sha=[Security.Cryptography.SHA256]::Create()
    try {
        $hash=([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()
        $blocks=@();$blockSize=4194304
        for($index=0;$index -lt $Bytes.Length;$index+=$blockSize){$length=[Math]::Min($blockSize,$Bytes.Length-$index);$blocks+=([BitConverter]::ToString($sha.ComputeHash($Bytes,$index,$length))).Replace('-','').ToLowerInvariant()}
        if(!$blocks.Count){$blocks=@($hash)}
        return [pscustomobject]@{algorithm='SHA256';hash=$hash;blockSize=$blockSize;blocks=@($blocks)}
    }finally{$sha.Dispose()}
}
function Set-NodeFile($Node,[byte[]]$Bytes,[long]$Offset) {
    $Node | Add-Member -NotePropertyName size -NotePropertyValue $Bytes.Length -Force
    $Node | Add-Member -NotePropertyName offset -NotePropertyValue ([string]$Offset) -Force
    $Node | Add-Member -NotePropertyName integrity -NotePropertyValue (Get-Integrity $Bytes) -Force
}


function Resolve-HydraDirectory {
    if (!$script:HydraDir) { $script:HydraDir = Find-Hydra }
    if (!$script:HydraDir) { $script:HydraDir = Read-Host '  Hydra folder (containing Hydra.exe), or 0 to cancel' }
    if (!$script:HydraDir -or $script:HydraDir.Trim() -eq '0') { $script:HydraDir = ''; throw 'Cancelled.' }
    $script:HydraDir = [IO.Path]::GetFullPath($script:HydraDir.Trim().Trim('"'))
    if (!(Test-Path -LiteralPath (Join-Path $script:HydraDir 'resources\app.asar') -PathType Leaf)) {
        $script:HydraDir = ''; throw 'The selected folder does not contain resources\app.asar.'
    }
    return $script:HydraDir
}

function Resolve-GameShiftDirectory {
    if (!$script:GameShiftDir) { $script:GameShiftDir = Find-GameShift }
    if (!$script:GameShiftDir) { $script:GameShiftDir = Read-Host '  GameShift folder (containing Engine.ps1), or 0 to cancel' }
    if (!$script:GameShiftDir -or $script:GameShiftDir.Trim() -eq '0') { $script:GameShiftDir = ''; throw 'Cancelled.' }
    $script:GameShiftDir = [IO.Path]::GetFullPath($script:GameShiftDir.Trim().Trim('"'))
    foreach ($name in @('Engine.ps1','Core.ps1')) {
        if (!(Test-Path -LiteralPath (Join-Path $script:GameShiftDir $name) -PathType Leaf)) {
            $script:GameShiftDir = ''; throw "$name was not found in the selected folder."
        }
    }
    if (![IO.File]::ReadAllText((Join-Path $script:GameShiftDir 'Core.ps1')).Contains('Invoke-GameShift')) {
        $script:GameShiftDir = ''; throw 'This GameShift installation does not expose the supported Global mode engine.'
    }
    return $script:GameShiftDir
}

function Get-ArchiveState([string]$Archive) {
    $offset = 0
    $header = [HydraSuiteAsar]::ReadHeader($Archive,[ref]$offset) | ConvertFrom-Json
    $files = $null
    foreach ($folder in @('out','dist')) {
        if ($header.files.$folder -and $header.files.$folder.files.main) { $files = $header.files.$folder.files.main.files; break }
    }
    if (!$files) { throw 'Unsupported Hydra layout: main application directory was not found.' }
    $name = if ($files.'index.js') { 'index.js' } elseif ($files.'index.mjs') { 'index.mjs' } else { throw 'Hydra main entry was not found.' }
    $node = $files.$name
    if ($node.unpacked -or $node.link) { throw 'Unsupported Hydra layout: main entry is unpacked or linked.' }
    $bytes = [HydraSuiteAsar]::ReadFile($Archive,$offset,[long]$node.offset,[int]$node.size)
    return [pscustomobject]@{ Header=$header; Offset=$offset; Files=$files; Name=$name; Node=$node; Text=[Text.Encoding]::UTF8.GetString($bytes) }
}

function Remove-PatchHooks([string]$Text, $Patch) {
    # Only remove exact hooks used by the originals and this manager. Keep other patches intact.
    foreach ($hook in @($Patch.EsmHook,$Patch.CjsHook)) {
        $pattern = '(?m)^' + [regex]::Escape($hook) + '(?:\r?\n|$)'
        $Text = [regex]::Replace($Text,$pattern,'')
    }
    if ($Patch.Id -eq 'backup') { $Text = [regex]::Replace($Text,'(?s)\r?\n// === HYDRA_BACKUP_ADAPTER_START ===.*?// === HYDRA_BACKUP_ADAPTER_END ===\r?\n','') }
    return $Text
}

function Get-PatchStatus($Patch, [string]$Directory) {
    $state = Get-ArchiveState (Join-Path $Directory 'resources\app.asar')
    $hasEntry = $null -ne $state.Files.PSObject.Properties[$Patch.BridgeName]
    $hasHook = (Remove-PatchHooks $state.Text $Patch) -cne $state.Text
    if ($hasEntry -and $hasHook) { return 'Installed' }
    if ($hasEntry -or $hasHook) { return 'Partial installation - use Install / Update to repair' }
    return 'Not installed'
}

function Close-HydraForUpdate([string]$Directory) {
    foreach ($process in @(Get-Process -Name Hydra -ErrorAction SilentlyContinue)) {
        if (!$process.Path) { throw 'Cannot inspect a running Hydra process. Close Hydra manually and retry.' }
        if ((Split-Path -Parent $process.Path) -ieq $Directory) {
            Write-Host '  Closing Hydra before updating its files...' -ForegroundColor Yellow
            Stop-Process -Id $process.Id -Force
            if (!$process.WaitForExit(5000)) { throw 'Hydra is still running. Close Hydra and retry.' }
        }
    }
    # Either patch can close Hydra, so recover any GameShift session before changing files.
    $journal = Join-Path $env:APPDATA 'Hydra\GameShiftBridge\session.json'
    if (Test-Path -LiteralPath $journal) {
        $session = Get-Content -LiteralPath $journal -Raw | ConvertFrom-Json
        if ($session.ownsMode) {
            $recoveryDir = Resolve-GameShiftDirectory
            & "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $recoveryDir 'Engine.ps1') -Action Desktop -Quiet | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'GameShift could not restore Gaming OFF. Restore it in GameShift, then retry.' }
        }
        Remove-Item -LiteralPath $journal -Force
    }
}

function Invoke-BuiltInPatch($Patch, [ValidateSet('Install','Remove')][string]$Operation, [switch]$Testing) {
    $directory = Resolve-HydraDirectory
    $engineDir = $null
    if ($Operation -eq 'Install' -and $Patch.Id -eq 'gameshift') { $engineDir = Resolve-GameShiftDirectory }
    $archive = Join-Path $directory 'resources\app.asar'
    # Validate everything possible before closing a running application.
    $state = Get-ArchiveState $archive
    if ($Operation -eq 'Install' -and $Patch.Id -eq 'gameshift' -and !$state.Text.Contains('on-games-running')) {
        throw 'This Hydra version does not expose the expected game-running event. The patch was not installed.'
    }
    $clean = Remove-PatchHooks $state.Text $Patch
    if ($clean.Contains($Patch.BridgeName)) { throw 'An unrecognized hook for this patch was found. The archive was left unchanged.' }
    if ($Operation -eq 'Remove' -and !$state.Files.PSObject.Properties[$Patch.BridgeName] -and $clean -ceq $state.Text) {
        Write-Host ('  '+$Patch.Name+' is not installed.') -ForegroundColor Yellow; return
    }
    if (!$Testing) { if ($Patch.Id -eq 'backup') { Assert-HydraBackupIdle } else { Close-HydraForUpdate $directory } }
    # Read the live archive, never an old backup, to preserve the other patch.
    $state = Get-ArchiveState $archive
    $clean = Remove-PatchHooks $state.Text $Patch
    if ($clean.Contains($Patch.BridgeName)) { throw 'An unrecognized hook for this patch was found. The archive was left unchanged.' }
    $bridgeBytes = [byte[]]@()
    if ($Operation -eq 'Install') {
        $isEsm = $state.Name -eq 'index.mjs' -or $clean.Substring(0,[Math]::Min(2000,$clean.Length)) -match '\bimport\s'
        $hook = if ($isEsm) { $Patch.EsmHook } else { $Patch.CjsHook }
        $newMain = $hook+"`n"+$clean
        $bridgeBytes = [Convert]::FromBase64String($Patch.BridgeBase64)
    } else {
        $state.Files.PSObject.Properties.Remove($Patch.BridgeName)
        $newMain = $clean
    }
    if ($Operation -eq 'Install' -and $Patch.Id -eq 'backup') { $newMain += Get-BackupAdapter $clean }
    $mainBytes = $utf8.GetBytes($newMain)
    $end = (Get-Item -LiteralPath $archive).Length-$state.Offset
    Set-NodeFile $state.Node $mainBytes $end
    if ($Operation -eq 'Install') {
        $bridgeNode = [pscustomobject]@{}
        Set-NodeFile $bridgeNode $bridgeBytes ($end+$mainBytes.Length)
        $state.Files | Add-Member -NotePropertyName $Patch.BridgeName -NotePropertyValue $bridgeNode -Force
    }
    $appended = New-Object byte[] ($mainBytes.Length+$bridgeBytes.Length)
    [Array]::Copy($mainBytes,0,$appended,0,$mainBytes.Length)
    if ($bridgeBytes.Length) { [Array]::Copy($bridgeBytes,0,$appended,$mainBytes.Length,$bridgeBytes.Length) }
    $backup = $archive+'.before-hydra-suite.bak'
    if (!(Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $archive -Destination $backup }
    $temporary = $archive+'.hydra-suite.'+[guid]::NewGuid().ToString('N')+'.tmp'
    $originalExecutable=$null
    $transactionArchive=$archive+'.nexus-rollback-'+[guid]::NewGuid().ToString('N')+'.bak'
    $executable=Join-Path $directory 'Hydra.exe'
    try {
        Write-Host ('  Preparing '+$Patch.Name+'...') -ForegroundColor Cyan
        [HydraSuiteAsar]::Write($archive,$state.Offset,$temporary,($state.Header | ConvertTo-Json -Depth 100 -Compress),$appended)
        $check = Get-ArchiveState $temporary
        $verifiedMain = $utf8.GetBytes($check.Text)
        if ((Get-Integrity $verifiedMain).hash -ne (Get-Integrity $mainBytes).hash) { throw 'Main entry verification failed. The original archive was not replaced.' }
        if ($Operation -eq 'Install') {
            $bridgeNode = $check.Files.($Patch.BridgeName)
            $verifiedBridge = [HydraSuiteAsar]::ReadFile($temporary,$check.Offset,[long]$bridgeNode.offset,[int]$bridgeNode.size)
            if ((Get-Integrity $verifiedBridge).hash -ne (Get-Integrity $bridgeBytes).hash) { throw 'Bridge verification failed. The original archive was not replaced.' }
            if (!$Testing) { $originalExecutable=[IO.File]::ReadAllBytes($executable);[HydraSuiteAsar]::EnableModifiedAsar($executable) | Out-Null }
        }
        if ($Operation -eq 'Install' -and $Patch.Id -eq 'gameshift') {
            $dataDir = Join-Path $env:APPDATA 'Hydra\GameShiftBridge'
            New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
            [IO.File]::WriteAllText((Join-Path $dataDir 'installation.json'),([pscustomobject]@{version='1.0.1';enginePath=(Join-Path $engineDir 'Engine.ps1');hydraDir=$directory} | ConvertTo-Json),$utf8)
        }
        if (!$Testing -and $Operation -eq 'Install' -and $Patch.Id -eq 'backup') { Write-BackupInstallation $directory }
        if (!$Testing -and $Patch.Id -eq 'backup') { Assert-HydraBackupIdle }
        [IO.File]::Replace($temporary,$archive,$transactionArchive)
        if(!$Testing -and $Operation -eq 'Remove'){
            $otherPatches=@($script:BuiltInPatches|Where-Object {$_.Id -ne $Patch.Id -and $check.Files.PSObject.Properties[$_.BridgeName]})
            if(!$otherPatches.Count){$originalExecutable=[IO.File]::ReadAllBytes($executable);[HydraSuiteAsar]::RestoreOriginalFuses($executable)|Out-Null}
        }
        Remove-Item -LiteralPath $transactionArchive -Force
    } catch {
        $installationError=$_
        if(Test-Path -LiteralPath $transactionArchive){[IO.File]::Replace($transactionArchive,$archive,[System.Management.Automation.Language.NullString]::Value)}
        if($null -ne $originalExecutable){$restoreExe=$executable+'.nexus-recover-'+[guid]::NewGuid().ToString('N')+'.tmp';[IO.File]::WriteAllBytes($restoreExe,$originalExecutable);[IO.File]::Replace($restoreExe,$executable,[System.Management.Automation.Language.NullString]::Value)}
        throw $installationError
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
    Write-Host ''
    if ($Operation -eq 'Install') {
        Write-Host ('  '+$Patch.Name+' installed / updated successfully.') -ForegroundColor Green
        if ($Patch.Id -eq 'steam') { Write-Host '  Open Hydra > a game page > Steam / Launch Mode.' }
        elseif ($Patch.Id -eq 'backup') { Write-Host '  Open Hydra > Backup in the sidebar. Hold 5 seconds or use the gear for settings.' }
        else { Write-Host '  Open Hydra > a game page > GameShift > Enable for this game > Save Settings.' }
    } else { Write-Host ('  '+$Patch.Name+' removed successfully.') -ForegroundColor Green }
    Write-Host '  Other patches and saved game settings are preserved.' -ForegroundColor Gray
    Write-Host ('  Recovery backup: '+$backup) -ForegroundColor Gray
}

function Get-BackupAdapter([string]$Text) {
    $symbols=@{}
    $constructor='ClassicLevel'
    $import=[regex]::Match($Text,'\bClassicLevel\s+as\s+([\w$]+)')
    if($import.Success){$constructor=$import.Groups[1].Value}
    $db=[regex]::Match($Text,'\b(?:const|let|var)\s+([\w$]+)\s*=\s*new\s+'+[regex]::Escape($constructor)+'\s*\(')
    if($db.Success){
        $symbols.db=$db.Groups[1].Value
        $games=[regex]::Match($Text,'\b(?:const|let|var)\s+([\w$]+)\s*=\s*'+[regex]::Escape($symbols.db)+'\.sublevel\(\s*(?:[\w$]+\.games|["'']games["''])')
        if($games.Success){$symbols.games=$games.Groups[1].Value}
    }
    foreach($entry in @(@('memory','AchievementMemoryStore'),@('collect','collectGameAchievementFiles'),@('running','getGamesRunning'),@('parse','parseAchievementFile'))){
        if($Text -match ('\b(?:const|let|var|class|function)\s+'+[regex]::Escape($entry[1])+'\b')){$symbols[$entry[0]]=$entry[1]}
    }
    $parts=@()
    foreach($name in @('db','games','memory','collect','running','parse')){
        if($symbols.ContainsKey($name)){$parts+=($name+':'+$symbols[$name])}
    }
    if(!$symbols.ContainsKey('games')){Write-Host '  Adaptive mode: library access will use Hydra events. Metadata restore may need a newer adapter.' -ForegroundColor Yellow}
    return "`n// === HYDRA_BACKUP_ADAPTER_START ===`ntry { globalThis.__HYDRA_BACKUP_BIND__ && globalThis.__HYDRA_BACKUP_BIND__({$([string]::Join(',',$parts))}); } catch (error) { console.error('[HydraBackup] Adapter:', error.message); }`n// === HYDRA_BACKUP_ADAPTER_END ===`n"
}

function Assert-HydraBackupIdle {
    if(@(Get-Process -Name Hydra,hydralauncher -ErrorAction SilentlyContinue).Count){throw 'Exit Hydra completely, including its tray icon, then install Backup. No application was closed.'}
    foreach($profile in @('hydralauncher','Hydra')){
        foreach($db in @('hydra-db','hydra-db-staging')){
            $lock=Join-Path $env:APPDATA ($profile+'\'+$db+'\LOCK')
            if(Test-Path -LiteralPath $lock){
                try{$stream=[IO.File]::Open($lock,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);$stream.Dispose()}
                catch{throw 'Hydra data is in use. Exit Hydra from its tray icon, then retry. No application was closed.'}
            }
        }
    }
}

function Write-BackupInstallation([string]$Directory) {
    $dataDir=Join-Path $env:APPDATA 'Hydra\BackupBridge'
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    $settingsFile=Join-Path $dataDir 'settings.json'
    if(!(Test-Path -LiteralPath $settingsFile)){
        $settings=[pscustomobject]@{destination=(Join-Path $script:SuiteRoot 'Hydra_Backups');autoBackup=$false;autoUpload=$false;keepVersions=10;delaySeconds=10;discoverSaves=$true;extraPaths=[pscustomobject]@{}}
        [IO.File]::WriteAllText($settingsFile,($settings | ConvertTo-Json -Depth 8),$utf8)
    }
    $installation=[pscustomobject]@{version='2.1.0';hydraDir=$Directory;manager=(Join-Path $script:SuiteRoot 'Hydra_Patch_Manager.bat');defaultDestination=(Join-Path $script:SuiteRoot 'Hydra_Backups')}
    [IO.File]::WriteAllText((Join-Path $dataDir 'installation.json'),($installation | ConvertTo-Json),$utf8)
}

function Show-BackupPatchMenu($Patch) {
    while($true){
        Show-Header 'Hydra Backup / Saves + achievements'
        Write-Host '  Adds Backup below Settings in the Hydra sidebar.' -ForegroundColor Gray
        Write-Host '  Click = check and back up. Hold 5 seconds / gear = settings.' -ForegroundColor Gray
        Write-Host '  Each game gets its own folder. Google Drive upload is optional.' -ForegroundColor Gray
        Write-Host ''
        Write-Host '  [1] Install / Update / Repair'
        Write-Host '  [2] Remove Backup only (keep all backups and settings)'
        Write-Host '  [3] Check installation status'
        Write-Host '  [4] Change Hydra folder'
        Write-Host '  [0] Back to main menu'
        $selection=(Read-Host '  Select an option').Trim()
        if($selection -eq '0'){return}
        try{
            switch($selection){
                '1'{Invoke-BuiltInPatch $Patch Install;Wait-ForMenu}
                '2'{Invoke-BuiltInPatch $Patch Remove;Wait-ForMenu}
                '3'{$directory=Resolve-HydraDirectory;Write-Host ('  Status: '+(Get-PatchStatus $Patch $directory)) -ForegroundColor Cyan;Wait-ForMenu}
                '4'{$script:HydraDir='';$script:HydraDir=Read-Host '  Hydra folder (containing Hydra.exe), or 0 to cancel';[void](Resolve-HydraDirectory);Wait-ForMenu}
                default{Write-Host '  Invalid option.' -ForegroundColor Yellow;Wait-ForMenu}
            }
        }catch{Show-Error $_;Wait-ForMenu}
    }
}


function Get-PatchCatalog {
    $catalog = @($script:BuiltInPatches)
    $folder = Join-Path $script:SuiteRoot 'Patches'
    if (Test-Path -LiteralPath $folder -PathType Container) {
        $number = 4
        foreach ($file in @(Get-ChildItem -LiteralPath $folder -File | Where-Object { $_.Extension -in @('.bat','.cmd','.ps1') } | Sort-Object Name)) {
            $catalog += [pscustomobject]@{ Number=$number; Id=$file.BaseName; Name=($file.BaseName -replace '^\d+[-_ ]*','' -replace '[_]',' '); Kind='External'; Path=$file.FullName; Description='Additional patch' }
            $number++
        }
    }
    return $catalog
}

function Wait-ForMenu {
    Write-Host ''; [void](Read-Host '  Press Enter to continue')
}

function Show-Header([string]$Page) {
    Clear-Host
    Write-Host ''
    Write-Host '  ============================================================' -ForegroundColor DarkCyan
    Write-Host '    HYDRA PATCH MANAGER                                 v2.1.0' -ForegroundColor Cyan
    Write-Host '  ============================================================' -ForegroundColor DarkCyan
    Write-Host ('    '+$Page) -ForegroundColor White
    Write-Host ''
}

function Show-Error($Failure) {
    Write-Host ''; Write-Host ('  ERROR: '+$Failure.Exception.Message) -ForegroundColor Red
    if ($Failure.Exception -is [UnauthorizedAccessException] -or $Failure.Exception.Message -match 'denied|permission') {
        Write-Host '  Close Hydra and run this BAT as administrator if its folder requires it.' -ForegroundColor Gray
    }
}

function Show-BuiltInMenu($Patch) {
    if ($Patch.Id -eq 'backup') { Show-BackupPatchMenu $Patch; return }
    while ($true) {
        Show-Header $Patch.Name
        Write-Host ('  '+$Patch.Description) -ForegroundColor Gray
        Write-Host ''
        Write-Host '  [1] Install / Update'
        Write-Host '  [2] Remove this patch only'
        Write-Host '  [3] Check installation status'
        Write-Host '  [4] Change Hydra folder'
        if ($Patch.Id -eq 'gameshift') { Write-Host '  [5] Change GameShift folder' }
        Write-Host '  [0] Back to main menu'
        Write-Host ''
        $selection = (Read-Host '  Select an option').Trim()
        if ($selection -eq '0') { return }
        try {
            switch ($selection) {
                '1' { Invoke-BuiltInPatch $Patch Install; Wait-ForMenu }
                '2' { Invoke-BuiltInPatch $Patch Remove; Wait-ForMenu }
                '3' { $directory=Resolve-HydraDirectory; Write-Host ('  Status: '+(Get-PatchStatus $Patch $directory)) -ForegroundColor Cyan; Write-Host ('  Hydra:  '+$directory) -ForegroundColor Gray; Wait-ForMenu }
                '4' { $script:HydraDir=''; $script:HydraDir=Read-Host '  Hydra folder (containing Hydra.exe), or 0 to cancel'; [void](Resolve-HydraDirectory); Wait-ForMenu }
                '5' { if ($Patch.Id -eq 'gameshift') { $script:GameShiftDir=''; $script:GameShiftDir=Read-Host '  GameShift folder (containing Engine.ps1), or 0 to cancel'; [void](Resolve-GameShiftDirectory) } else { Write-Host '  Invalid option.' -ForegroundColor Yellow }; Wait-ForMenu }
                default { Write-Host '  Invalid option. Choose a number from this menu.' -ForegroundColor Yellow; Wait-ForMenu }
            }
        } catch { Show-Error $_; Wait-ForMenu }
    }
}

function Invoke-ExternalPatch($Patch) {
    Show-Header $Patch.Name
    Write-Host ('  File: '+$Patch.Path) -ForegroundColor Gray
    Write-Host ''
    Write-Host '  [1] Open patch menu'
    Write-Host '  [0] Back to main menu'
    $selection = (Read-Host '  Select an option').Trim()
    if ($selection -eq '0') { return }
    if ($selection -ne '1') { Write-Host '  Invalid option.' -ForegroundColor Yellow; Wait-ForMenu; return }
    Push-Location -LiteralPath (Split-Path -Parent $Patch.Path)
    $previousExtension = $env:HYDRA_SUITE_EXTENSION
    try {
        if ([IO.Path]::GetExtension($Patch.Path) -ieq '.ps1') {
            & "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $Patch.Path | Out-Host
        } else {
            $env:HYDRA_SUITE_EXTENSION = $Patch.Path
            & $env:ComSpec /d /v:off /s /c '""%HYDRA_SUITE_EXTENSION%""' | Out-Host
        }
        if ($LASTEXITCODE -ne 0) { Write-Host ('  Patch exited with code '+$LASTEXITCODE) -ForegroundColor Yellow }
    } finally { $env:HYDRA_SUITE_EXTENSION=$previousExtension; Pop-Location }
    Wait-ForMenu
}

function Show-MainMenu {
    while ($true) {
        $catalog = @(Get-PatchCatalog)
        Show-Header 'Main menu'
        foreach ($patch in $catalog) { Write-Host ('  [{0}] {1}' -f $patch.Number,$patch.Name) }
        Write-Host ''
        Write-Host '  [H] Help / Add a future patch'
        Write-Host '  [0] Exit'
        Write-Host ''
        $selection = (Read-Host '  Select a patch').Trim()
        if ($selection -eq '0') { return }
        if ($selection -ieq 'H') {
            Show-Header 'Help / Extending the manager'
            Write-Host '  Steam = 1. GameShift = 2. Backup = 3. Each has its own submenu.'
            Write-Host '  Install / Update also repairs an existing installation.'
            Write-Host '  Remove deletes only the selected bridge and its launch hook.'
            Write-Host '  Personal Steam and GameShift settings are kept.'
            Write-Host ''
            Write-Host '  To add another patch:' -ForegroundColor Cyan
            Write-Host '  1. Create a folder named Patches beside this BAT.'
            Write-Host '  2. Put the new .bat, .cmd or .ps1 patch inside it.'
            Write-Host '  3. It appears automatically as option 4, then 5, 6, etc.'
            Write-Host '     Files are sorted by name. Use 04_Name.bat, 05_Name.bat.'
            Write-Host '     Additional patches keep their own menus and actions.'
            Write-Host ''
            Write-Host ('  Patches folder: '+(Join-Path $script:SuiteRoot 'Patches')) -ForegroundColor Gray
            Wait-ForMenu; continue
        }
        $patch = $catalog | Where-Object { [string]$_.Number -ceq $selection } | Select-Object -First 1
        if (!$patch) { Write-Host '  Invalid option. Choose one of the listed numbers.' -ForegroundColor Yellow; Wait-ForMenu; continue }
        try {
            if ($patch.Kind -eq 'BuiltIn') { Show-BuiltInMenu $patch }
            else { Invoke-ExternalPatch $patch }
        } catch { Show-Error $_; Wait-ForMenu }
    }
}

if ($LibraryOnly) { return }
try {
    if ($Action -eq 'Menu') { Show-MainMenu }
    else {
        $patch = $script:BuiltInPatches | Where-Object Id -eq $PatchId
        if ($Action -eq 'Status') { Get-PatchStatus $patch (Resolve-HydraDirectory) }
        else { Invoke-BuiltInPatch $patch $Action -Testing:$TestMode }
    }
} catch { Show-Error $_; exit 1 }
