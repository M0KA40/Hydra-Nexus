from hashlib import sha256
import json
from pathlib import Path
import re
import subprocess
import sys

BASE = "e648436a3d99ff5aeaa848b629b4056804e07f9f"
OLD_ACHIEVEMENT = b"https://github.com/user-attachments/assets/5adbe1b9-05c3-460a-ad13-85ad4a72fe4c"
OLD_PAUSE = rb"!\[([^\]\r\n]+)\]\((?:\.\./\.\./)?assets/features/hydra-nexus-game-pause\.gif\)"
RAW = b"https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/main/assets/media/"
ACHIEVEMENT = "nexus-discovery-achievements"
PAUSE = "hydra-nexus-game-pause"
MEDIA = tuple(f"{stem}{suffix}" for stem in (ACHIEVEMENT, PAUSE) for suffix in (".mp4", "-preview.jpg"))
READMES = ("README.md", *(f"docs/readme/{lang}.md" for lang in ("ar", "de", "en", "es", "fr", "pl", "pt-BR", "ru", "tr")))

def require(condition, message):
    if not condition:
        raise SystemExit(message)

def git(*args):
    return subprocess.check_output(["git", "-C", str(checkout), *args], text=True).strip()

def linked_preview(alt, prefix, stem):
    name = stem.encode("ascii")
    return b"[![" + alt + b"](" + prefix + b"assets/media/" + name + b"-preview.jpg)](" + RAW + name + b".mp4)"

checkout = Path(sys.argv[1]).resolve()
payload = Path(__file__).resolve().parent / "payload"
require(git("rev-parse", "HEAD") == BASE, "Main moved since review. Review before publishing.")
require(not git("status", "--porcelain"), "The main checkout is not clean.")
manifest = json.loads((payload / "sha256.json").read_text(encoding="utf-8"))
require(set(manifest) == set(MEDIA), "Unexpected video payload paths.")
media = {}
for name in MEDIA:
    data = (payload / name).read_bytes()
    require(sha256(data).hexdigest() == manifest[name], f"Hash mismatch: {name}")
    require(data[4:8] == b"ftyp" if name.endswith(".mp4") else data.startswith(b"\xff\xd8\xff"), f"Invalid media signature: {name}")
    media[name] = data

pages = {}
for page in READMES:
    old = (checkout / page).read_bytes()
    require(old.count(OLD_ACHIEVEMENT) == 1, f"Unexpected achievement reference in {page}")
    matches = list(re.finditer(OLD_PAUSE, old))
    require(len(matches) == 1, f"Unexpected Game Pause reference in {page}")
    previous = old.split(OLD_ACHIEVEMENT, 1)[0]
    headings = re.findall(rb"^### (.+?)\r?$", previous, re.MULTILINE)
    require(bool(headings), f"Missing localized achievement heading in {page}")
    alt = headings[-1].replace(b"[", b"").replace(b"]", b"")
    prefix = b"" if page == "README.md" else b"../../"
    updated = old.replace(OLD_ACHIEVEMENT, linked_preview(alt, prefix, ACHIEVEMENT))
    updated, count = re.subn(OLD_PAUSE, lambda match: linked_preview(match[1], prefix, PAUSE), updated)
    require(count == 1, f"Could not replace Game Pause preview in {page}")
    require(all(updated.count(RAW + stem.encode("ascii") + b".mp4") == 1 for stem in (ACHIEVEMENT, PAUSE)), f"Invalid demo links in {page}")
    pages[page] = updated

for page, data in pages.items():
    (checkout / page).write_bytes(data)
for name, data in media.items():
    (checkout / "assets" / "media" / name).write_bytes(data)
allowlist = (*READMES, *(f"assets/media/{name}" for name in MEDIA))
git("add", "--", *allowlist)
require(git("diff", "--cached", "--name-only").splitlines() == sorted(allowlist), "Unexpected staged paths.")
require(not git("diff", "--name-only"), "Unexpected unstaged changes.")
print("Verified four media files and twenty demo links across ten README files.")
