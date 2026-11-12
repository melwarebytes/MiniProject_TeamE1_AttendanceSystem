# 5 · Project Creation and Sprint Screenshots

Screenshots of the GitHub repository, GitHub Project board and sprint planning.

## Screenshots

| # | Screenshot | File |
|---|---|---|
| 1 | Repository home page | [01_repository.png](screenshots/01_repository.png) |
| 2 | GitHub Project linked to the repository | `screenshots/02_project_linked.png` (to add) |
| 3 | Backlog (table view) with Story Points and Sprint fields | `screenshots/03_backlog_story_points.png` (to add) |
| 4 | Board view grouped by Sprint | `screenshots/04_sprint_board.png` (to add) |
| 5 | All 21 issues with assignee, story points, owner and sprint labels | [05_assignments.png](screenshots/05_assignments.png) |
| 6 | Milestones: Sprint 1 (10/10) and Sprint 2 (11/11) closed | [06_milestones.png](screenshots/06_milestones.png) |
| 7 | Sprint 1 board at end of sprint | `screenshots/07_sprint1_done.png` (to add) |
| 8 | Sprint 2 board at end of sprint | `screenshots/08_sprint2_done.png` (to add) |
| 9 | GitHub Actions runs on pull requests and main | [09_actions.png](screenshots/09_actions.png) |
| 10 | Pull requests, each raised by the assigned member | [10_pull_requests.png](screenshots/10_pull_requests.png) |

The GitHub Project is private, so screenshots 2, 3, 4, 7 and 8 must be taken by a signed-in team member.

## Backlog automation
[`backlog/backlog.json`](backlog/backlog.json) holds all 21 backlog items (user story, acceptance criteria, story points, owner, sprint, traceability). [`backlog/create_backlog.py`](backlog/create_backlog.py) creates the labels, sprint milestones, issues and the linked GitHub Project from it using the GitHub CLI.

Every issue starts with an `**Owner:** <full name>` line and carries an `owner:<first name>` label, so the board can be grouped by owner. Each issue is assigned to its owner's GitHub account: `melwarebytes` (Merull Shah), `rajnanjappaneyani` (N S Raj Nanjappa) and `ZOnyxGH` (N Bhuvan Teja).

```bash
gh auth login && gh auth refresh -s project
cd 5_Project_Setup_Screenshots/backlog
python3 create_backlog.py --dry-run
python3 create_backlog.py
```
