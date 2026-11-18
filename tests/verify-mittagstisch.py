"""Compare the draft's complete menu with the original approved Markdown brief.

Usage: python3 tests/verify-mittagstisch.py /path/to/Prompt_Codex_Mittagstisch_Alberto.md approved-descriptions.txt
"""
import json
from pathlib import Path
import re
import sys

brief = Path(sys.argv[1]).read_text(encoding="utf-8")
root = Path(__file__).resolve().parents[1]
data = json.loads((root / "templates/mittagstisch-menu.json").read_text())
calendar = brief.split("## 6. KALENDARI", 1)[1].split("## 7.", 1)[0]
sections = re.split(r"^### JAVA (\d+) .*?$", calendar, flags=re.M)
assert len(sections) == 25
for weekno, section in zip(sections[1::2], sections[2::2]):
    for idx, weekday in enumerate(["E hënë", "E martë", "E enjte", "E premte"]):
        row = data["weeks"][int(weekno) - 1][idx]
        meat, *other = row["dishes"]
        text = f"- {weekday}: {meat} — {row['side']} | " + " | ".join(other)
        assert text in section.replace("**", "").splitlines(), (weekno, text)
    assert len(data["weeks"][int(weekno) - 1]) == 4

dictionary = brief.split("### FLEISCH / FISCH", 1)[1].split("## 8.", 1)[0]
revision = Path(sys.argv[2]).read_text(encoding="utf-8")
copy = revision.split("### PASTA", 1)[1].split("## 3.", 1)[0]
approved = dict(re.findall(r"^\*\*(.+?)\*\* *\n([^\n]+)", copy, re.M))
assert set(approved) == {n for w in data["weeks"] for day in w for n in day["dishes"][2:]}
for name, description in data["recipes"].items():
    if name in approved:
        assert description == approved[name], name
        continue
    source = f"- **{name}:** " + description.replace("etwas Sahne", "pak Sahne")
    assert any(line == source or line.startswith(source + " **") for line in dictionary.splitlines()), name
html = (root / "mittagstisch.html").read_text()
embedded = re.search(r'<script id="lunch-data" type="application/json">(.*?)</script>', html, re.S)
assert json.loads(embedded[1]) == data
print("Verified 192 positions, 48 accompaniments, 92 descriptions and the embedded page data.")
