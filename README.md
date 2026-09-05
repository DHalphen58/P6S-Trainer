# Rubik's Clock — Pseudo 6-Simul (p6s) Scrambler

A trainer for practicing TetraWaffle's pseudo-6-simul (p6s) memo technique for Rubik's Clock. Pick which p6s cases you want to drill from the case table, generate a WCA-style scramble guaranteed to produce that pattern, and check your memo calculation against the built-in answer key.

## Files

- `index.html` — page structure
- `style.css` — styling
- `script.js` — all scrambler/simulation/UI logic

No build step, no dependencies — it's plain HTML/CSS/JS.

## Running locally

Just open `index.html` in a browser. (Some browsers restrict `file://` pages in minor ways, but nothing here requires a server.)

## Deploying to GitHub Pages

1. Push these three files to a GitHub repo (to the repo root, or to a `/docs` folder — either works with GitHub Pages).
2. In the repo's **Settings → Pages**, set the source to the branch/folder containing `index.html`.
3. GitHub will publish it at `https://<username>.github.io/<repo-name>/`.

## Notes on correctness

The clock mechanics (which dials a given pinset engages, front/back linkage sign, the WCA scramble notation format, and the 8-orientation symmetry group) were worked out and verified interactively, cross-checked against known WCA scrambler behavior and several hand-confirmed examples along the way. If you find a scramble or answer that doesn't match a real clock, it's worth filing as an issue with the exact scramble string — that's how the previous few bugs got caught.
