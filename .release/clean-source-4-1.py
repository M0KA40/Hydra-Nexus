"""Replace the reviewed 4.1 source archive and its checksum entry."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
from copy import copy
from hashlib import sha256
import json, re, subprocess, sys

REPO = "M0KA40/Hydra-Nexus"
TAG = "v4.1"
SOURCE = "Hydra-Nexus-4.1-source.zip"
SUMS = "SHA256SUMS.txt"
OLD_SOURCE = "2a73fcb492e078e418e35cfc3bffa771f5f4ded229ea05ded8a475815a9e19d9"
NEW_SOURCE = "fccf790055de9a560f721b5b40f3c65921bb7857e86d0407b3151ce870d9bb85"
OLD_SUMS = "9bf700c22646754fcc2dda560ffd4be617240ca63b3cc61949aae8c2b2d5f342"
NEW_SUMS = "a281ffc93a4723591998d99e7a94d3f4b780be64c91540f7cb2a10ae1644673d"
PRESERVED = {
    "Hydra_Nexus.exe": "d505c611a0ea2f2d6ae94cdb993b722cea75ca9b88c425f6ccfd0e44ad8cc660",
    "Hydra-Nexus-exe-release.json": "c13d7613997aa2ac2c41a44f7e5cd99c1488571c0fc1e21c2a8d1b62b868e0d5",
    "Hydra-Nexus-4.1-release-notes.json": "8a7b4b2f3a59d767cd409ba3639598da3c19e8c28d50e84b16cf9d58d2343438",
}
ROOT = Path("release-cleanup")
PREVIOUS = ROOT / "previous"
UPDATED = ROOT / "updated"
VERIFIED = ROOT / "verified"

def gh(*args):
    return subprocess.check_output(["gh", *args], text=True, encoding="utf8")

def digest(path):
    return sha256(path.read_bytes()).hexdigest()

def release():
    return json.loads(gh("api", "repos/" + REPO + "/releases/tags/" + TAG))

def asset_map(data):
    return {item["name"]: item for item in data["assets"]}

def check_metadata(data, source_hash, sums_hash):
    assert data["id"] == 433039644 and data["tag_name"] == TAG
    assert not data["immutable"] and not data["draft"] and not data["prerelease"]
    assets = asset_map(data)
    expected = {**PRESERVED, SOURCE: source_hash, SUMS: sums_hash}
    assert set(assets) == set(expected)
    for name, checksum in expected.items():
        assert assets[name]["digest"] == "sha256:" + checksum, name

def download(destination, names):
    destination.mkdir(parents=True, exist_ok=True)
    args = ["release", "download", TAG, "--repo", REPO, "--dir", str(destination)]
    for name in names:
        args += ["--pattern", name]
    gh(*args)

def prepare():
    check_metadata(release(), OLD_SOURCE, OLD_SUMS)
    download(PREVIOUS, [SOURCE, SUMS])
    assert digest(PREVIOUS / SOURCE) == OLD_SOURCE
    assert digest(PREVIOUS / SUMS) == OLD_SUMS
    UPDATED.mkdir(parents=True)
    with ZipFile(PREVIOUS / SOURCE) as old:
        names = old.namelist()
        assert len(names) == 495 and len(set(names)) == len(names)
        for name in names:
            parts = PurePosixPath(name)
            assert str(parts) == name and parts.parts[0] == "Hydra-Nexus"
            assert ".." not in parts.parts and ":" not in name and "\\" not in name
        instructions = "Hydra-Nexus/AGENTS.md"
        manifest = "Hydra-Nexus/release-files.json"
        guide = "Hydra-Nexus/CONTRIBUTING.md"
        allowed = json.loads(old.read(manifest))
        assert set(names) == {"Hydra-Nexus/" + path for path in allowed}
        assert names.count(instructions) == 1 and allowed.count("AGENTS.md") == 1
        old_guide = old.read(guide)
        phrase = b"read [localization](docs/localization.md) and " + bytes([96]) + b"AGENTS.md" + bytes([96]) + b" before adding a feature."
        assert old_guide.count(phrase) == 1
        replacement = b"read the [layout rules](docs/page-layout.md) and [localization guide](docs/localization.md) before adding a feature."
        new_manifest, count = re.subn(rb'^  "AGENTS\.md",\r?\n', b"", old.read(manifest), flags=re.M)
        assert count == 1 and json.loads(new_manifest) == [p for p in allowed if p != "AGENTS.md"]
        edits = {guide: old_guide.replace(phrase, replacement), manifest: new_manifest}
        with ZipFile(UPDATED / SOURCE, "x", ZIP_DEFLATED, compresslevel=9) as new:
            new.comment = old.comment
            for item in old.infolist():
                if item.filename != instructions:
                    data = edits[item.filename] if item.filename in edits else old.read(item)
                    new.writestr(copy(item), data, compresslevel=9)
        with ZipFile(UPDATED / SOURCE) as new:
            assert new.namelist() == [name for name in names if name != instructions]
            assert new.testzip() is None
            for name in new.namelist():
                assert new.read(name) == (edits[name] if name in edits else old.read(name)), name
    assert digest(UPDATED / SOURCE) == NEW_SOURCE, "Prepared source differs from the reviewed local archive"
    before = (PREVIOUS / SUMS).read_bytes()
    needle = (OLD_SOURCE + "  " + SOURCE).encode()
    assert before.count(needle) == 1
    (UPDATED / SUMS).write_bytes(before.replace(needle, (NEW_SOURCE + "  " + SOURCE).encode()))
    assert digest(UPDATED / SUMS) == NEW_SUMS
    print("Prepared source and checksum match the reviewed local files exactly.")

def publish():
    assert digest(UPDATED / SOURCE) == NEW_SOURCE and digest(UPDATED / SUMS) == NEW_SUMS
    assert digest(PREVIOUS / SOURCE) == OLD_SOURCE and digest(PREVIOUS / SUMS) == OLD_SUMS
    before = release()
    check_metadata(before, OLD_SOURCE, OLD_SUMS)
    before_assets = asset_map(before)
    try:
        gh("release", "upload", TAG, str(UPDATED / SOURCE), str(UPDATED / SUMS), "--repo", REPO, "--clobber")
        after = release()
        check_metadata(after, NEW_SOURCE, NEW_SUMS)
        for key in ["body", "tag_name", "target_commitish", "draft", "prerelease", "name"]:
            assert after[key] == before[key], key
        for name in PRESERVED:
            assert asset_map(after)[name]["id"] == before_assets[name]["id"], name
        download(VERIFIED, [SOURCE, SUMS])
        assert digest(VERIFIED / SOURCE) == NEW_SOURCE and digest(VERIFIED / SUMS) == NEW_SUMS
        with ZipFile(VERIFIED / SOURCE) as archive:
            assert len(archive.namelist()) == 494
            assert not any(path.rsplit("/", 1)[-1].casefold() == "agents.md" for path in archive.namelist())
            assert archive.testzip() is None
    except BaseException:
        gh("release", "upload", TAG, str(PREVIOUS / SOURCE), str(PREVIOUS / SUMS), "--repo", REPO, "--clobber")
        check_metadata(release(), OLD_SOURCE, OLD_SUMS)
        raise
    print("Published and downloaded both replacement assets. Their SHA256 hashes match the reviewed files.")

{"prepare": prepare, "publish": publish}[sys.argv[1]]()
