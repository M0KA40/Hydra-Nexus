from pathlib import Path
import subprocess,shutil,sys,os,tempfile
root=Path(__file__).resolve().parent.parent
import argparse
options=argparse.ArgumentParser()
options.add_argument('--from-test',default=None,help='Resume after an already recorded passing prefix')
resume=options.parse_args().from_test
# Windows runners can expose an 8.3 TEMP alias. Fixtures must use its real path,
# just as production scans require a canonical, non-linked game directory.
fixture_temp=os.path.realpath(tempfile.gettempdir())
os.environ['TEMP']=fixture_temp
os.environ['TMP']=fixture_temp
node=shutil.which('node')
if not node:sys.exit('Node.js is required for source checks')
for file in sorted((root/'src').rglob('*')):
 if file.suffix in ('.js','.cjs'):subprocess.run([node,'--check',str(file)],check=True)
subprocess.run([node,'--check',str(root/'dist/hydra-nexus-bridge.cjs')],check=True)
for name in ["test-cloud-package.cjs","test-cloud-hardening.cjs","test-cloud-known-saves.cjs","test-cloud-status.cjs","test-cloud-policy.cjs","test-cloud-locations.cjs","test-cloud-recovery.cjs","test-cloud-source-eligibility.cjs","test-cloud-preferences.cjs","test-cloud-game-files.cjs","test-cloud-update-package.cjs","test-cloud-bundled-tools.cjs","test-cloud-backup.cjs","test-cloud-service.cjs","test-cloud-integration.cjs","test-cloud-rclone.cjs","test-cloud-security.cjs","test-cloud-rclone-native.cjs","test-cloud-ludusavi.cjs","test-discovery-feed.cjs","test-multiple-notes.cjs","test-update-file-lock.cjs","test-page-cleaner.cjs","test-release-localization.cjs","test-runtime-safety.cjs","test-credential-safety.cjs","test-steam-preservation.cjs","test-update-safety.cjs","test-tools-performance.cjs","test-plugin-discovery.cjs","test-storage-roots.cjs","test-storage-transfer.cjs","test-i18n.cjs","test-replay.cjs","test-privacy.cjs","test-native-privacy.cjs","test-startup-media.cjs","test-release-notes.cjs","test-preview-backend.cjs","test-review.cjs","test-launch-audit.cjs","test-update-shutdown.cjs","test-update-confirmation.cjs","test-installer-fuses.cjs","test-installer-presentation.cjs","test-installer-transaction.cjs","test-steam-vdf.cjs","test-steam-legacy.cjs","test-native-shortcuts.cjs","test-native-renderer-route.cjs","test-ui-regressions.cjs","test-nexus-runtime.cjs","test-nexus-updater-faults.cjs","test-repair-recovery.cjs","test-repair-worker.cjs","test-repair-installer.cjs","test-repair-packaging.cjs","test-preview-upgrade.cjs","test-video-background.cjs","test-background-media.cjs","test-background-csp.cjs","test-extract-path.cjs","test-extract-hooks.cjs","test-extract-path-audit.cjs","test-native-commit.cjs","test-theme-imports.cjs","test-interface-weight.cjs","test-runtime-policy.cjs","test-steam-lifecycle.cjs","test-installer-growth.cjs","test-setup-cleanup.cjs"]:
 if resume and name!=resume:continue
 resume=None
 subprocess.run([node,str(root/'tests'/name)],check=True,cwd=root)
print('Resumed source checks passed.' if options.parse_args().from_test else 'All source and bundled runtime checks passed.')
subprocess.run([node,str(root/'tests/test-steam-news.cjs')],check=True,cwd=root)
subprocess.run([node,str(root/'tests/test-interface.cjs')],check=True,cwd=root)


# Native distribution replaces the retired BAT worker integration suites.
subprocess.run([node,str(root/"tests/test-exe-contract.cjs")],check=True,cwd=root)

subprocess.run([node,str(root/"tests/test-hybrid-release.cjs")],check=True,cwd=root)
