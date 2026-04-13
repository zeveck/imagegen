# IMAGEGEN2: Reference Image Support

## Goal

Add reference image support to `/imagegen` so users can say things like
"make a winter version of player-idle.png" or "create icons matching the
style of example-icon.png". Claude handles the intent; `generate.cjs`
gains the plumbing to call OpenAI's `/v1/images/edits` endpoint.

## Background

- OpenAI's `gpt-image-1` supports image editing via `POST /v1/images/edits`
- Accepts up to 16 input images via `multipart/form-data` (not JSON)
- Adds `mask` (PNG only, with alpha channel, max 4 MB, must match input
  image dimensions) and `input_fidelity` (`high`/`low`, default `low`)
- `input_fidelity: "high"` preserves the *first* image's features with extra
  richness (faces, logos, textures) at higher token cost
- `output_format`, `background`, and `size` are accepted on both endpoints
- `quality` is accepted on edits but has been **unreliable** (intermittent
  `unknown_parameter` 400 errors reported through mid-2025) — include it
  but handle gracefully if rejected
- Response format is identical to generations: `b64_json` in `data[0]`
- Input images must be PNG/WEBP/JPG, each under 50 MB
- Field name for images: `image` for single, `image[]` for multiple

## Scope

### In scope
- `--image <path>` flag (repeatable) for reference/input images
- `--mask <path>` flag for inpainting
- `--input-fidelity high|low` flag (default: low)
- Automatic endpoint switching: edits if `--image` provided, generations otherwise
- Multipart form construction using Node 20 built-in `FormData` + `Blob`
- Input validation (file exists, supported format, size limit)
- SKILL.md updates teaching Claude when/how to use reference images
- reference.md cost table update (edits pricing)
- History logging: record input image paths in history entries
- Tests for the new arg parsing, validation, and form construction

### Out of scope
- Batch edits (multiple output images per call via `n` param) — add later
- GUI/preview — still CLI-only, user opens files manually
- Automatic mask generation — user or Claude must provide a pre-made mask

## Phases

### Phase 1: generate.cjs changes

**Files:** `.claude/skills/imagegen/generate.cjs`

1. **Arg parsing** — add to `parseArgs()`:
   - `--image <path>` — collect into `args.images[]` array (repeatable)
   - `--mask <path>` — store as `args.mask`
   - `--input-fidelity <value>` — store as `args.inputFidelity`, default `null`
     (only sent when explicitly set; API default is `"low"`)

2. **Validation** — add to `validate()`:
   - Each `--image` path: resolve with `path.resolve()`, file must exist,
     extension in {.png, .jpg, .jpeg, .webp}, size under 50 MB
   - `--mask`: resolve with `path.resolve()`, file must exist, must be
     **.png** (only format supporting alpha channel for masking), size
     under 4 MB, must match first input image dimensions
   - `--mask` without `--image` is an error
   - `--input-fidelity` must be `"high"` or `"low"` if provided
   - `--input-fidelity` without `--image` is an error
   - Max 16 `--image` flags

3. **Request construction** — new function `buildEditForm(args, apiKey)`:
   - Create `FormData` instance
   - Append `model`, `prompt`, `size`, `quality`, `output_format`
   - Append `background` if not `"auto"`
   - Append `input_fidelity` if set
   - For single image: read file into `Buffer`, wrap in `Blob` with
     appropriate MIME type, append as field name `image`
   - For multiple images: use field name `image[]` for each (confirmed by
     OpenAI curl examples and Python SDK)
   - If mask: same buffer/blob treatment, append as `mask` field
   - If `quality` is set: include it, but if the API returns a 400 with
     "unknown_parameter", retry once without `quality` (known intermittent
     bug on edits endpoint)
   - Return the FormData (no manual Content-Type header — `fetch` sets the
     multipart boundary automatically)

4. **Endpoint selection** in `main()`:
   - If `args.images.length > 0`: POST to `/v1/images/edits` with FormData body,
     `Authorization` header only (no `Content-Type` — let fetch handle it)
   - Otherwise: existing JSON POST to `/v1/images/generations` (unchanged)

5. **Response parsing** — no changes needed. Both endpoints return the same
   `{ data: [{ b64_json: "..." }] }` structure.

6. **History logging** — extend the history entry object:
   - Add `inputImages: args.images` (array of paths, or empty array)
   - Add `mask: args.mask || null`
   - Add `inputFidelity: args.inputFidelity || null`

7. **Help text** — update the `--help` output to document new flags.

8. **Result JSON** — include `inputImages` and `mask` in the success output
   so Claude can reference them in its response.

### Phase 2: SKILL.md updates

**Files:** `.claude/skills/imagegen/SKILL.md`

1. **allowed-tools** — update the frontmatter pattern if needed (current
   `Bash(node */generate.cjs *)` should already match new flags).

2. **argument-hint** — add `[--image path]` to hint line.

3. **Script Parameters table** — add rows for `--image`, `--mask`,
   `--input-fidelity`.

4. **New section: "Resolving Image References"** — add before "Reference
   Images & Editing". This teaches Claude to find the actual file before
   invoking the script:

   **User provides a filename or fragment** (e.g., "use foo.jpg",
   "the barbarian sprite"):
   - Search the project: glob for the filename, grep history for matching
     IDs/prompts, scan `assets/` subdirectories
   - If one match → use it
   - If multiple matches → ask the user which one
   - If no match → tell the user, ask for clarification

   **User provides a path** (e.g., "assets/sprites/barbarian.png"):
   - Verify the file exists; if not, search for close matches
   - Resolve relative to project root

   **User describes an asset without a path** (e.g., "the barbarian image",
   "that enemy we made earlier"):
   - Search `.imagegen-history.jsonl` for matching prompts/IDs:
     `grep -i "barbarian" .imagegen-history.jsonl`
   - Search asset directories: `ls assets/**/*barbarian*` or similar
   - Check conversation context for recently generated images
   - If found → use it. If ambiguous → ask.

   **User says "that one" / "the last one"**:
   - Use the most recent generation from conversation context
   - If not in context, check the last entry in `.imagegen-history.jsonl`

   **Key rule:** The script only accepts resolved, absolute or relative paths
   via `--image`. All fuzzy resolution happens before invocation. Never pass
   an unverified path to the script.

5. **New section: "Reference Images & Editing"** — add after "Resolving
   Image References":
   - When to use reference images vs pure generation
   - **Primary intent signal: user mentions or provides a path to an existing
     image file alongside a generation request** — this is the most common
     case and should always trigger `--image`
   - Other intent signals: "edit this", "like this one", "match the style
     of", "modify", "based on"
   - When to use `--input-fidelity high` (close edits: recolor, add element)
     vs `low` (loose style reference)
   - When to use `--mask` (inpainting: "replace just the sword")
   - Multiple reference images: style consistency across a set
   - Example prompts with reference images

6. **Confirmation policy** — no changes needed (same cost model).

7. **Iteration section** — update to note that re-edits can chain: the output
   of one edit becomes the `--image` for the next.

### Phase 3: reference.md updates

**Files:** `.claude/skills/imagegen/reference.md`

1. **Cost table** — add edits pricing (same as generations for gpt-image-1).
2. **Limitations section** — note that edits inherit the same transparent
   background bug.
3. **Tips** — add tip about `--input-fidelity high` for preserving details.

### Phase 4: Tests

**Files:** Extend `tests/generate.test.js` (existing file)

The project uses a custom test runner (no jest/mocha) with `spawnSync` to
invoke `generate.cjs` as a subprocess. Tests validate exit codes and
stdout/stderr JSON output. No mocking — tests exercise the real validation
layer. Follow the existing `test(name, fn)` / `run(args, opts)` pattern.

**New tests to add:**

1. **Arg parsing — `--image`:**
   - `--image` without value → error
   - `--image /nonexistent/file.png` → error (file not found)
   - `--image` with non-image extension (e.g., `.txt`) → error
   - `--image` with valid extension but missing `--prompt` → still requires prompt

2. **Arg parsing — `--mask`:**
   - `--mask` without `--image` → error
   - `--mask` without value → error
   - `--mask` with non-PNG extension → error (mask must be PNG)

3. **Arg parsing — `--input-fidelity`:**
   - `--input-fidelity` without `--image` → error
   - `--input-fidelity banana` → error (must be high or low)
   - `--input-fidelity` without value → error

4. **Validation — file constraints:**
   - `--image` pointing to a real temp file with valid extension → passes
     validation (create a small temp PNG in test setup)
   - More than 16 `--image` flags → error

5. **Help text:**
   - `--help` output includes `--image`, `--mask`, `--input-fidelity`

6. **Interaction with existing flags:**
   - `--image <valid> --background transparent --output t.jpg` → error
     (JPEG + transparency, same as existing test but with --image)

**Test setup helper:** Create a minimal valid PNG file (1x1 pixel) in a
temp directory at the start of the test run. Use it for tests that need a
real file to pass existence/extension checks. Clean up on exit.

**Not tested at unit level** (covered by manual smoke test):
   - Actual FormData construction and multipart serialization
   - Endpoint selection (generations vs edits URL)
   - API response handling

   These require a running API or a fetch interceptor, which the current
   test infrastructure doesn't support. The manual smoke test in the
   Verification section covers them. If we want automated coverage later,
   we can add a mock fetch layer as a separate effort.

## Verification

After each phase:
- `node --check .claude/skills/imagegen/generate.cjs` (syntax)
- `node .claude/skills/imagegen/generate.cjs --help` (help text shows new flags)
- `npm test` (unit tests pass)
- `npm run test:all` before final commit

Manual smoke test (requires OPENAI_API_KEY):
```bash
# Pure generation still works
node .claude/skills/imagegen/generate.cjs \
  --prompt "A red circle" --output ./test-gen.png --quality low

# Edit with reference image
node .claude/skills/imagegen/generate.cjs \
  --prompt "Make it blue" --output ./test-edit.png --quality low \
  --image ./test-gen.png

# Verify both produce valid images
file test-gen.png test-edit.png
```

## Risks

- **Multipart form with Node built-in `FormData`**: Node 20's `FormData` +
  `Blob` works with `fetch` but the `Blob` constructor needs a buffer, not a
  stream. For files under 50 MB this is fine (read entire file into memory).
- **No `Content-Type` header**: When passing `FormData` as `fetch` body, do NOT
  set `Content-Type` manually — `fetch` auto-sets the multipart boundary. Setting
  it manually breaks the request. This is a common gotcha.
- **Retry logic**: `fetchWithRetry` currently expects JSON request options. It
  needs to accept FormData bodies transparently. Since it just spreads `options`
  into `fetch`, this should work without changes — but verify. Note: Buffer-backed
  Blobs in FormData are replayable across retries (unlike streams), so retries are
  safe. Add a comment in code so nobody switches to streams later without thought.
- **`quality` on edits endpoint**: Intermittent 400 errors reported through
  mid-2025 when including `quality` on edits. Include it but add fallback:
  if API returns 400 with "unknown_parameter", retry once without `quality`.
- **Mask dimension matching**: Mask must match first input image dimensions.
  We validate extension and size but checking pixel dimensions requires
  reading image headers (PNG: bytes 16-23). Worth doing to give a clear
  error instead of a cryptic API rejection.
