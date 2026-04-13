---
name: imagegen
description: Generate images using OpenAI's gpt-image-1 model. Ideal for game assets (sprites, tiles, UI elements, icons), concept art, and placeholder graphics. Supports iteration — "try again", "make it bluer", "go back to v1".
disable-model-invocation: false
allowed-tools: Bash(node */generate.cjs *)
argument-hint: <description> [--image path] [size: 1024x1024|1536x1024|1024x1536] [quality: low|medium|high] [transparent] [format: png|webp|jpg]
---

# Image Generation with gpt-image-1

Generate images via OpenAI's gpt-image-1 API. You (Claude) are the creative
director — you compose prompts, choose parameters, organize output files, and
manage the iteration loop. The bundled `generate.cjs` script is a thin API
wrapper that handles the API call, saves the result, and automatically logs
to `.imagegen-history.jsonl`.

Read [reference.md](reference.md) at least once when first using this skill
to familiarize yourself with available style presets and cost estimates.

## Prerequisites

- `OPENAI_API_KEY` environment variable must be set
- Node.js 20+ (for built-in `fetch()`)

## Quick Start

```bash
node .claude/skills/imagegen/generate.cjs \
  --prompt "A 32x32 pixel art treasure chest, gold coins spilling out, transparent background" \
  --output "./assets/items/treasure-chest.png" \
  --quality medium \
  --background transparent
```

## Handling No Arguments

If invoked with no arguments (`$ARGUMENTS` is empty), ask the user what they'd
like to generate. Offer examples relevant to the current project context (e.g.,
if it's a game project, suggest sprites, tiles, or UI elements).

## Script Parameters

| Parameter | Values | Default | Notes |
|-----------|--------|---------|-------|
| `--prompt` | Any string (required) | — | The image generation prompt |
| `--output` | File path (required) | — | Where to save the image (.png, .jpg, .webp) |
| `--size` | `1024x1024`, `1024x1536`, `1536x1024`, `auto` | `1024x1024` | Square for sprites/icons; landscape for scenes |
| `--quality` | `low`, `medium`, `high`, `auto` | `medium` | `low` for iteration; `high` for finals |
| `--background` | `transparent`, `opaque`, `auto` | `auto` | `transparent` for sprites, items, UI |
| `--model` | `gpt-image-1` | `gpt-image-1` | Model to use |
| `--image` | File path (repeatable, max 16) | — | Reference image for editing. Triggers `/v1/images/edits`. |
| `--mask` | PNG file path | — | Alpha mask for inpainting (transparent = edit zone). Requires `--image`. |
| `--input-fidelity` | `high`, `low` | `low` | How closely to preserve first input image. `high` = more faithful. |
| `--history-id` | String (optional) | auto from path | Override the auto-derived history ID |
| `--history-parent` | String (optional) | — | Parent generation ID (for iterations) |
| `--no-history` | Flag (optional) | — | Disable history logging for this generation |

History logging to `.imagegen-history.jsonl` is automatic. The script derives
the history ID from the output path (e.g., `./assets/sprites/snake-idle.png`
→ ID `assets/sprites/snake-idle`). This avoids collisions when different
directories have files with the same name. You can override with `--history-id`.

## How to Compose Prompts

You are responsible for composing effective prompts. Follow these guidelines:

1. **Be specific about visual style**: "pixel art", "flat vector", "hand-painted",
   "low-poly 3D render", "watercolor", etc.
2. **State the resolution/detail level**: "32x32 pixel art", "high-detail character
   portrait", "simple icon".
3. **Specify the background**: "transparent background", "solid white background",
   "environmental background with forest".
4. **Describe composition**: "centered", "full body", "close-up face", "top-down
   view", "isometric perspective".
5. **Include art direction**: "vibrant colors", "muted earth tones", "neon cyberpunk
   palette", "monochrome with red accent".
6. **For game assets, specify the context**: "for a 2D platformer", "for a card
   game", "top-down RPG tileset", "UI button for mobile game".

### Transparent Background Best Practices

**Known issue**: When `background: "transparent"` is set, gpt-image-1 sometimes
removes white areas *within* the subject itself (e.g., white eyes, belly
highlights, white clothing). This is a documented API bug.

**Workarounds** (apply all three when using transparent backgrounds):
1. Add to the prompt: "The subject is a standalone element on a transparent
   background. Do not remove any white or light areas within the subject itself.
   Only the area surrounding the subject should be transparent."
2. Avoid subjects that are predominantly white. If the subject must be white,
   consider generating with `--background opaque` and noting that background
   removal can be done in post-processing.
3. Include explicit color descriptions for all parts of the subject.

See [reference.md](reference.md) for style preset suggestions you can adapt.

## Resolving Image References

The `--image` flag requires a resolved file path. Users often reference images
loosely — by filename fragment, description, or conversational shorthand. You
must resolve these to actual paths before invoking the script.

### User provides a filename or fragment

> "use foo.jpg", "the barbarian sprite", "that player-idle image"

1. Search the project: glob for the filename (`**/*foo*`, `**/*barbarian*`)
2. Search `.imagegen-history.jsonl`: `grep -i "barbarian" .imagegen-history.jsonl`
3. Scan `assets/` subdirectories
4. If **one match** → use it. If **multiple** → ask which one. If **none** →
   tell the user and ask for clarification.

### User provides a path

> "assets/sprites/barbarian.png"

Verify the file exists. If not, search for close matches (typos, wrong
directory). Resolve relative to the project root.

### User describes an asset without a path

> "the barbarian image", "that enemy we made earlier", "use our existing logo"

1. Search `.imagegen-history.jsonl` for matching prompts/IDs:
   `grep -i "barbarian" .imagegen-history.jsonl`
2. Search asset directories: glob for `assets/**/*barbarian*`
3. Check conversation context for recently generated images
4. If found → use it. If ambiguous → ask.

### User says "that one" / "the last one"

Use the most recent generation from conversation context. If not in context,
check the last entry in `.imagegen-history.jsonl`.

**Key rule:** Never pass an unverified path to `--image`. Always confirm the
file exists before invoking the script.

## Reference Images & Editing

When the user wants to edit, modify, or use an existing image as a style
reference, pass it via `--image`. This switches the script from the
`/v1/images/generations` endpoint to `/v1/images/edits`.

### When to use `--image`

**Primary signal:** The user mentions or provides a path to an existing image
file alongside a generation request. This is the most common trigger.

Other signals:
- "edit this", "modify this image", "update the background"
- "like this one", "match the style of", "based on"
- "make it [bluer/darker/bigger]" when referring to an existing file (not just
  a previous generation prompt)
- "use [filename] as reference"

**When NOT to use `--image`:** If the user just wants a prompt adjustment
("make it face left") and there is no existing image file to feed in, use pure
generation with a modified prompt instead.

### `--input-fidelity` guidance

| Value | When to use | Example |
|-------|-------------|---------|
| `low` (default) | Loose style reference, significant changes | "Create new icons matching the style of ref.png" |
| `high` | Preserve specific details — faces, logos, textures | "Recolor this character from blue to red" |

`high` fidelity preserves the **first** `--image` with extra richness. Place
the most important reference image first when using multiple `--image` flags.

### `--mask` for inpainting

Use `--mask` when the user wants to edit only a specific region:
- "replace just the sword with an axe"
- "change the background but keep the character"
- "remove the text in the corner"

The mask must be a **PNG with an alpha channel**. Fully transparent areas mark
the regions to edit; opaque areas are preserved. The mask must match the
dimensions of the first input image.

### Multiple reference images

Pass up to 16 images to guide style consistency:
```bash
node .claude/skills/imagegen/generate.cjs \
  --prompt "A potion bottle in the same style as these items" \
  --output "./assets/items/potion.png" \
  --image "./assets/items/sword.png" \
  --image "./assets/items/shield.png" \
  --input-fidelity low
```

### Chaining edits

The output of one edit can become the `--image` for the next. This enables
iterative refinement using the actual generated image (not just the prompt):
```bash
# First: generate base image
node .claude/skills/imagegen/generate.cjs \
  --prompt "A warrior character" --output "./assets/sprites/warrior.png"

# Then: edit the generated image
node .claude/skills/imagegen/generate.cjs \
  --prompt "Add a red cape flowing behind the warrior" \
  --output "./assets/sprites/warrior-v2.png" \
  --image "./assets/sprites/warrior.png" \
  --input-fidelity high
```

## Output Organization

Organize generated images by asset type:

```
assets/
  sprites/       # Characters, enemies, NPCs
  tiles/         # Ground, walls, platforms, terrain
  items/         # Weapons, potions, collectibles
  ui/            # Buttons, frames, icons, HUD elements
  backgrounds/   # Scene backgrounds, parallax layers
  effects/       # Particles, explosions, magic effects
  portraits/     # Character portraits, dialog faces
  concept/       # Concept art, mood boards, reference
```

The script automatically creates parent directories for the output path. You do
not need to `mkdir` first.

**Default output path rule**: If the project already has an `assets/` directory,
use the appropriate subdirectory (e.g., `assets/sprites/`). If not, create
`assets/` with the appropriate subdirectory. For throwaway test images, use
`./generated-images/`.

Use descriptive filenames: `player-idle.png`, `grass-tile-01.png`,
`health-potion.png`.

**NEVER combine `--background transparent` with JPEG output.** JPEG does not
support transparency. Always use `.png` or `.webp` for transparent images. The
script will reject this combination with an error.

**Always quote the `--output` and `--prompt` values** in the command to handle
spaces and special characters correctly.

**Before generating**, check if a file already exists at the output path. If it
does and this is NOT a deliberate overwrite/iteration, use a different name or
ask the user. If the user explicitly asks to "redo" or "replace" an existing
file, generate as a versioned file (e.g., `warrior-v2.png`) and ask: "Want me
to replace the original `warrior.png` with this version?"

## Confirmation Policy

**Do not ask for confirmation.** The user invoked `/imagegen` — just generate.
Mention the estimated cost in your pre-generation message so the user can
cancel if needed, but do not wait for approval.

- **Batch operations** (3+ images): Summarize the plan and estimated total
  cost before proceeding, since batches can add up.

**Timing**: Image generation typically takes 10-30 seconds per image. Tell the
user to expect a brief wait before invoking the script (e.g., "Generating now —
this usually takes about 15 seconds...").

## Handling Errors

The script outputs JSON to stdout. Check the `success` field:

- `"success": true` — image was saved. Report the path and any relevant details.
- `"success": false` — check the `error` field:
  - **Content policy violation**: Tell the user their request was rejected by
    OpenAI's content policy. Suggest rephrasing. Do NOT retry the same prompt.
  - **Rate limit (429)**: The script already retries internally. If it still
    fails, tell the user to wait a moment and try again.
  - **Authentication error (401)**: API key may be invalid or expired.
  - **Organization not verified (403)**: Tell the user to complete Organization
    Verification at platform.openai.com/settings/organization/general and then
    create a new API key.
  - **Insufficient quota / billing inactive (429)**: Check billing at
    https://platform.openai.com/settings/organization/billing
  - **Other errors**: Report the error message and suggest checking
    https://status.openai.com

If the user's request clearly violates OpenAI's content policy (explicit violence,
sexual content, etc.), inform them before making the API call rather than wasting
a generation.

## Regeneration & Iteration

You support a natural iteration loop. After generating an image, the user may
want to retry, adjust, or compare variants. Handle these patterns seamlessly.

### History File

The script automatically logs every successful generation to
`.imagegen-history.jsonl` in the project root (JSONL format, one JSON object per
line). The ID is auto-derived from the output filename. You do NOT need to pass
extra flags for basic history logging — it just works.

For iterations, pass `--history-parent <id>` to record the parent-child
relationship.

### Detecting Regeneration vs New Generation

Classify each user request:

| Category | Signals | Action |
|----------|---------|--------|
| **New generation** | New subject matter, no reference to previous images | Generate fresh. |
| **Simple retry** | "try again", "regenerate", "another version", "one more" | Reuse the exact same prompt and params. Increment version. |
| **Adjustment** | "make it more [X]", "remove the [Y]", "change [Z] to [W]" | Take the previous prompt, apply the modification, increment version. |
| **Edit existing** | "edit this image", "modify the colors", references a file | Use `--image` with the existing file. Edits the actual image, not just the prompt. |
| **Reference-based** | "I liked the first one", "go back to v1", "use the robot style" | Look up the referenced generation (from context or history file), apply changes. |
| **Style transfer** | "make new icons matching this style", "like this one" | Use `--image` with `--input-fidelity low` for loose style reference. |
| **Batch variants** | "generate 3 versions", "give me some options" | Generate N variants with the same/varied prompts. |

When in doubt, ask: "Would you like me to iterate on the previous [concept]
or start fresh?"

**Batch limits**: At Tier 1 (6 RPM), avoid generating more than 5 images in
rapid succession. For larger batches, inform the user that rate limits may
cause delays. If one generation in a batch fails, report partial results
(which succeeded, which failed and why) and ask how to proceed.

**Disambiguation rule**: When the user says "try again" or "adjust," always
reference the most recent generation by name in your response. If the user
generated multiple concepts recently (within the last 3 messages), ask which
one they mean before proceeding.

### Naming Conventions for Versions

**First generation of a concept:**
- Filename: `assets/sprites/snake-idle.png`
- History ID: `assets/sprites/snake-idle` (auto-derived from path)

**Subsequent versions (retry or adjustment):**
- Filename: `assets/sprites/snake-idle-v2.png`, `snake-idle-v3.png`, ...
- History ID: `assets/sprites/snake-idle-v2`, `assets/sprites/snake-idle-v3`, ...

**Batch variants (multiple options at once):**
- Filename: `potion-alt1.png`, `potion-alt2.png`, `potion-alt3.png`
- History ID: `potion-alt1`, `potion-alt2`, `potion-alt3`

**When refining a batch variant:**
- Selected `potion-alt2` → next version is `potion-alt2-v2.png`
  (preserves lineage in the filename)

Variants go in the **same directory** as the original.

**Before generating a versioned file**, check the output directory to determine
the next version number:
```bash
ls assets/sprites/snake-idle*.png 2>/dev/null
```
This prevents accidentally overwriting an existing version.

### Modifying Prompts for Adjustments

When the user requests an adjustment:

1. Start with the parent generation's exact prompt.
2. Identify which part corresponds to the requested change.
3. Modify only that part. Preserve everything else verbatim — style description,
   color palette, background setting, perspective, etc.
4. If additive ("add a hat"), append to the relevant section.
5. If subtractive ("remove the sword"), delete that phrase or replace it.

**If the parent generation's prompt is no longer visible in conversation
context** (e.g., long session), retrieve it from the history file:
```bash
grep '"id":"snake-idle"' .imagegen-history.jsonl
```

**Example:**

Original: `"Pixel art style. A robot facing right, holding a sword. Blue body. Transparent background."`

User: "make it face left and remove the sword"

Modified: `"Pixel art style. A robot facing left. Blue body. Transparent background."`

### Cross-Session Continuity

If the user references a previous generation and it's not in conversation context
(e.g., new session), search the history file:

```bash
grep "robot" .imagegen-history.jsonl | tail -10
```

Use `grep` to find relevant entries rather than reading the entire file. For
very specific lookups:

```bash
grep '"id":"snake-idle"' .imagegen-history.jsonl
```

Parse the matching JSONL lines to find the referenced entry. Use its `prompt`
and `params` as the basis for the new generation.

If `.imagegen-history.jsonl` does not exist, tell the user there is no
generation history in this project yet.

### Presenting Results and Offering Iteration

After every successful generation, report the result and offer contextual next
steps. Include the concept name so the user can reference it:

```
Generated **snake-idle** → `assets/sprites/snake-idle.png` (246 KB, 1024x1024, medium quality).

You can:
- **Regenerate**: "try again" for a new version with the same prompt
- **Adjust**: "make it face left" / "add a crown" / "more detailed"
- **Upscale**: "regenerate at high quality" for a polished version
- **Move on**: describe the next image you need

To view: `open assets/sprites/snake-idle.png` (macOS) or `xdg-open ...` (Linux)
In a Codespace/devcontainer: use the VS Code file explorer sidebar to click the file.
```

**Note**: Claude Code cannot display images inline, but you CAN use the Read
tool to view a generated image if the user asks you to describe or evaluate it.

Adapt suggestions to context:
- After batch variants, offer selection: "Which version do you prefer? (1, 2, or 3)"
- After 3+ versions, gently suggest: "This is v4. Want one more, or is one close enough?"
- After user says "perfect" or "that's good", move on without offering regen.
- Always include the view command on the first generation so the user knows how to see the image.

### When the User Selects a Version

When the user says "I like v2" or "that one's perfect":
- Note the selection in conversation.
- If the user wants the selected version to **replace the original file** (e.g.,
  because their game code references `warrior.png`), copy/rename it and confirm.
- Offer cleanup: "Want me to delete the other versions, or keep them?"

## Game Asset Workflows

### Consistency Across Assets

When generating multiple related assets (e.g., a character sprite set, a
tileset, a set of item icons):

1. **Establish a style reference first.** Generate one "hero" asset and note
   the exact prompt that produced a good result.
2. **Reuse the style description verbatim** for subsequent assets. Change only
   the subject matter.
3. **Use the same quality/size settings** across related assets.
4. **Maintain a consistent color palette.** State specific colors in prompts:
   "using colors #3A7D44, #F2C94C, #EB5757" rather than "colorful".

### Sprite Sheets and Animation Frames

The API generates single images, not sprite sheets. For animation:

1. Generate each frame individually with explicit pose descriptions.
2. Use identical style descriptions and size for all frames.
3. Name files sequentially: `player-walk-01.png`, `player-walk-02.png`, etc.
4. The user or their tools will assemble frames into a sprite sheet.

### Asset Type Defaults

| Asset Type | Suggested Size | Quality | Background |
|------------|---------------|---------|------------|
| Sprites/Characters | 1024x1024 | medium | transparent |
| Tiles | 1024x1024 | medium | opaque |
| Items/Icons | 1024x1024 | low or medium | transparent |
| UI Elements | 1024x1024 | medium | transparent |
| Backgrounds | 1536x1024 | high | opaque |
| Portraits | 1024x1536 | high | opaque or transparent |
| Concept Art | 1536x1024 | high | opaque |

## Script Location

```bash
node .claude/skills/imagegen/generate.cjs --prompt "..." --output "..." [options]
```
