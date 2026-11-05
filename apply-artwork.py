from hashlib import sha256
import json
from pathlib import Path
import posixpath
import re
import subprocess
import sys

BASE = "686929875a4c6cbac286e946d69485fad529ba7d"
FEATURES = (
    "assets/features/activity.webp",
    "assets/features/discovery.webp",
    "assets/features/hydra-nexus-steamgriddb-artwork.png",
    "assets/features/steam.webp",
)
LANGUAGES = ("ar", "de", "en", "es", "fr", "pl", "pt-BR", "ru", "tr")
READMES = ("README.md", *(f"docs/readme/{lang}.md" for lang in LANGUAGES))
RAW_PREFIX = "https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/main/"

def git(*args):
    return subprocess.check_output(["git", "-C", str(checkout), *args], text=True).strip()

def require(condition, message):
    if not condition:
        raise SystemExit(message)

def resolves_from(page, url):
    if url.startswith(RAW_PREFIX):
        return url.removeprefix(RAW_PREFIX)
    if "://" not in url:
        return posixpath.normpath(posixpath.join(posixpath.dirname(page), url))
    return None

checkout = Path(sys.argv[1]).resolve()
payload = Path(__file__).resolve().parent / "payload"
require(git("rev-parse", "HEAD") == BASE, "Main moved since review. Refresh the image plan.")
require(not git("status", "--porcelain"), "The main checkout is not clean.")
for page in READMES:
    markdown = (checkout / page).read_text(encoding="utf-8")
    urls = re.findall(r"!\[[^\]\n]*\]\(([^\s)]+)\)", markdown)
    references = [resolves_from(page, url) for url in urls]
    require(all(references.count(asset) == 1 for asset in FEATURES), f"Unexpected image references in {page}")

manifest = json.loads((payload / "sha256.json").read_text(encoding="utf-8"))
require(set(manifest) == set(FEATURES), "Unexpected image manifest paths.")
for asset in FEATURES:
    image = (payload / Path(asset).name).read_bytes()
    require(sha256(image).hexdigest() == manifest[asset], f"Hash mismatch: {asset}")
    if asset.endswith(".png"):
        require(image.startswith(b"\x89PNG\r\n\x1a\n"), f"Not a PNG: {asset}")
    else:
        require(image[:4] == b"RIFF" and image[8:12] == b"WEBP", f"Not WebP: {asset}")
    target = checkout / asset
    require(target.is_file() and not target.is_symlink(), f"Unexpected target: {asset}")
    target.write_bytes(image)

git("add", "--", *FEATURES)
staged = git("diff", "--cached", "--name-only").splitlines()
require(staged == sorted(FEATURES), f"Unexpected staged paths: {staged}")
require(not git("diff", "--name-only"), "Unexpected unstaged changes.")
print("Verified four image hashes, exactly four staged changes, and 40 image references across ten README files.")
