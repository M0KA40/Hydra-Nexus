function Remove-NexusRetiredHooks([string]$Text){
    $retired=[pscustomobject]@{Id='backup';CjsHook='require("./hydra-backup-bridge.cjs"); // HYDRA_BACKUP_HOOK_V2';EsmHook='import { createRequire as __hbkCreateRequire } from "module"; __hbkCreateRequire(import.meta.url)("./hydra-backup-bridge.cjs"); // HYDRA_BACKUP_HOOK_V2'}
    return Remove-PatchHooks $Text $retired
}
function Remove-NexusRetiredComponents($State){
    foreach($name in @('hydra-legacy-backup.cjs','hydra-backup-bridge.cjs')){$State.Files.PSObject.Properties.Remove($name)}
    foreach($folder in @('out','dist')){$assets=$State.Header.files.$folder.files.renderer.files.assets;if($assets){$assets.files.PSObject.Properties.Remove('nexus-guide-backup.webp')}}
}
