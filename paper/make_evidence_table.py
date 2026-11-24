#!/usr/bin/env python3
"""Convert paper/evidence.csv (or data/evidence.csv) into paper/evidence-table.tex."""
import csv
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "evidence.csv"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "evidence-table.tex"

ESCAPES = str.maketrans({
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
})


def tex_escape(val: str) -> str:
    return val.strip().replace("\\", r"\textbackslash{}").translate(ESCAPES)


with SRC.open(newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

required = ("claim", "evidence", "locator", "level", "limit")
if not rows or any(col not in rows[0] for col in required):
    raise SystemExit(f"Expected CSV columns: {', '.join(required)} in {SRC}")

lines = [
    f"% Auto-generated from {SRC.name} by make_evidence_table.py — edit the CSV, not this file.",
    r"\begin{tabular}{p{0.27\textwidth}p{0.20\textwidth}p{0.13\textwidth}p{0.08\textwidth}p{0.22\textwidth}}",
    r"  \toprule",
    r"  \textbf{Claim / Element} & \textbf{Source / File} & \textbf{Locator} & \textbf{Level} & \textbf{Boundary / Limit} \\",
    r"  \midrule",
]
for r in rows:
    cells = " & ".join(tex_escape(r[c]) for c in required)
    lines.append(f"  {cells} \\\\")
lines.extend([r"  \bottomrule", r"\end{tabular}", ""])

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {OUT} ({len(rows)} rows from {SRC})")
