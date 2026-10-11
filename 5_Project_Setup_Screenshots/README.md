# 5 · Project Creation and Sprint Screenshots

Screenshots of the GitHub repository, GitHub Project board and sprint planning.

## Screenshots to add
Save images in `screenshots/` with these names so the links below work.

| # | Screenshot | File |
|---|---|---|
| 1 | Repository home page | `screenshots/01_repository.png` |
| 2 | GitHub Project linked to the repository | `screenshots/02_project_linked.png` |
| 3 | Backlog (table view) with Story Points and Sprint fields | `screenshots/03_backlog_story_points.png` |
| 4 | Board view grouped by Sprint | `screenshots/04_sprint_board.png` |
| 5 | Issues assigned to each team member | `screenshots/05_assignments.png` |
| 6 | Milestones: Sprint 1 and Sprint 2 | `screenshots/06_milestones.png` |
| 7 | Sprint 1 board at end of sprint | `screenshots/07_sprint1_done.png` |
| 8 | Sprint 2 board at end of sprint | `screenshots/08_sprint2_done.png` |
| 9 | GitHub Actions runs on pull requests | `screenshots/09_actions.png` |

## Backlog automation
[`backlog/backlog.json`](backlog/backlog.json) holds all 21 backlog items (user story, acceptance criteria, story points, owner, sprint, traceability). [`backlog/create_backlog.py`](backlog/create_backlog.py) creates the labels, sprint milestones, issues and the linked GitHub Project from it using the GitHub CLI.

Every issue starts with an `**Owner:** <full name>` line and carries an `owner:<first name>` label, so the board can be grouped by owner. Only Merull's items are assigned to a GitHub account (`melwarebytes`); N S Raj Nanjappa's and N Bhuvan Teja's are not assigned until usernames are added to `USERS` in the script.

```bash
gh auth login && gh auth refresh -s project
cd 5_Project_Setup_Screenshots/backlog
python3 create_backlog.py --dry-run
python3 create_backlog.py
```
