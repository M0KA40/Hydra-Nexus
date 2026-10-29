param([Alias('AsCommand')][switch]$MetadataAsCommand,[Alias('File')][string]$MetadataInputFile,[Alias('ExplicitVersion')][string]$MetadataExplicitVersion)
# Read metadata only. Never execute or expand the selected script's contents.
function Get-NexusBatMetadata([string]$Path,[string]$Override){
    $number='[0-9]+(?:\.[0-9]+){1,3}(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?'
    if($Override){
        if($Override -notmatch ('^v?(?<version>'+$number+')$') -or $Override.Length -gt 64){throw 'Version must be a literal version such as 2.0.1 or 2.0.1-preview.2.'}
        return [pscustomobject]@{version=$Matches.version;revision=$null;versionSource='explicit'}
    }
    $text=[IO.File]::ReadAllText([IO.Path]::GetFullPath($Path),[Text.Encoding]::UTF8)
    $declaration='(?:VERSION|APP_?VERSION|NEXUS_?VERSION|PRODUCT_?VERSION|RELEASE_?VERSION|SCRIPT_?VERSION|TOOL_?VERSION)'
    $patterns=@(
        ('(?im)^::[ \t]+HYDRA_NEXUS_RELEASE[ \t]+(?<version>'+$number+')[ \t]*\r?$'),
        ('(?im)^[ \t]*@?set[ \t]+"?'+$declaration+'[ \t]*=[ \t]*v?(?<version>'+$number+')[ \t]*"?[ \t]*\r?$'),
        ('(?im)^[ \t]*\$(?:script:|global:)?'+$declaration+'[ \t]*=[ \t]*[''\"]v?(?<version>'+$number+')[''\"][ \t]*;?[ \t]*\r?$'),
        ('(?im)^[ \t]*(?:::|rem\b|#)[ \t]*(?:version|release version|app version)[ \t]*[:=]?[ \t]+v?(?<version>'+$number+')[ \t]*\r?$'),
        ('(?im)^[ \t]*@?title[ \t]+[^\r\n]{0,160}?[ \t]+v(?<version>'+$number+')[ \t]*\r?$')
    )
    foreach($pattern in $patterns){
        $versions=@([regex]::Matches($text,$pattern) | ForEach-Object {$_.Groups['version'].Value} | Select-Object -Unique)
        if($versions.Count -gt 1){return [pscustomobject]@{version=$null;revision=$null;versionSource='ambiguous'}}
        if($versions.Count -eq 1){
            $revision=$null
            if($pattern -eq $patterns[0]){
                $match=[regex]::Match($text,'(?im)^::[ \t]+HYDRA_NEXUS_REVISION[ \t]+([0-9]+)[ \t]*\r?$')
                $parsed=0;if($match.Success -and [int]::TryParse($match.Groups[1].Value,[ref]$parsed) -and $parsed -gt 0){$revision=$parsed}
            }
            return [pscustomobject]@{version=$versions[0];revision=$revision;versionSource='script'}
        }
    }
    return [pscustomobject]@{version=$null;revision=$null;versionSource='missing'}
}
if($MetadataAsCommand){Get-NexusBatMetadata $MetadataInputFile $MetadataExplicitVersion | ConvertTo-Json -Compress}
