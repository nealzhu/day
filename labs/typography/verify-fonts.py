"""Check generated unicode ranges and file identities against the release's Unicode cmap."""
from hashlib import sha256
from pathlib import Path
import re
import sys

from fontTools.ttLib import TTFont

original, directory = map(Path, sys.argv[1:])
with TTFont(original) as font:
    expected = set(font.getBestCmap())
seen = set()
files = set()
css = (directory / "faces.css").read_text()
for rule in re.findall(r"@font-face\{([^}]+)\}", css):
    name = re.search(r'url\("\./([a-f0-9]{20}\.woff2)"\)', rule)[1]
    path = directory / name
    if name != sha256(path.read_bytes()).hexdigest()[:20] + ".woff2" or name in files:
        raise ValueError(f"Invalid content address: {name}")
    declared = set()
    for span in re.search(r"unicode-range:([^;]+);", rule)[1].split(","):
        ends = span.removeprefix("U+").split("-")
        declared.update(range(int(ends[0], 16), int(ends[-1], 16) + 1))
    with TTFont(path) as subset:
        if not declared <= set(subset.getBestCmap()) or seen & declared:
            raise ValueError(f"Unmapped or overlapping code points: {name}")
    seen.update(declared)
    files.add(name)

if seen != expected or files != {p.name for p in directory.glob("*.woff2")}:
    raise ValueError("Coverage or file inventory differs")
print(f"{len(files)} subsets cover {len(seen)} code points, {sum((directory / f).stat().st_size for f in files)} B")
