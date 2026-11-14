"""Rebuild the self-hosted Material Symbols subset from the full variable font.

The site ships a subset of Material Symbols Outlined containing only the icons
its templates actually render, because the full font is 4 MB. An icon that is
used but missing from the subset does not fail loudly: the ligature never
substitutes and the visitor sees the icon's name spelled out ("lock", "info").
So this script reads the icon names out of `src/`, resolves each one to the
glyph its ligature produces in the full font, and keeps exactly those glyphs.

usage:
  python tools/build-icon-font.py <MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].ttf> [--check]

The input font is the one Google Fonts serves (or
https://github.com/google/material-design-icons releases); it is not committed
because it is 4 MB. `--check` only reports whether the committed subset already
covers every icon in use, without writing anything.
"""

import re
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src" / "assets" / "fonts" / "material-symbols-outlined.woff2"
ICON_ATTRIBUTE = "material-symbols-outlined"


def icon_names() -> list[str]:
    """Every ligature name the templates ask for, in `material-symbols-outlined` spans."""
    pattern = re.compile(
        rf'{ICON_ATTRIBUTE}[^>]*>\s*([a-z][a-z_]*)\s*<',
    )
    names: set[str] = set()
    for path in sorted((ROOT / "src").rglob("*.astro")):
        names.update(pattern.findall(path.read_text(encoding="utf-8")))
    return sorted(names)


def ligature_glyphs(font: TTFont) -> dict[str, str]:
    """Map every ligature the font can form to the glyph it produces.

    Material Symbols names its component glyphs after the characters they draw
    ("a", "underscore"), so a ligature's name is its key glyph followed by its
    components, read back through the cmap.
    """
    gsub = font["GSUB"].table
    character_of = {glyph: chr(code) for code, glyph in font.getBestCmap().items()}

    def text(glyph: str) -> str:
        return character_of.get(glyph, glyph)

    def walk(subtable):
        if getattr(subtable, "LookupType", None) == 7:
            yield from walk(subtable.ExtSubTable)
            return
        if getattr(subtable, "ligatures", None):
            yield subtable

    found: dict[str, str] = {}
    for lookup in gsub.LookupList.Lookup:
        for subtable in lookup.SubTable:
            for table in walk(subtable):
                for first, entries in table.ligatures.items():
                    for entry in entries:
                        name = text(first) + "".join(text(c) for c in entry.Component)
                        found[name] = entry.LigGlyph
    return found


def names_in_subset(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return set(ligature_glyphs(TTFont(path)))


def main() -> int:
    check_only = "--check" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2

    source = Path(args[0])
    full = TTFont(source)
    available = ligature_glyphs(full)

    wanted = icon_names()
    missing_from_full = [n for n in wanted if n not in available]
    if missing_from_full:
        print(f"error: not in {source.name}: {', '.join(missing_from_full)}")
        return 1

    if check_only:
        covered = names_in_subset(OUTPUT)
        missing = [n for n in wanted if n not in covered]
        if missing:
            print(f"{OUTPUT.name} is missing: {', '.join(missing)}")
            return 1
        print(f"{OUTPUT.name} covers all {len(wanted)} icons in use")
        return 0

    glyphs = [available[name] for name in wanted]
    command = [
        sys.executable,
        "-m",
        "fontTools.subset",
        str(source),
        f"--output-file={OUTPUT}",
        "--flavor=woff2",
        # The names keep the letters, --glyphs keeps the icons those letters
        # ligate into. Without the explicit glyph list the closure step would
        # also drag in every other icon whose name happens to use the same
        # letters, which is most of the font.
        f"--text={' '.join(wanted)}",
        f"--glyphs={','.join(glyphs)}",
        "--no-layout-closure",
        "--layout-features=liga,rlig,ccmp",
    ]
    subprocess.run(command, check=True)

    written = names_in_subset(OUTPUT)
    missing = [n for n in wanted if n not in written]
    if missing:
        print(f"error: subset still misses {', '.join(missing)}")
        return 1
    print(
        f"wrote {OUTPUT.relative_to(ROOT)}: {OUTPUT.stat().st_size} bytes, "
        f"{len(written)} icons ({len(wanted)} in use)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
