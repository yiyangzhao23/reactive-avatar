import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"

VALID_FROM = {"A": "据", "B": "推断", "C": "设"}


def parse_evidence_rows():
    text = (DOCS / "evidence.md").read_text(encoding="utf-8")
    section = None
    rows = []
    for line in text.splitlines():
        heading = re.match(r"^##\s+([ABC])\.", line)
        if heading:
            section = heading.group(1)
            continue
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 4 or set(cells[0]) <= set("-: "):
            continue
        if cells[0] in {"#", "编号"}:
            continue
        rows.append((section, cells))
    return rows


def test_evidence_rows_have_valid_categories_and_sources():
    rows = parse_evidence_rows()
    assert rows

    counts = {"A": 0, "B": 0, "C": 0}
    source_tokens = (".py", ".js", ".md", ".html", "http", "docs/", "avatar-live/", "项目方确认", "curl", "官方", "Cloudflare")

    for section, cells in rows:
        assert section in VALID_FROM, f"row outside A/B/C: {cells}"
        category = cells[2]
        assert VALID_FROM[section] in category, f"{cells[0]} category must be {VALID_FROM[section]}"
        counts[section] += 1

        if section == "A":
            source = cells[3]
            assert len(source) > 4, f"{cells[0]} needs a source"
            assert any(token in source for token in source_tokens), f"{cells[0]} source is not traceable: {source}"

    assert counts["A"] >= 10
    assert counts["B"] >= 4
    assert counts["C"] >= 6


def test_evidence_rows_are_numbered_and_unique():
    rows = parse_evidence_rows()
    ids = [cells[0] for _, cells in rows]
    assert len(ids) == len(set(ids))
    for row_id in ids:
        assert re.fullmatch(r"[ABC]\d+", row_id), row_id


def test_docs_have_no_future_dates():
    today = date.today()
    latest_allowed = today + timedelta(days=1)
    pattern = re.compile(r"(?<!\d)(20\d{2})-(\d{1,2})-(\d{1,2})(?!\d)")

    for path in list(DOCS.glob("*.md")) + list(DOCS.glob("*.html")):
        text = path.read_text(encoding="utf-8")
        for match in pattern.finditer(text):
            year, month, day = (int(part) for part in match.groups())
            assert 2000 <= year <= today.year, f"{path.name}: suspicious year {match.group(0)}"
            try:
                claimed = date(year, month, day)
            except ValueError:
                raise AssertionError(f"{path.name}: invalid date {match.group(0)}")
            assert claimed <= latest_allowed, f"{path.name}: future date {match.group(0)}"
