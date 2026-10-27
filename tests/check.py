from pathlib import Path
import subprocess,shutil,sys,os,tempfile
root=Path(__file__).resolve().parent.parent
# Windows runners can expose an 8.3 TEMP alias. Fixtures must use its real path,
# just as production scans require a canonical, non-linked game directory.
fixture_temp=os.path.realpath(tempfile.gettempdir())
os.environ['TEMP']=fixture_temp
os.environ['TMP']=fixture_temp
node=shutil.which('node')
if not node:sys.exit('Node.js is required for source checks')
subprocess.run([node,str(root/'tests/test-maintenance-release.cjs')],check=True,cwd=root)
for file in sorted((root/'src').rglob('*')):
 if file.suffix in ('.js','.cjs'):subprocess.run([node,'--check',str(file)],check=True)
subprocess.run([node,'--check',str(root/'dist/hydra-nexus-bridge.cjs')],check=True)
for name in ['test-multiple-notes.cjs','test-update-file-lock.cjs','test-page-cleaner.cjs','test-update-progress.cjs','test-release-localization.cjs','test-backup-safety.cjs','test-runtime-safety.cjs','test-credential-safety.cjs','test-steam-preservation.cjs','test-update-safety.cjs','test-tools-performance.cjs','test-plugin-discovery.cjs','test-storage-roots.cjs','test-storage-transfer.cjs','test-i18n.cjs','test-replay.cjs','test-library-tools.cjs','test-privacy.cjs','test-native-privacy.cjs','test-startup-media.cjs','test-release-notes.cjs','test-core.cjs','test-faults.cjs','test-backup-performance.cjs','test-drive-folder.cjs','test-preview-backend.cjs','test-review.cjs','test-launch-audit.cjs','test-audit-fixes.cjs','test-deep-audit.cjs','test-update-rollback.cjs','test-updater-startup.cjs','test-update-shutdown.cjs','test-update-confirmation.cjs','test-installer-fuses.cjs','test-installer-transaction.cjs','test-steam-vdf.cjs','test-steam-legacy.cjs','test-native-shortcuts.cjs','test-native-renderer-route.cjs','test-ui-regressions.cjs','test-nexus-runtime.cjs','test-nexus-updater-faults.cjs','test-repair-regressions.cjs','test-repair-recovery.cjs','test-repair-worker.cjs','test-repair-installer.cjs','test-repair-packaging.cjs','test-preview-upgrade.cjs','test-video-background.cjs','test-background-media.cjs','test-background-csp.cjs','test-extract-path.cjs','test-extract-hooks.cjs','test-extract-path-audit.cjs']:
 subprocess.run([node,str(root/'tests'/name)],check=True,cwd=root)
print('All source and bundled runtime checks passed.')
