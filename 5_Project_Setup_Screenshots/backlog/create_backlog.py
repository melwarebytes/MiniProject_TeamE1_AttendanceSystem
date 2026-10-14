#!/usr/bin/env python3
"""
Creates the SAMS backlog on GitHub from backlog.json:
  - labels (type, priority, story points, owner)
  - milestones "Sprint 1" and "Sprint 2" with due dates
  - one issue per backlog item, with an Owner line and owner label, put in its sprint
    (assigned on GitHub only when the owner has a username in USERS)
  - a GitHub Project linked to the repo, with "Story Points" and "Sprint" fields filled in

Requirements: GitHub CLI (gh) logged in with project scope:
    gh auth login
    gh auth refresh -s project

Usage:
    python3 create_backlog.py --dry-run     # print what would happen
    python3 create_backlog.py               # do it
"""
import argparse, json, subprocess, sys
from pathlib import Path

# ---------- EDIT THESE ----------
OWNER = "melwarebytes"            # repo owner (user or org)
REPO = "MiniProject_TeamE1_AttendanceSystem"  # repo name
USERS = {                         # GitHub usernames; leave "" to skip assigning
    "merull": "melwarebytes",
    "raj": "",                    # no GitHub username configured: not assigned
    "bhuvan": "",                 # no GitHub username configured: not assigned
}
NAMES = {                         # shown in the "Owner:" line of every issue
    "merull": "Merull Shah",
    "raj": "N S Raj Nanjappa",
    "bhuvan": "N Bhuvan Teja",
}
# --------------------------------

DRY = False

def gh(*args, capture=True):
    cmd = ["gh", *args]
    if DRY:
        print("  $", " ".join(a if " " not in a else repr(a) for a in cmd))
        return ""
    r = subprocess.run(cmd, capture_output=capture, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd[:4])}... failed:\n{r.stderr.strip()}")
    return r.stdout.strip()

def gh_ok(*args):
    """Run gh and ignore 'already exists' style failures."""
    try:
        return gh(*args)
    except RuntimeError as e:
        if "already exists" in str(e) or "already_exists" in str(e):
            return ""
        raise

def main():
    global DRY
    sys.stdout.reconfigure(encoding="utf-8")  # backlog text has non-ASCII characters (§, –); Windows consoles default to cp1252
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    DRY = ap.parse_args().dry_run

    data = json.load(open(Path(__file__).resolve().parent / "backlog.json", encoding="utf-8"))
    repo = f"{OWNER}/{REPO}"

    print("1/5 Labels")
    labels = {
        "type:feature": ("1f6feb", "Functional requirement"),
        "type:nfr": ("8250df", "Non-functional requirement"),
        "type:setup": ("6e7781", "Setup / infrastructure"),
        "priority:High": ("d1242f", ""), "priority:Medium": ("bf8700", ""), "priority:Low": ("2da44e", ""),
    }
    for p in sorted({i["points"] for i in data["items"]}):
        labels[f"SP:{p}"] = ("c5def5", f"{p} story points")
    for o in sorted({i["owner"] for i in data["items"]}):
        labels[f"owner:{o}"] = ("fbca04", f"Owner: {NAMES[o]}")
    for name, (color, desc) in labels.items():
        gh("label", "create", name, "--repo", repo, "--color", color, "--description", desc, "--force")

    print("2/5 Milestones (sprints)")
    existing = [] if DRY else json.loads(gh("api", f"repos/{repo}/milestones?state=all&per_page=100"))
    have = {m["title"] for m in existing}
    for s in data["sprints"]:
        if s["name"] in have:
            continue
        gh("api", f"repos/{repo}/milestones", "-X", "POST",
           "-f", f"title={s['name']}", "-f", f"due_on={s['due']}T18:00:00Z",
           "-f", f"description={s['start']} to {s['due']}. Goal: {s['goal']}")

    print("3/5 Project")
    title = data["project_title"]
    projects = [] if DRY else json.loads(gh("project", "list", "--owner", OWNER, "--format", "json", "--limit", "100"))["projects"]
    proj = next((p for p in projects if p["title"] == title), None)
    if proj is None:
        out = gh("project", "create", "--owner", OWNER, "--title", title, "--format", "json")
        proj = json.loads(out) if out else {"number": "N", "id": "PROJECT_ID"}
    pnum, pid = str(proj["number"]), proj["id"]
    gh_ok("project", "link", pnum, "--owner", OWNER, "--repo", repo)

    # custom fields
    fields = {} if DRY else {f["name"]: f for f in json.loads(
        gh("project", "field-list", pnum, "--owner", OWNER, "--format", "json"))["fields"]}
    if "Story Points" not in fields:
        gh("project", "field-create", pnum, "--owner", OWNER, "--name", "Story Points", "--data-type", "NUMBER")
    if "Sprint" not in fields:
        gh("project", "field-create", pnum, "--owner", OWNER, "--name", "Sprint",
           "--data-type", "SINGLE_SELECT", "--single-select-options", ",".join(s["name"] for s in data["sprints"]))
    if not DRY:
        fields = {f["name"]: f for f in json.loads(
            gh("project", "field-list", pnum, "--owner", OWNER, "--format", "json"))["fields"]}

    print("4/5 Issues")
    existing_titles = set() if DRY else {
        i["title"] for i in json.loads(gh("issue", "list", "--repo", repo, "--state", "all",
                                          "--limit", "500", "--json", "title"))}
    created = []
    for it in data["items"]:
        title = f"[{it['id']}] {it['title']}"
        if title in existing_titles:
            print(f"  skip (exists): {title}")
            continue
        body = (f"**Owner:** {NAMES[it['owner']]}\n\n"
                f"**User story**\n{it['story']}\n\n"
                f"**Acceptance criteria**\n" + "\n".join(f"- [ ] {a}" for a in it["ac"]) +
                f"\n\n**Traceability:** {it['refs']}\n"
                f"**Story points:** {it['points']}  |  **Priority:** {it['priority']}  |  **Sprint:** {it['sprint']}")
        args = ["issue", "create", "--repo", repo, "--title", title, "--body", body,
                "--label", f"type:{it['type']}", "--label", f"priority:{it['priority']}",
                "--label", f"SP:{it['points']}", "--label", f"owner:{it['owner']}",
                "--milestone", it["sprint"]]
        user = USERS.get(it["owner"], "")
        if user:
            args += ["--assignee", user]
        url = gh(*args) or f"https://github.com/{repo}/issues/X"
        print(f"  + {title}  ({it['points']} SP, {it['sprint']}, {NAMES[it['owner']]}, {user or 'not assigned on GitHub'})")
        created.append((url, it))

    print("5/5 Add to project and set fields")
    for url, it in created:
        out = gh("project", "item-add", pnum, "--owner", OWNER, "--url", url, "--format", "json")
        if DRY:
            continue
        item_id = json.loads(out)["id"]
        gh("project", "item-edit", "--id", item_id, "--project-id", pid,
           "--field-id", fields["Story Points"]["id"], "--number", str(it["points"]))
        sprint_field = fields["Sprint"]
        opt = next(o["id"] for o in sprint_field["options"] if o["name"] == it["sprint"])
        gh("project", "item-edit", "--id", item_id, "--project-id", pid,
           "--field-id", sprint_field["id"], "--single-select-option-id", opt)

    total = {}
    for it in data["items"]:
        total.setdefault(it["sprint"], 0)
        total[it["sprint"]] += it["points"]
    print("\nDone. Story points per sprint:", total)
    print(f"Open the board: gh project view {pnum} --owner {OWNER} --web")

if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        sys.exit(f"\nERROR: {e}")
