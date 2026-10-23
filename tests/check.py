from pathlib import Path
import subprocess,shutil,sys
root=Path(__file__).resolve().parent.parent
node=shutil.which('node')
if not node:sys.exit('Node.js is required for source checks')
for file in sorted((root/'src').rglob('*')):
 if file.suffix in ('.js','.cjs'):subprocess.run([node,'--check',str(file)],check=True)
subprocess.run([node,'--check',str(root/'dist/hydra-nexus-bridge.cjs')],check=True)
for name in ['test-i18n.cjs','test-privacy.cjs','test-native-privacy.cjs','test-startup-media.cjs','test-release-notes.cjs','test-core.cjs','test-faults.cjs','test-backup-performance.cjs','test-drive-folder.cjs','test-preview-backend.cjs','test-review.cjs','test-launch-audit.cjs','test-audit-fixes.cjs','test-deep-audit.cjs','test-update-rollback.cjs','test-updater-startup.cjs','test-update-shutdown.cjs','test-update-confirmation.cjs','test-installer-fuses.cjs','test-installer-transaction.cjs','test-steam-vdf.cjs','test-steam-legacy.cjs','test-native-shortcuts.cjs','test-native-renderer-route.cjs','test-ui-regressions.cjs','test-nexus-runtime.cjs','test-nexus-updater-faults.cjs']:
 subprocess.run([node,str(root/'tests'/name)],check=True,cwd=root)
print('All source and bundled runtime checks passed.')
