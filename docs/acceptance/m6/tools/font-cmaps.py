"""Map approved CSS unicode-range declarations to the actual Unicode cmaps in each WOFF2."""
import argparse
import json
import re
from pathlib import Path

from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--directory", type=Path, default=Path("labs/typography/fonts/v1.530"))
parser.add_argument("--output", type=Path, default=Path("docs/acceptance/m6/metrics/font-cmaps.json"))
args = parser.parse_args()
css = (args.directory / "faces.css").read_text(encoding="utf-8")


def ranges(value):
    codepoints = set()
    for part in value.split(","):
        limits = part.strip()[2:].split("-")
        first = int(limits[0].replace("?", "0"), 16)
        last = int(limits[-1].replace("?", "F"), 16)
        codepoints.update(range(first, last + 1))
    return codepoints


output = {}
for declaration in re.findall(r"@font-face\s*\{([^}]+)\}", css):
    name = re.search(r'"\./([^"]+\.woff2)"', declaration)[1]
    declared = ranges(re.search(r"unicode-range\s*:\s*([^;]+)", declaration)[1])
    path = args.directory / name
    with TTFont(path) as font:
        cmap = set(font.getBestCmap())
    output[name] = {
        "bytes": path.stat().st_size,
        "display": re.search(r"font-display\s*:\s*([^;]+)", declaration)[1].strip(),
        "cmapCount": len(cmap),
        "declared": len(declared),
        "chars": sorted(cmap & declared),
        "missingFromCmap": sorted(declared - cmap),
        "outsideRange": sorted(cmap - declared),
    }
if len(output) != 321:
    raise ValueError(f"Expected 321 unique WOFF2 references, got {len(output)}")
args.output.write_text(json.dumps(output, separators=(",", ":")) + "\n", encoding="utf-8")
