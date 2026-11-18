import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "avatar-live"
DOCS = ROOT / "docs"


def test_docs_and_plan_boundaries_exist():
    for name in ("plan.md", "evidence.md", "goal.md", "flow.md", "architecture-explainer.html"):
        assert (DOCS / name).is_file(), name

    plan = (DOCS / "plan.md").read_text(encoding="utf-8")
    for phase in ("P0", "P1", "P2", "P3", "P4"):
        assert phase in plan, f"plan missing {phase}"

    goal = (DOCS / "goal.md").read_text(encoding="utf-8")
    assert "docs/plan.md" in goal
    assert "docs/evidence.md" in goal


def test_frontend_asset_versions_are_explicit():
    html = (APP / "index.html").read_text(encoding="utf-8")
    assert re.search(r'src="\./src/main\.js\?v=\d+"', html)

    main = (APP / "src/main.js").read_text(encoding="utf-8")
    for module in ("avatar", "perception", "brain", "voice"):
        assert re.search(rf"from '\./{module}\.js\?v=\d+'", main), f"{module}.js needs ?v="

    sw = (APP / "sw.js").read_text(encoding="utf-8")
    assert re.search(r"CACHE = 'reactive-avatar-v\d+'", sw)


def test_pages_function_and_gateway_alignment():
    fn = (APP / "functions/llm.js").read_text(encoding="utf-8")
    assert "https://opencode.ai/inference/openai/v1/chat/completions" in fn
    assert "Authorization" in fn
    assert "/llm" in (ROOT / "docs/plan.md").read_text(encoding="utf-8")


def test_model_manifest_matches_parts_if_present():
    manifest_path = APP / "model-parts" / "manifest.json"
    if not manifest_path.is_file():
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["parts"] == len(manifest["files"])
    total = 0
    for entry in manifest["files"]:
        assert entry["file"].startswith(f"part-{manifest['sha256'][:8]}-")
        assert entry["size"] <= 25 * 1024 * 1024
        path = manifest_path.parent / entry["file"]
        assert path.is_file()
        assert path.stat().st_size == entry["size"]
        total += entry["size"]
    assert total == manifest["size"]


def test_judge_rubric_and_script_exist():
    rubric = (DOCS / "judge-rubric.md").read_text(encoding="utf-8")
    for token in ("角色一致性", "据", "推断", "设", "年代"):
        assert token in rubric
    assert (ROOT / "scripts" / "judge.py").is_file()
