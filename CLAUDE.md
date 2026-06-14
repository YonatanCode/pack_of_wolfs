# Project guide for Claude

Project-specific gotchas live in [AGENTS.md](AGENTS.md). This file is the
git/workflow contract — follow it in every session.

## Branch & commit rules (always on)

These are guardrails. Hold to them even if the user forgets; if a request would
break one, say so and offer the clean path instead.

1. **One branch = one thing.** A branch is for a single feature/fix/experiment.
   Never start a second, unrelated thing in the same branch or working tree.
2. **Branch off `main`; never commit directly to `main`.** `main` stays clean
   and working at all times.
3. **Start every branch from a clean tree.** If `git status` isn't clean,
   commit / stash / discard the leftover work *first* — don't build on top of it.
4. **Commit small, one thought per commit.** If the commit message needs the
   word "and", it's probably two commits. Commit often.
5. **Look before you act.** `git status` before starting; `git diff` before
   committing. Never `git add -A` blindly — know exactly what's going in.
6. **Finish → merge → delete.** Merge the branch to `main`, delete it, *then*
   start the next thing. Don't let branches pile up.

## When starting new work

If the user wants to start/build/add/try something new, run the **`/start-work`**
skill first — it checks git state and sets up a clean branch. Don't begin coding
on a dirty tree or on `main`.

## Commit messages

- Conventional style: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
- One logical change per commit. Keep the subject under ~72 chars.

## Verification before calling something done

Per AGENTS.md, prefer lightweight checks (syntax check, the headless dev-test
harness) and let the user verify UI manually. Report results honestly — if a
step was skipped or a test failed, say so.
