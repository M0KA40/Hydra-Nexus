from pathlib import Path
import subprocess,shutil,sys,os,tempfile
root=Path(__file__).resolve().parent.parent
import argparse
options=argparse.ArgumentParser()
options.add_argument('--from-test',default=None,help='Resume after an already recorded passing prefix')
options.add_argument('--browser',action='store_true',help='Also run the built-renderer browser acceptance suites')
options.add_argument('--browser-only',action='store_true',help='Run only the built-renderer browser acceptance suites')
arguments=options.parse_args()
resume=arguments.from_test
# Windows runners can expose an 8.3 TEMP alias. Fixtures must use its real path,
# just as production scans require a canonical, non-linked game directory.
fixture_temp=os.path.realpath(tempfile.gettempdir())
os.environ['TEMP']=fixture_temp
os.environ['TMP']=fixture_temp
node=shutil.which('node')
if not node:sys.exit('Node.js is required for source checks')
def browser_checks():
 env=os.environ.copy()
 env.pop('ND_THEME_AUDIT',None)
 env.setdefault('HYDRA_NATIVE_FIXTURES',str(root.parent/'Development/Verification/4.0/native-fixture'))
 env.setdefault('HYDRA_NATIVE_CSS',str(Path(env['HYDRA_NATIVE_FIXTURES'])/'hydra-native.css'))
 env.setdefault('HYDRA_NATIVE_REACT',str(Path(env['HYDRA_NATIVE_FIXTURES'])/'react-runtime.js'))
 env.setdefault('HYDRA_BROWSER_EXE',r'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
 env['ND_COMPILED_RENDERER']='1'
 env.setdefault('NEXUS_BROWSER_EXE',env['HYDRA_BROWSER_EXE'])
 if 'HYDRA_PLAYWRIGHT_PATH' in env:env.setdefault('NEXUS_PLAYWRIGHT_PATH',env['HYDRA_PLAYWRIGHT_PATH'])
 for name in ['test-release-rollout-r4-browser.cjs','test-statistics-entry-browser.cjs','test-theme-isolation-browser.cjs','test-calendar-browser.cjs','test-statistics-states-browser.cjs','test-statistics-integration-browser.cjs','verify-stats-native-bridge.cjs','verify-stats-native-language.cjs','verify-stats-native-lifecycle.cjs','test-achievement-discovery-browser.cjs','test-achievement-queue-browser.cjs','test-interface-materials-browser.cjs','test-discovery-support-surfaces-browser.cjs','test-discovery-rollout-browser.cjs','test-discovery-home-browser.cjs','test-discovery-pages-browser.cjs','test-discovery-game-browser.cjs','test-discovery-downloads-browser.cjs']:
  subprocess.run([node,str(root/'tests'/name)],check=True,cwd=root,env=env)
if arguments.browser_only:
 browser_checks()
 sys.exit(0)
for file in sorted((root/'src').rglob('*')):
 if file.suffix in ('.js','.cjs'):subprocess.run([node,'--check',str(file)],check=True)
subprocess.run([node,'--check',str(root/'dist/hydra-nexus-bridge.cjs')],check=True)
for name in ["test-calendar-language.cjs","test-calendar-model.cjs","test-statistics-contract.cjs","test-achievement-preview.cjs","test-achievement-discovery.cjs","test-local-cloud-coexistence.cjs","test-backup-destinations.cjs","test-backup-achievement-formats.cjs","test-backup-achievements.cjs","test-local-saves.cjs","test-diagnostics.cjs","test-cloud-package.cjs","test-cloud-hardening.cjs","test-cloud-known-saves.cjs","test-cloud-status.cjs","test-cloud-policy.cjs","test-cloud-locations.cjs","test-cloud-recovery.cjs","test-cloud-source-eligibility.cjs","test-cloud-preferences.cjs","test-cloud-game-files.cjs","test-cloud-update-package.cjs","test-cloud-bundled-tools.cjs","test-cloud-backup.cjs","test-cloud-service.cjs","test-cloud-integration.cjs","test-cloud-rclone.cjs","test-cloud-security.cjs","test-cloud-rclone-native.cjs","test-cloud-ludusavi.cjs","test-discovery-feed.cjs","test-discovery-wishlist-ui.cjs","test-multiple-notes.cjs","test-update-file-lock.cjs","test-page-cleaner.cjs","test-release-localization.cjs","test-runtime-safety.cjs","test-credential-safety.cjs","test-steam-preservation.cjs","test-update-safety.cjs","test-tools-performance.cjs","test-plugin-discovery.cjs","test-storage-roots.cjs","test-storage-transfer.cjs","test-i18n.cjs","test-replay.cjs","test-discovery-replay.cjs","test-privacy.cjs","test-native-privacy.cjs","test-startup-media.cjs","test-release-notes.cjs","test-preview-backend.cjs","test-review.cjs","test-launch-audit.cjs","test-update-shutdown.cjs","test-cloud-update-handoff.cjs","test-update-confirmation.cjs","test-installer-fuses.cjs","test-installer-presentation.cjs","test-installer-transaction.cjs","test-steam-vdf.cjs","test-steam-legacy.cjs","test-native-shortcuts.cjs","test-native-renderer-route.cjs","test-ui-regressions.cjs","test-nexus-runtime.cjs","test-nexus-updater-faults.cjs","test-repair-recovery.cjs","test-repair-worker.cjs","test-repair-installer.cjs","test-repair-packaging.cjs","test-preview-upgrade.cjs","test-video-background.cjs","test-background-media.cjs","test-background-csp.cjs","test-extract-path.cjs","test-extract-hooks.cjs","test-extract-path-audit.cjs","test-native-commit.cjs","test-discovery-startup-order.cjs","test-discovery-sort.cjs","test-discovery-achievement-grid.cjs","test-theme-imports.cjs","test-interface-weight.cjs","test-runtime-policy.cjs","test-steam-lifecycle.cjs","test-installer-growth.cjs","test-setup-cleanup.cjs"]:
 if resume and name!=resume:continue
 resume=None
 subprocess.run([node,str(root/'tests'/name)],check=True,cwd=root)
print('Resumed source checks passed.' if options.parse_args().from_test else 'All source and bundled runtime checks passed.')
subprocess.run([node,str(root/'tests/test-steam-news.cjs')],check=True,cwd=root)
subprocess.run([node,str(root/'tests/test-interface.cjs')],check=True,cwd=root)


# Native distribution replaces the retired BAT worker integration suites.
subprocess.run([node,str(root/"tests/test-exe-contract.cjs")],check=True,cwd=root)

subprocess.run([node,str(root/"tests/test-hybrid-release.cjs")],check=True,cwd=root)
if arguments.browser:browser_checks()
