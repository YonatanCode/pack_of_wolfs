---
name: start-work
description: Run at the START of any new piece of work (a feature, fix, or experiment) before writing code. Inspects git state, decides whether now is a good time to start, and sets up one clean branch for one thing. Use whenever the user says they want to start/build/add/try something new.
---

# Start Work — pre-flight checklist

Goal: never start a new thing on top of an unfinished thing. One branch = one thing.

## Step 1 — Look before you leap
Run these and read the output:
```
git status
git branch --show-current
```

## Step 2 — Decide if now is a good time

**A. Working tree is DIRTY (uncommitted changes)?**
→ STOP. Do not start new work yet. The leftover work must go somewhere first. Offer the user:
  - **Commit it** — if it's a finished thought (`git commit`).
  - **Stash it** — if it's half-done and unrelated (`git stash push -m "wip: <what>"`).
  - **Discard it** — only if they confirm it's junk (`git restore .`).
Surface *what* the changes are (`git status`, `git diff --stat`) so they can choose. Do not proceed until the tree is clean.

**B. Already on a feature branch with commits, and the new request is UNRELATED?**
→ STOP. Finish the current branch first: merge it to `main` and delete it, *then* start the new thing. One feature in flight at a time.
→ If the new request is part of the SAME feature, stay on this branch — it's fine.

**C. Clean tree, on `main`?**
→ Good time to start. Go to Step 3.

## Step 3 — Branch for ONE thing
1. Make sure `main` is current: `git checkout main && git pull`.
2. Ask the user for the ONE thing this branch is about (one sentence). If they describe two things, that's two branches — do the first one.
3. Create the branch with a short kebab-case name describing that one thing:
   `git checkout -b <verb-thing>` (e.g. `add-health-recovery`, `fix-miss-popup`).
4. Confirm: "On `<branch>`. This branch is only for: <the one thing>."

## Step 4 — Remind the user of the rules for this branch
- Commit small: each commit = one complete thought. If the message needs the word **"and"**, split it.
- Commit often — small commits are cheap; untangling later is expensive.
- Don't start a second, unrelated thing in this branch. If the urge hits, run `/start-work` again instead.
- Before any commit, run `git diff` and look at exactly what's staged.

## Step 5 — When the thing is done
Finish → merge → delete → then start the next thing:
```
git push -u origin <branch>     # if pushing
# merge to main (PR or fast-forward), then:
git checkout main && git branch -d <branch>
```
Never commit directly to `main`; never leave merged branches lying around.
