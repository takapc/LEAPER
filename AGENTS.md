# AGENTS.md

This file defines the repository-specific instructions for agents working on LEAPER.
Follow the user's current request first, then this file. Keep changes focused and preserve
existing behavior unless the request explicitly changes it.

## Product overview

LEAPER is a Japanese, mobile-first flash-card application for studying the 2,300 words in
the revised LEAP vocabulary book. It is a client-only React application: there is no backend,
authentication, or database. The bundled vocabulary data is the default source of truth at
runtime.

Prioritize, in this order:

1. Correct quiz behavior and preservation of learning state.
2. Fast, clear operation on phones, including iPhone-sized screens.
3. Accessible controls and understandable Japanese UI copy.
4. Small, maintainable changes consistent with the existing stack.

Do not introduce a backend, TypeScript migration, state-management library, UI framework,
or other large dependency unless the user explicitly asks for it or approves the tradeoff.

## Repository map

- `src/App.jsx`: application orchestration, quiz session state, navigation, filters, and layout.
- `src/components/`: reusable Chakra UI components.
- `src/utils/quizLogic.js`: pure filtering, formatting, search, and random-selection logic.
- `src/utils/wordData.js`: bundled data loading, import parsing, localStorage, and cookie helpers.
- `src/utils/learningStats.js`: cumulative learning-count persistence.
- `src/data/words.json`: bundled production vocabulary dataset.
- `src/data/RELATED_WORDS_NOTICE.md`: attribution for lexical-relation data.
- `test/`: Node.js unit and dataset-integrity tests.
- `scripts/scrape-leap.js`: developer-only vocabulary update script.

Keep pure domain logic out of JSX when practical. Put it in `src/utils/` and test it directly.
Extract a component when it gives a feature a clear boundary; do not split files merely to
reduce line count.

## Required workflow

Before editing:

1. Read the files directly involved and their current tests.
2. Check `git status` and preserve unrelated user changes.
3. Trace the relevant state and persistence behavior before changing quiz flow.
4. Ask a concise question when ambiguity would materially change behavior, data, design, or
   release scope. Otherwise, make the smallest reasonable assumption and state it in the handoff.

While editing:

- Keep the change within the requested scope; do not bundle speculative redesigns or cleanup.
- Follow the existing JavaScript/JSX style: ES modules, function components, hooks, single
  quotes, and no semicolons unless the surrounding code requires them.
- Reuse Chakra UI components and responsive props instead of adding standalone styling systems.
- Use descriptive names. Comments should explain non-obvious constraints or reasons, not restate
  the code.
- Do not silently remove a documented feature, compatibility behavior, attribution, or easter egg.
- Do not edit generated output such as `dist/` or commit dependency directories.

After editing:

1. Add or update focused tests for changed logic and regressions.
2. Run `npm run check` (tests followed by the production build).
3. For UI changes, also inspect the affected flow at a narrow mobile width and a desktop width
   when browser preview is available. Check overflow, tap targets, focus behavior, modal closing,
   and Japanese text wrapping.
4. Review `git diff --check` and the final diff for accidental data churn or unrelated changes.
5. Report what changed, verification performed, and any remaining limitation. Never claim a
   browser check or test was performed if it was not.

Use `npm ci` for a clean dependency install when `node_modules` is absent. Do not regenerate the
lockfile unless dependencies or package metadata intentionally changed.

## Behavioral invariants

Preserve these rules unless the user explicitly requests different behavior:

- A newly selected random quiz word is added to the in-memory navigation history, recorded in
  `leapUsedWordIds`, and increments `leapTotalQuizCount` exactly once.
- Moving backward or forward through existing history does not increment totals or mark a word as
  newly used.
- Selecting a search result displays that word but does not alter the active filter or count it as
  a random quiz draw.
- Exhausting the active range resets the used-word cycle and starts a new cycle in that same range.
- Part selection supports a union of multiple parts. The detailed numeric range and Part selection
  are mutually exclusive base-range modes.
- The "間違えた問題のみ" filter composes with the active base range. If the intersection is empty,
  keep the current usable state and explain the result to the user.
- Changing the active dataset or range resets navigation so previous/next cannot surface a word
  outside the new active set.
- "履歴を削除" clears used-word and navigation history only. It must retain cumulative quiz count
  and the separately stored "間違えた問題" marks, and it must require confirmation.
- Autoplay reveals the answer before advancing, stops on ordinary user interaction, and does not
  stop when the user toggles the current word's mistake mark.
- The related-words control is absent when a word has no related words.
- Browser storage and cookie failures must degrade safely instead of crashing the app.

When changing any of these flows, inspect both the React state and the persistence helper involved.
Avoid stale-state bugs: pass the exact newly computed list into selection/filter functions instead
of assuming a just-called state setter has already taken effect.

## Vocabulary data contract

Treat `src/data/words.json` as large, review-sensitive production data. Do not reformat or rewrite
the whole file for a small correction.

Each word must have:

```json
{
  "id": 1,
  "word": "agree",
  "meaning": "[自] ①賛成する",
  "relatedWords": []
}
```

Requirements:

- `id`: unique positive integer.
- `word`: non-empty English headword.
- `meaning`: non-empty Japanese meaning string.
- `relatedWords`: array; use an empty array when no relation exists.

Each related word must contain non-empty `word` and `meaning`, one `type` from
`word-family`, `synonym`, or `antonym`, and a non-empty `partsOfSpeech` array. Allowed part-of-speech
values are defined and validated in `test/relatedWords.test.js`; update the display mapping and the
test together if the schema is intentionally extended.

After any dataset edit:

- Parse the JSON and run the full test suite.
- Confirm the intended record count and inspect the diff size.
- Preserve attribution in `src/data/RELATED_WORDS_NOTICE.md` and `README.md`.
- If running `npm run scrape:leap`, inspect the resulting dataset instead of trusting the scraper
  output blindly. The upstream HTML structure may change.

Do not fetch, scrape, replace, or publish vocabulary data from a new external source without the
user's explicit approval and a licensing/attribution check.

## UI and accessibility rules

- Keep visible product copy in natural Japanese and use terminology already established in the UI.
- Design mobile-first. Important controls must remain usable without precise tapping or horizontal
  scrolling.
- Every icon-only control needs an accurate `aria-label`. Form controls need accessible labels.
- Destructive actions must be visually separated from routine actions and require confirmation.
- Do not communicate state by color alone; pair color with text, shape, icon, or selected state.
- Preserve keyboard focus, Escape/close behavior, and a sensible initial focus in dialogs.
- Avoid fixed heights for new content unless overflow behavior is deliberately handled.
- Use toasts for brief non-blocking feedback and inline alerts for errors that block the current
  flow.

## Testing guidance

The project uses Node's built-in test runner. Prefer deterministic pure-function tests:

- Inject randomness rather than relying on `Math.random` in tests.
- Mock `localStorage`, cookies, or browser APIs only at the narrow boundary under test and clean up
  globals afterward.
- For every bug fix, add a regression test that fails for the original bug when practical.
- Dataset tests should report the offending word or ID so failures are actionable.
- Do not weaken or delete an existing assertion merely to make a change pass.

`npm run build` is required but is not a substitute for behavior tests.

## Versioning and commits

`package.json` is the single source of truth for the displayed version. `package-lock.json` must
remain synchronized, and the footer must render `LEAPER verX.Y.Z` from package metadata.

Use semantic versioning for user-visible product releases:

- PATCH (`X.Y.Z`): backward-compatible bug fixes and small corrections.
- MINOR (`X.Y.0`): backward-compatible features or meaningful UI improvements.
- MAJOR (`X.0.0`): breaking behavior, a major redesign, or incompatible persisted-data changes.

For a product update, choose and apply one version bump for the coherent release, then begin the
commit subject with `verX.Y.Z: `. Tests, refactors, documentation, and agent-instruction-only
changes that do not alter the shipped product do not require a version bump; use a concise normal
commit subject for them. Do not create extra version bumps merely because implementation is split
across intermediate work.

Do not amend, squash, force-push, or otherwise rewrite history unless the user explicitly asks.
Do not commit unrelated files.

## Completion standard

A task is complete only when the requested behavior is implemented, relevant tests cover it,
`npm run check` succeeds, and the final diff contains no unintended changes. If any verification is
blocked, explain the exact blocker and provide the safest next step instead of presenting the work
as fully verified.
