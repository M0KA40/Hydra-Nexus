from pathlib import Path
import subprocess,shutil,sys
root=Path(__file__).resolve().parent.parent
node=shutil.which('node')
if not node:sys.exit('Node.js is required for source checks')
for file in sorted((root/'src').glob('*')):
 if file.suffix in ('.js','.cjs'):subprocess.run([node,'--check',str(file)],check=True)
subprocess.run([node,'--check',str(root/'dist/hydra-nexus-bridge.cjs')],check=True)
for name in ['test-core.cjs','test-faults.cjs','test-preview-backend.cjs','test-review.cjs','test-launch-audit.cjs','test-nexus-runtime.cjs','test-nexus-updater-faults.cjs']:
 subprocess.run([node,str(root/'tests'/name)],check=True,cwd=root)
print('All source and bundled runtime checks passed.')
