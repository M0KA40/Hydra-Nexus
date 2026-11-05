from pathlib import Path
import json
import re
import subprocess
import sys

BASE = "b359fbaa54642fc878924ca34a126c104f722489"
READMES = ("README.md", *(f"docs/readme/{lang}.md" for lang in ("ar", "de", "en", "es", "fr", "pl", "pt-BR", "ru", "tr")))
STEMS = ("nexus-discovery-achievements", "hydra-nexus-game-pause")
RAW = rb"https://raw\.githubusercontent\.com/M0KA40/Hydra-Nexus/main/assets/media/"

def git(*args):
    return subprocess.check_output(["git", "-C", str(checkout), *args], text=True).strip()

def require(condition, message):
    if not condition:
        raise SystemExit(message)

checkout = Path(sys.argv[1]).resolve()
urls = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
require(set(urls) == set(STEMS), "Unexpected attachment manifest.")
require(len(set(urls.values())) == 2, "Video attachments must be distinct.")
require(all(re.fullmatch(r"https://github\.com/user-attachments/assets/[0-9a-f-]{36}", url) for url in urls.values()), "Unexpected GitHub attachment URL.")
require(git("rev-parse", "HEAD") == BASE, "Main moved since review.")
require(not git("status", "--porcelain"), "Checkout is not clean.")

updates = {}
for page in READMES:
    text = (checkout / page).read_bytes()
    for stem in STEMS:
        name = re.escape(stem.encode("ascii"))
        expression = rb"^\[!\[[^\r\n]*\]\((?:\.\./\.\./)?assets/media/" + name + rb"-preview\.jpg\)\]\(" + RAW + name + rb"\.mp4\)(?=\r?$)"
        text, count = re.subn(expression, urls[stem].encode("ascii"), text, flags=re.MULTILINE)
        require(count == 1, f"Expected one {stem} preview in {page}")
    updates[page] = text
for page, text in updates.items():
    (checkout / page).write_bytes(text)
git("add", "--", *READMES)
require(git("diff", "--cached", "--name-only").splitlines() == sorted(READMES), "Unexpected staged paths.")
print("Verified 20 inline attachment references across the ten README files.")
