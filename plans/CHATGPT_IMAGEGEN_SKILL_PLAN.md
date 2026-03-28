# Plan: ChatGPT Image Generation Skill for Claude Code

## Overview

Build a Claude Code skill (`/imagegen`) that generates images via the OpenAI
`gpt-image-1` API. Claude acts as the creative director — composing prompts,
choosing parameters, organizing output files, and managing iteration — while a
thin Node.js script (`generate.js`) handles the API call, saves the result,
and logs to `.imagegen-history.jsonl`. Zero external dependencies (Node.js 20+
built-ins only). The existing plan document at `CHATGPT_IMAGEGEN_SKILL_PLAN.md`
contains all vetted source code inline — implementation is primarily extraction
and validation.

## Progress Tracker

| Phase | Status | Commit | Notes |
|-------|--------|--------|-------|
| 1 — Project Scaffolding | ✅ Done | `37f9bb5` | package.json, .gitignore, test-all.js config, initial commit |
| 2 — Core Skill Files | ✅ Done | `da342fd` | SKILL.md, generate.cjs, reference.md extracted |
| 3 — Offline Validation | ✅ Done | `1dd7488` | 12 test cases, all passing |
| 4 — Game Asset Enhancements | ✅ Done | `da342fd` | Already included in Phase 2 extraction |

## Phase 1 — Project Scaffolding

### Goal

Set up the project infrastructure so that skill files can be created, tested,
and committed with proper tooling. Configure the test runner, create the
gitignore, and make the initial commit.

### Work Items

- [ ] Create `package.json` with project metadata and test scripts:
  ```json
  {
    "name": "openai-imagegen",
    "version": "1.0.0",
    "private": true,
    "type": "module",
    "description": "Claude Code skill for image generation via OpenAI gpt-image-1",
    "scripts": {
      "test": "echo \"Tests not yet configured\" && exit 0",
      "test:all": "node scripts/test-all.js"
    }
  }
  ```
  Note: `"type": "module"` is required because `scripts/test-all.js` uses
  ESM imports (`import { execSync } from 'node:child_process'`).
  The `test` script is a temporary no-op — Phase 3 will replace it with the
  real test command after creating the test file.
- [ ] Configure `scripts/test-all.js` — replace the three placeholder values
  on lines 18-20:
  - `{{UNIT_TEST_CMD}}` → `'echo "Unit tests pending Phase 3"'`
  - `{{E2E_TEST_CMD}}` → `'echo "E2E tests not applicable for this project"'`
  - `{{BUILD_TEST_CMD}}` → `'echo "Build tests not applicable for this project"'`
  **Important:** UNIT_TEST_CMD is set to a safe no-op initially because the
  test file (`tests/generate.test.js`) does not exist until Phase 3. This
  ensures `npm run test:all` passes for Phase 1 and Phase 2 commits. Phase 3
  will update UNIT_TEST_CMD to the real test command.
  Also update `hasBuildPrerequisite()` (line 54-61) to always return `false`
  since there are no build tests, and update the source file filter in
  `hasChangedSourceFiles()` (lines 75-77) to match this project's source
  paths (`.claude/skills/chatgpt-imagegen/`).
- [ ] Create `.gitignore`:
  ```
  .imagegen-history.jsonl
  .env
  .env.local
  node_modules/
  generated-images/
  .claude/logs/
  .DS_Store
  Thumbs.db
  ```
  Do NOT ignore `assets/` (users may commit final game assets).
- [ ] Verify `.claude/settings.local.json` already contains `Bash(node:*)`
  in the permissions allow array — this covers `node */generate.cjs *`
  invocations. If present, no changes needed. If not present, add
  `Bash(node */generate.cjs *)` as a specific permission.
- [ ] Create the skill directory: `mkdir -p .claude/skills/chatgpt-imagegen/`
- [ ] Make the initial git commit. **Commit scope — include these files:**
  - `package.json` (new)
  - `.gitignore` (new)
  - `scripts/test-all.js` (modified — placeholders replaced)
  - `.claude/skills/chatgpt-imagegen/` (new empty directory — or skip if
    git doesn't track empty dirs; commit in Phase 2 instead)
  - `CHATGPT_IMAGEGEN_SKILL_PLAN.md` (existing plan document)
  - `CLAUDE.md` (existing agent reference)
  - `.claude/settings.json` (hooks config)
  - `.claude/settings.local.json` (permissions)
  - `.claude/hooks/` (safety hooks)
  - `.claude/skills/` (all installed zskills)
  - `.devcontainer/` (dev container config)
  - `.playwright/` (playwright config)
  - `scripts/port.js`, `scripts/briefing.cjs` (helper scripts)

  **Do NOT commit:** `zskills/` (it's a separate git repo clone — add to
  `.gitignore` or leave untracked). If `zskills/` has its own `.git/`, git
  will treat it as a submodule or ignore its contents automatically.

  Commit message: `"Initial project setup: package.json, .gitignore, test runner config, zskills infrastructure"`

### Design & Constraints

**Why `"type": "module"` in package.json:** The existing `scripts/test-all.js`
uses ESM syntax (`import { execSync } from 'node:child_process'`). Without
`"type": "module"`, Node.js treats `.js` files as CommonJS, causing a syntax
error when running `npm run test:all`.

**However**, `generate.js` uses CommonJS (`require("fs")`). With
`"type": "module"` set, generate.js must either:
- Be renamed to `generate.cjs`, OR
- Use ESM imports instead

The simplest fix: **rename generate.js to generate.cjs** in Phase 2 (the
`.cjs` extension forces CommonJS regardless of package.json type). Update
all references (SKILL.md, settings.local.json) to use `generate.cjs`.

**Alternatively**, omit `"type": "module"` from package.json and rename
`test-all.js` to `test-all.mjs` or add `--experimental-modules` flag.
The best approach is to keep the existing test-all.js as-is (ESM) and
convert generate.js to use `generate.cjs` extension since it's simpler
to rename one new file than modify an existing infrastructure script.

**test-all.js E2E behavior:** With `E2E_TEST_CMD` set to an echo command,
the E2E suite will show as "SKIPPED" (dev server not running) rather than
failing, because the script checks `checkPort()` before running E2E tests.
This is the correct behavior for a non-web-app project.

### Acceptance Criteria

- [ ] `cat package.json` shows valid JSON with `test` and `test:all` scripts
  and `"type": "module"`
- [ ] `grep -c '{{' scripts/test-all.js` returns `0` (no remaining placeholders)
- [ ] `npm test` exits 0 (temporary no-op message)
- [ ] `npm run test:all` exits 0 (unit shows "pending", E2E/build skipped)
- [ ] `cat .gitignore` includes `.imagegen-history.jsonl` and `.env`
- [ ] `.claude/settings.local.json` contains `Bash(node:*)` or
  `Bash(node */generate.cjs *)` in the allow array
- [ ] `git log --oneline -1` shows the initial commit
- [ ] `git show --stat HEAD` shows the expected files (no zskills/ directory)

### Dependencies

None — this is the first phase.

## Phase 2 — Core Skill Files

### Goal

Create the three skill files that comprise the `/imagegen` skill by extracting
them from `CHATGPT_IMAGEGEN_SKILL_PLAN.md`. All source code has been vetted by
4 review agents — extract without modifying logic.

### Work Items

- [ ] Read `CHATGPT_IMAGEGEN_SKILL_PLAN.md` and create
  `.claude/skills/chatgpt-imagegen/SKILL.md` by extracting from Section 5.1:
  - **YAML frontmatter**: lines 285-293 of the plan (the `---` delimited
    block with name, description, disable-model-invocation, allowed-tools,
    argument-hint). Update `allowed-tools` to reference `generate.cjs`
    instead of `generate.js`: `Bash(node */generate.cjs *)`
  - **Markdown body**: the content between the opening ```` ````markdown ````
    marker (line 295) and closing ```` ```` ```` marker (line 614).
    **Do NOT include the fence markers themselves** — they are plan
    formatting, not file content.
  - Update all references to `generate.js` within the SKILL.md body to
    `generate.cjs` (the script location line, quick start example, etc.)

- [ ] Read `CHATGPT_IMAGEGEN_SKILL_PLAN.md` and create
  `.claude/skills/chatgpt-imagegen/generate.cjs` (note: `.cjs` extension)
  by extracting from Section 5.2:
  - The JavaScript code between the opening ```` ```javascript ```` marker
    (line 620) and closing ```` ``` ```` marker (line 991).
  - **Do NOT include the fence markers.**
  - The file uses `require()` (CommonJS) — the `.cjs` extension ensures
    Node.js treats it as CommonJS regardless of the package.json `type` field.
  - Do not modify the core logic (arg parsing, validation, API call, retry,
    history logging). The algorithmic code has been vetted.
  - **Do update the help text** (the `--help` output string, around lines
    643-673 of the original plan) to reference `generate.cjs` instead of
    `generate.js`. The help text contains 4 references: the title line
    (`generate.js — OpenAI gpt-image-1 API wrapper`), the usage line
    (`node generate.js --prompt ...`), and the example lines. These are
    user-facing documentation, not logic — they must match the actual
    filename.

- [ ] Read `CHATGPT_IMAGEGEN_SKILL_PLAN.md` and create
  `.claude/skills/chatgpt-imagegen/reference.md` by extracting from
  Section 5.3:
  - The markdown content between the opening ```` ```markdown ```` marker
    (line 997) and closing ```` ``` ```` marker (line 1230).
  - **Do NOT include the fence markers.**

- [ ] Commit the three skill files.
  Commit message: `"Add /imagegen skill: SKILL.md, generate.cjs, reference.md"`

### Design & Constraints

**Why `.cjs` extension for generate.js:** The project's `package.json` has
`"type": "module"` (required by `scripts/test-all.js` which uses ESM imports).
The original `generate.js` uses CommonJS (`require("fs")`). The `.cjs`
extension forces Node.js to treat the file as CommonJS regardless of the
package-level setting. This is the standard Node.js approach for mixed
module projects.

**Extraction process:** Read the plan file at
`CHATGPT_IMAGEGEN_SKILL_PLAN.md`. For each file, locate the section header
(e.g., "### 5.1 SKILL.md"), then find the code fence that contains the file
content. Extract ONLY the content between the opening and closing fence
markers — the markers are plan formatting and must not appear in the output
files.

**SKILL.md structure:** YAML frontmatter (5 fields) + markdown body. The
body covers: prerequisites, quick start, script parameters table, prompt
composition guidelines, transparent background best practices, output
organization, confirmation policy, error handling, regeneration & iteration
(history, detection, naming, prompt modification, cross-session, results
presentation, version selection).

**generate.cjs structure:** ~200 lines of CommonJS Node.js. Sections: early
`--help` check, helpers (fail, requireArgValue), argument parsing, validation
(sizes, qualities, backgrounds, extensions, JPEG+transparent), retry with
exponential backoff, main function (API call, base64 decode, file write,
auto history logging).

**reference.md structure:** Pure documentation — capabilities/limitations,
6 style presets, game-specific presets by genre, palette suggestions, prompt
templates by asset type, cost estimates table, history file schema, tips.

**Critical generate.cjs implementation notes** (do not modify these):
- Do NOT include `response_format` in the API request body — it's invalid
  for gpt-image-1. Use `output_format` for image encoding.
- Do NOT include `n: 1` — omit entirely (it's the default).
- History ID is derived from the relative output path minus extension
  (e.g., `./assets/sprites/snake.png` → `assets/sprites/snake`), using
  full relative paths to avoid collisions across directories.
- The `background` parameter is only sent when it's not `"auto"`.

### Acceptance Criteria

- [ ] `.claude/skills/chatgpt-imagegen/SKILL.md` exists with valid YAML
  frontmatter containing all 5 fields (name, description,
  disable-model-invocation, allowed-tools, argument-hint)
- [ ] `allowed-tools` in SKILL.md references `generate.cjs` (not `generate.js`)
- [ ] `.claude/skills/chatgpt-imagegen/generate.cjs` exists and
  `node .claude/skills/chatgpt-imagegen/generate.cjs --help` prints usage
  and exits 0
- [ ] `node -c .claude/skills/chatgpt-imagegen/generate.cjs` passes syntax
  check (exit 0)
- [ ] `.claude/skills/chatgpt-imagegen/reference.md` exists and contains
  the cost estimates table and at least 5 style presets
- [ ] `wc -l .claude/skills/chatgpt-imagegen/generate.cjs` shows
  approximately 150-250 lines (sanity check for complete extraction)
- [ ] No file contains markdown fence markers (```` ``` ````) at the very
  first or last line (would indicate fence markers were included)
- [ ] `git log --oneline -1` shows a commit for the skill files

### Dependencies

Phase 1 (needs package.json with `"type": "module"` and .gitignore).

## Phase 3 — Offline Validation

### Goal

Verify that generate.cjs handles all argument parsing, validation, and error
paths correctly without making any API calls. Create a test script and wire
it into the test runner. This phase covers only offline tests — integration
tests requiring `OPENAI_API_KEY` are deferred (the skill is usable before
those run).

### Work Items

- [ ] Create `tests/generate.test.js` — a standalone test script using only
  Node.js built-ins (`child_process`, `assert`, `path`). No test framework
  (Jest, Mocha, etc.) — consistent with the zero-dependency constraint.
  Test cases:
  1. **Help flag**: `--help` prints usage and exits 0
  2. **Help with extra flags**: `--help --foo` also exits 0 (early exit)
  3. **No arguments**: exits non-zero, stdout contains
     `"--prompt is required."`
  4. **Missing output**: `--prompt "test"` only → `"--output is required."`
  5. **Missing arg value**: `--prompt` as last flag →
     `"--prompt requires a value."`
  6. **Invalid size**: `--size 999x999` → error about invalid size
  7. **Invalid quality**: `--quality ultra` → error about invalid quality
  8. **Invalid background**: `--background fuzzy` → error about invalid
     background
  9. **Unsupported extension**: `--output "t.bmp"` → error about unsupported
     extension
  10. **JPEG + transparent**: `--output "t.jpg" --background transparent` →
      error about JPEG not supporting transparency
  11. **Missing API key**: valid args with `OPENAI_API_KEY=""` → error about
      missing key. **Must override env**: spawn with
      `{ env: { ...process.env, OPENAI_API_KEY: "" } }`
  12. **Unknown argument**: `--foo` → error about unknown argument

- [ ] Update `package.json` test script from the Phase 1 no-op to the real
  command: change `"test"` from `"echo \"Tests not yet configured\" && exit 0"`
  to `"node tests/generate.test.js"`
- [ ] Update `scripts/test-all.js` UNIT_TEST_CMD from the Phase 1 no-op to
  the real command: change from `'echo "Unit tests pending Phase 3"'` to
  `'node tests/generate.test.js'`
- [ ] Verify that `npm test` runs `tests/generate.test.js` and exits 0
- [ ] Verify that `npm run test:all` also passes (test-all.js runs the unit
  test command, E2E skips because no dev server, build skips because no
  cargo)
- [ ] Commit the test file and updated package.json/test-all.js.
  Commit message: `"Add offline validation tests for generate.cjs (12 test cases)"`

### Design & Constraints

**Test structure:**
```javascript
import { execFileSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname,
  '../.claude/skills/chatgpt-imagegen/generate.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) { /* try/catch, count pass/fail */ }
function run(args, opts = {}) { /* spawn generate.cjs, return stdout/status */ }

// ... 12 test cases ...

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

**Important:** The test file must use ESM syntax (`import`) because
`package.json` has `"type": "module"`. Use `import.meta.url` instead of
`__dirname`.

**Each test spawns generate.cjs as a child process** using `execFileSync`
or `spawnSync`, captures stdout, and asserts the output contains expected
JSON error. Tests that should exit non-zero use try/catch around execFileSync
(which throws on non-zero exit).

**The help flag test** is the only one that should exit 0 — all others
exit non-zero with `{"success":false,"error":"..."}` on stdout.

**No test makes an HTTP request.** All tests exercise code paths that fail
before the API call (missing args, invalid args, missing API key). The
`OPENAI_API_KEY` override test must explicitly pass an empty value via the
`env` option to avoid inheriting a real key from the parent process.

### Acceptance Criteria

- [ ] `tests/generate.test.js` exists and uses ESM syntax
- [ ] `npm test` exits 0 with `12 passed, 0 failed` output
- [ ] `npm run test:all` exits 0 (unit passes, E2E skipped, build skipped)
- [ ] Each of the 12 test cases listed above has a corresponding test
- [ ] No test makes an HTTP request (verify: no test requires OPENAI_API_KEY
  to be set, except the one that explicitly tests the missing-key path)
- [ ] `git log --oneline -1` shows a commit for the test file

### Dependencies

Phase 2 (needs generate.cjs to exist).

## Phase 4 — Game Asset Enhancements

### Goal

Add game-asset-specific workflow guidance from the original plan's Section 6
("Phase 2: Game Asset Enhancements"). These are purely documentation and
instruction additions to SKILL.md and reference.md — no script changes.

### Work Items

- [ ] Read Section 6 of `CHATGPT_IMAGEGEN_SKILL_PLAN.md` (starts at line
  ~1234, header "## 6. Phase 2: Game Asset Enhancements").
- [ ] Append a "## Game Asset Workflows" section to SKILL.md, placed after
  the "Regeneration & Iteration" section (before the "## Script Location"
  section at the end). Include three subsections:
  - **Consistency Across Assets**: establish a style reference first,
    reuse style descriptions verbatim across related assets, use same
    quality/size settings, maintain consistent color palette with hex codes
    (e.g., `#3A7D44`) rather than color names
  - **Sprite Sheets and Animation Frames**: the API generates single images
    not sprite sheets; generate each frame individually with explicit pose
    descriptions; use identical style descriptions and size for all frames;
    name files sequentially (`player-walk-01.png`, `player-walk-02.png`);
    the user or their tools will assemble frames into a sprite sheet
  - **Asset Type Defaults** table:

    | Asset Type | Suggested Size | Quality | Background |
    |------------|---------------|---------|------------|
    | Sprites/Characters | 1024x1024 | medium | transparent |
    | Tiles | 1024x1024 | medium | opaque |
    | Items/Icons | 1024x1024 | low or medium | transparent |
    | UI Elements | 1024x1024 | medium | transparent |
    | Backgrounds | 1536x1024 | high | opaque |
    | Portraits | 1024x1536 | high | opaque or transparent |
    | Concept Art | 1536x1024 | high | opaque |

- [ ] Verify that reference.md already contains game-specific style presets
  (platformer, top-down RPG, card game, visual novel, mobile/casual) from
  the Section 5.3 extraction in Phase 2. If any are missing, add them.
- [ ] Run `npm test` and `npm run test:all` to verify no regressions.
- [ ] Commit the enhancements.
  Commit message: `"Add game asset workflows: consistency, sprite sheets, asset type defaults"`

### Design & Constraints

**Source material:** Original plan Section 6 (lines ~1234-1278) contains the
exact text to add. The section is titled "Phase 2: Game Asset Enhancements"
in the original plan — this is confusingly named but refers to the original
plan's phasing, not this implementation plan's phases.

**No script changes.** Phase 2 of the original plan explicitly states:
"delivered entirely through additions to SKILL.md and reference.md — no
script changes needed."

**reference.md verification:** Section 5.3 (extracted in Phase 2 of this
plan) already includes game-specific presets by genre (platformer, top-down
RPG, card game, visual novel, mobile/casual) and palette suggestions by
theme. Phase 4 should verify these are present, not duplicate them.

### Acceptance Criteria

- [ ] SKILL.md contains a `## Game Asset Workflows` section with subsections
  for Consistency Across Assets, Sprite Sheets and Animation Frames, and
  Asset Type Defaults
- [ ] The Asset Type Defaults table has 7 rows (sprites, tiles, items, UI,
  backgrounds, portraits, concept art)
- [ ] reference.md contains game-specific style presets for at least 5 genres
- [ ] `node .claude/skills/chatgpt-imagegen/generate.cjs --help` still works
  (verify no accidental script changes)
- [ ] `npm test` exits 0 (no regressions)
- [ ] `npm run test:all` exits 0 (no regressions)
- [ ] `git log --oneline -1` shows a commit for the enhancements

### Dependencies

Phase 2 (needs SKILL.md and reference.md to exist).
Phase 3 (needs tests to exist for regression checking).

## Plan Quality

**Drafting process:** /draft-plan with 2 rounds of adversarial review
**Convergence:** Converged at round 2 (3 issues found, all resolved)
**Remaining concerns:** None

### Round History

| Round | Reviewer Findings | Devil's Advocate Findings | Resolved |
|-------|-------------------|---------------------------|----------|
| 1     | 15 issues (2 critical) | 15 issues (3 critical) | 9 unique issues — all resolved in refined draft |
| 2     | 3 issues (2 critical) | 3 issues (2 critical) | 3 unique issues — all resolved: test bootstrap (no-op UNIT_TEST_CMD in Phase 1, real cmd in Phase 3), help text update (explicitly permitted in Phase 2), naming consistency (generate.cjs throughout) |
