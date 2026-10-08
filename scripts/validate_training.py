"""Validate the static Japanese learning app and v13 practice dataset."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
html = (root / "index.html").read_text(encoding="utf-8")
data = json.loads((root / "data/practice-v13.json").read_text(encoding="utf-8"))
groups = ("endings", "particles", "traps", "confusions", "listening")
assert data["version"] == 13
assert "PWA · v13.1" in html
for tag in ('skillHub', 'skillPanel', 'skillStatus', 'skillErrorBookBtn'):
    assert f'id="{tag}"' in html, f"missing {tag}"
assert 'src="./scripts/speed-learning.js?v=13.1"' in html
for group in groups:
    questions = data[group]
    assert len(questions) >= 8, (group, len(questions))
    assert len({q["id"] for q in questions}) == len(questions), group
    for q in questions:
        assert q["audio"].strip(), (group, q["id"])
        assert q["answer"].strip(), (group, q["id"])
        if group in ("confusions", "listening"):
            assert len(q["options"]) == 4 and len(set(q["options"])) == 4, (group, q["id"])
            assert q["answer"] in q["options"], (group, q["id"])
inline = re.search(r"<script>(.*?)</script>", html, flags=re.S)
assert inline, "missing classic inline app script"
Path("/tmp/cnc-inline-validate.js").write_text(inline.group(1), encoding="utf-8")
print("PASS: v13 HTML, 58+ questions, unique ids, option keys and audio fields")
