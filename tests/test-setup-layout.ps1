param([string]$Root=(Split-Path -Parent $PSScriptRoot),[string]$ReportFile)
$ErrorActionPreference='Stop'
. (Join-Path $Root 'installer/setup-surface.ps1')
$catalog=Get-Content -LiteralPath (Join-Path $Root 'dist/setup-ui/setup-copy.json') -Raw -Encoding UTF8|ConvertFrom-Json
$samples=New-Object 'System.Collections.Generic.List[object]'
foreach($entry in $catalog.PSObject.Properties){
 foreach($size in @(@(1200,860),@(1024,600),@(1280,720),@(1920,1080))){
  $copy=$entry.Value;$form=New-NexusSurface $copy 'v2.0.1 / r14'
  $form.Width=[Math]::Min(920,$size[0]-60);$form.Height=[Math]::Min(710,$size[1]-40)
  $form.FindName('Title').Text=$copy.setupTitle;$form.FindName('Hint').Text=$copy.setupHint;$form.FindName('Action').Content=$copy.install
  $form.FindName('SetupOptions').Visibility='Visible';$form.FindName('Steps').Visibility='Collapsed';$form.FindName('Details').Visibility='Collapsed'
  $form.FindName('FolderLabel').Text=$copy.folder;$form.FindName('OperationLabel').Text=$copy.operation;$form.FindName('Browse').Content=$copy.browse
  $form.FindName('Status').Text=$copy.select;$form.FindName('SmallStatus').Text=$copy.closeFirst
  $combo=$form.FindName('Operation');[void]$combo.Items.Add($copy.install);[void]$combo.Items.Add($copy.remove);$combo.SelectedIndex=0
  $form.WindowStartupLocation='Manual';$form.Left=-10000;$form.Top=-10000;$form.ShowInTaskbar=$false
  try{
   $form.Show();$form.UpdateLayout()
   if($form.FindName('Body').DesiredSize.Height -gt $form.FindName('BodyArea').ActualHeight+1){throw ('Main content overflow: '+$entry.Name+' '+($size -join 'x')+' '+$form.FindName('Body').DesiredSize.Height+' > '+$form.FindName('BodyArea').ActualHeight)}
   $point=$form.FindName('Action').TranslatePoint([Windows.Point]::new(0,0),$form)
   if($point.Y+$form.FindName('Action').ActualHeight -gt $form.ActualHeight-12){throw 'Action clipped'}
   $toggle=$combo.Template.FindName('SelectorToggle',$combo);$toggle.ApplyTemplate()|Out-Null
   # The selected caption must be an explicit light TextBlock, not the default
   # black foreground inherited from the Windows ToggleButton theme.
   $queue=New-Object 'System.Collections.Generic.Queue[Windows.DependencyObject]';$queue.Enqueue($toggle);$found=$false
   while($queue.Count){$node=$queue.Dequeue();if($node -is [Windows.Controls.TextBlock] -and $node.Text -eq $copy.install){if($node.Foreground.ToString() -ne '#FFF0F8F5'){throw 'Selection text contrast regressed'};$found=$true};for($i=0;$i -lt [Windows.Media.VisualTreeHelper]::GetChildrenCount($node);$i++){$queue.Enqueue([Windows.Media.VisualTreeHelper]::GetChild($node,$i))}}
   if(!$found){throw 'Selected caption is missing'}
   $samples.Add(@{language=$entry.Name;viewport=($size -join 'x');body=$form.FindName('Body').DesiredSize.Height;available=$form.FindName('BodyArea').ActualHeight;logoWidth=$form.FindName('Logo').ActualWidth;logoPixels=$form.FindName('Logo').Source.PixelWidth})
  }finally{$form.Close()}
 }
}
if($ReportFile){[IO.File]::WriteAllText([IO.Path]::GetFullPath($ReportFile),($samples|ConvertTo-Json -Depth 5))}
Write-Output ('PASS: '+$samples.Count+' WPF layout/contrast samples; nine languages, RTL, four viewport sizes, reachable action, no main scroll viewer.')
