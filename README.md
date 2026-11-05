# GoingSomewhere (G3T1)

## 1. Project Setup

**Prerequisites:** Git, Node.js and pnpm.

1. Clone the repository


2. Navigate to the project directory:

```bash
cd .../client/GoingSomewhere
```
GoingSomewhere is the project name


Install dependencies and start the application:

```bash
pnpm install
pnpm dev
```

Start server

```bash
node server.js
```

---
## 2. Branching Rules

**Every developer must work on their own branch. Do not push directly to `main`.**

### First starting out
- Create personal branch
- Ensure youre working on your own branch 
- Finally, Pull from origin/main either using git command or vscode selections


Commit or safely stash uncommitted changes before pulling. Resolve any merge conflicts before continuing.

## 3. Commit and Push Changes

Before pushing, **inform the team**, sync with the latest `main`, and test your changes.
For subsequent pushes to the same branch, `git push` is sufficient.

## 4. Pull Request (PR)

After pushing:

1. Create a Pull Request on GitHub from your branch into `main`.
2. Describe your changes and any testing performed.
3. Notify the project owner for review.
4. Wait for approval before merging into `main`.

**Team rules:** Work on your own branch, communicate before pushing, keep your branch updated, and never commit secrets such as API keys or passwords.

## AI / LLM usage

- **Budget trips (branch `feature/budget-trips`):** Budget API trip-access check and Budget link on the trip page were written with Claude Code assistance and reviewed by Seth. That change covers:
  - the trip-membership check on the budget and expense API routes (`server/src/app.js`), sharing one rule with the checklist (`server/src/tripAccess.js`, wired up in `server/server.js`);
  - the Budget link on the trip page (`src/views/Itinerary.vue`), and the short destination-to-currency lookup it passes on to the Budget page (`src/budget/destinationCurrency.js`, `router/index.js`, `src/views/Budget.vue`);
  - the tests for these (`server/test/budgetAccess.test.js`, `src/budget/destinationCurrency.test.js`, and the Budget link check in `tests/e2e/itinerary.spec.js`).
