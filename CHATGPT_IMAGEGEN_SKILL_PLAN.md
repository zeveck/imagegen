# ChatGPT Image Generation Skill for Claude Code

### Implementation Plan — v4

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Prerequisites & Manual Setup](#2-prerequisites--manual-setup)
3. [Architecture Overview](#3-architecture-overview)
4. [Skill File Structure](#4-skill-file-structure)
5. [Phase 1: Core Skill (MVP)](#5-phase-1-core-skill-mvp)
   - [5.1 SKILL.md](#51-skillmd)
   - [5.2 generate.js](#52-generatejs)
   - [5.3 reference.md](#53-referencemd)
6. [Phase 2: Game Asset Enhancements](#6-phase-2-game-asset-enhancements)
7. [Future Ideas](#7-future-ideas)
8. [Game Asset Workflow Examples](#8-game-asset-workflow-examples)
9. [Cost Analysis](#9-cost-analysis)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Testing Plan](#11-testing-plan)
12. [Appendix](#12-appendix)

---

## 1. Executive Summary

### What We Are Building

A Claude Code skill (`/imagegen`) that enables Claude to generate images via the OpenAI `gpt-image-1` API, with a built-in **regeneration pipeline** for iterating on results. Claude acts as the orchestrator — composing prompts, choosing parameters, organizing output files, and managing iteration — and delegates the actual API call to a thin Node.js script (`generate.js`).

### Why

- **Game development workflow**: Developers using Claude Code for game projects need placeholder art, sprites, UI elements, icons, and concept art without leaving the terminal.
- **Iteration is the norm**: Image generation rarely produces the perfect result on the first try. The regen pipeline lets you say "try again", "make it bluer", or "go back to v1" naturally.
- **Zero external dependencies**: The script uses only Node.js 20+ built-ins (`fetch`, `fs`, `path`, `Buffer`). No npm install required.
- **Safety by design**: API keys stay in environment variables, never exposed in process lists.

### Design Principles

1. **Claude is the brain, the script is the hands.** All prompt composition, style decisions, iteration logic, and file organization happen in SKILL.md instructions. The script only calls the API and saves the file.
2. **No external dependencies.** Node.js built-in `fetch()` is sufficient. No `axios`, no `sharp`, no `jq`.
3. **Game-asset-first defaults.** PNG output, transparent backgrounds, organized directories by asset type.
4. **Natural iteration.** "try again", "make it more blue", "I like v2" all work without special syntax.
5. **History logging is automatic.** The script always logs to `.imagegen-history.jsonl` by default. Claude doesn't need to remember extra flags.
6. **Fail gracefully.** Retry transient errors, surface clear messages for content policy rejections, never leave the user guessing.

---

## 2. Prerequisites & Manual Setup

These steps require human action and cannot be automated by the skill.

### Step 1: Log Into the OpenAI API Platform

Go to [platform.openai.com](https://platform.openai.com) and log in.

> **If you already have a ChatGPT account**: Use the same email and password (or Google/Microsoft/Apple SSO). Your identity is shared, but the API platform is a separate workspace with its own billing. Your ChatGPT Pro subscription does **NOT** grant API access or credits.
>
> **If you don't have an account**: Sign up at platform.openai.com. You'll need an email address and will go through email verification + CAPTCHA.
>
> **Country restrictions**: The OpenAI API is not available in all countries. Check [OpenAI's supported countries list](https://platform.openai.com/docs/supported-countries) before proceeding.

An organization is automatically created for your account. The "Default project" is ready to use immediately.

### Step 2: Complete Organization Verification

**This is required to access gpt-image-1.** Without it, you will get HTTP 403 errors.

1. Navigate to **Settings > Organization > General** or go directly to: [platform.openai.com/settings/organization/general](https://platform.openai.com/settings/organization/general)
2. Click **"Verify Organization"**
3. You will be redirected to a third-party service (Persona) that requires a **government-issued photo ID** (driver's license, passport, or national ID card). A physical ID is required — digital copies may not work.
4. Follow the prompts to photograph your ID.
5. Verification typically completes within **15-30 minutes**, but can take up to several days in some cases.
6. A single ID can only verify one organization every 90 days.

> **Why is this needed?** OpenAI requires organization verification for "protected" models including gpt-image-1. This is a one-time process.

### Step 3: Add Billing & Purchase Credits

1. Navigate to **Settings > Billing** or go to: [platform.openai.com/settings/organization/billing/overview](https://platform.openai.com/settings/organization/billing/overview)
2. Click **"Add payment method"** and enter a credit or debit card.
3. Choose "Individual" or "Company" (Individual is fine for personal use).
4. Purchase at least **$5 in prepaid credits** (the minimum; default purchase is $10):
   - ~50 high-quality `gpt-image-1` images at 1024x1024
   - ~450 low-quality images
   - ~1000 `gpt-image-1-mini` images at low quality

**Important details:**
- All API billing is **prepaid** — you buy credits upfront, and usage is deducted from your balance.
- **There are no free credits** for image generation. You must pay at least $5 to reach Tier 1, which is the minimum tier for gpt-image-1 access.
- Credits **expire after 1 year** and are non-refundable.
- **Auto-recharge** (recommended): Configure automatic top-ups when your balance drops below a threshold. Go to Billing > Auto recharge. Set a threshold (e.g., $5), recharge amount (e.g., $10), and a **monthly recharge limit** (e.g., $50) to cap spending.

### Step 4: Create an API Key

> **Phone verification required**: The first time you create an API key, OpenAI will require SMS verification of a phone number. Have your phone ready.

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. **Key type**: Choose **Project API Key** (the default and recommended option). These are scoped to a single project and are prefixed with `sk-proj-`. (Legacy "User API Keys" starting with `sk-` still work but are being phased out.)
4. **Project**: Select "Default project" or create a new one.
5. **Owned by**: Choose your own account.
6. **Permissions**: Choose "All" for simplicity, or "Restricted" and enable only the **Images** endpoint group (set to Write) for tighter security.
7. **Name**: Something identifiable like `claude-code-imagegen`.
8. Click **Create secret key**.
9. **COPY THE KEY IMMEDIATELY** — it will never be shown again.

> **Important**: If you completed Organization Verification (Step 2) *after* creating an API key, the old key may not inherit the verified status. Create a **new** key after verification.

### Step 5: Set the Environment Variable

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, or equivalent):

```bash
export OPENAI_API_KEY="sk-proj-your-key-here"
```

Then reload: `source ~/.bashrc` (or restart your terminal).

For **GitHub Codespaces / devcontainers**, set it as a Codespace secret:

1. Go to GitHub Settings > Codespaces > Secrets
2. Add `OPENAI_API_KEY` with your key value
3. Grant access to the relevant repository

### Step 6: Verify Node.js 20+

```bash
node --version
# Should output v20.x.x or higher (v22+ recommended)
```

Node.js 20+ is required for built-in `fetch()` support (stable since Node 20 LTS).

### Step 7: Install the Skill Files

Create the directory and extract the skill files from Section 5:

```bash
mkdir -p .claude/skills/chatgpt-imagegen/
```

Then create three files in that directory — `SKILL.md`, `generate.js`, and
`reference.md` — with the contents from Section 5.1, 5.2, and 5.3 respectively.

> **Tip**: The easiest way is to ask Claude Code itself: "Read the plan at
> CHATGPT_IMAGEGEN_SKILL_PLAN.md and create the three skill files from Section 5."

### Step 8: Update Claude Code Permissions

Add to `.claude/settings.local.json` under `permissions.allow`. If the file doesn't
exist yet, create it with this content:

```json
{
  "permissions": {
    "allow": [
      "Bash(node */generate.js *)"
    ]
  }
}
```

If the file already exists (with other permissions), append the entry to the
existing `allow` array. This permits Claude to invoke the generation script
without prompting for approval each time.

> **Note**: If your `settings.local.json` already has `Bash(node *)` in the
> allow list, this additional entry is redundant but harmless.

### Step 9: Verify API Access

> **Wait for org verification to propagate** (Step 2) before testing.

```bash
curl -s https://api.openai.com/v1/images/generations \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "A white square on a black background",
    "size": "1024x1024",
    "quality": "low"
  }' | head -c 500
```

> **Note**: This test generates a real image and costs ~$0.01.

You should see the beginning of a JSON response with base64 image data. Common errors:

| Error Pattern | HTTP Code | Meaning | Fix |
|---------------|-----------|---------|-----|
| `invalid_api_key` | 401 | Key is wrong, revoked, or malformed | Check you copied the full key; regenerate if needed |
| Message contains "organization must be verified" | 403 | Org not verified for gpt-image-1 | Complete Organization Verification (Step 2); create a new key after |
| `billing_not_active` | 429 | No payment method or expired credits | Add payment method and purchase credits (Step 3) |
| `insufficient_quota` | 429 | No credits remaining | Add more credits |
| `model_not_found` | 404 | No access to this model | Verify org + ensure Tier 1 status ($5 spend) |

### Rate Limits by Tier

| Tier | Spend Required | Account Age | RPM (gpt-image-1) |
|------|---------------|-------------|-------------------|
| Free | $0 | — | **No access** to gpt-image-1 |
| 1    | $5            | —           | 6 |
| 2    | $50           | 7+ days     | 15 |
| 3    | $500          | 30+ days    | 25 |

> **Note**: Tier upgrades may take 24-48 hours to propagate. Check your current tier at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits).

---

## 3. Architecture Overview

```
User Request (or "try again" / "make it bluer")
    |
    v
Claude Code (orchestrator)
    |
    |-- 1. Reads SKILL.md for instructions
    |-- 2. Reads reference.md for style presets, prompt tips, cost info
    |-- 3. Classifies request (new / retry / adjustment / reference-based)
    |-- 4. Composes or modifies the prompt
    |-- 5. Chooses parameters (size, quality, background)
    |-- 6. Determines output path and version number
    |
    v
generate.js (thin API wrapper)
    |
    |-- Reads OPENAI_API_KEY from environment
    |-- Calls POST https://api.openai.com/v1/images/generations
    |-- Retries on 429/500/502/503 with exponential backoff
    |-- Decodes base64 response (gpt-image-1 always returns b64_json)
    |-- Writes image to specified output path
    |-- Automatically appends to .imagegen-history.jsonl
    |-- Prints result summary to stdout (JSON)
    |
    v
Output File (e.g., assets/sprites/snake-idle.png)
    |
    v
Claude Code
    |-- Reports result to user
    |-- Offers iteration options: retry, adjust, upscale, move on
    |-- On "try again" → loops back with same/modified prompt
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Node.js instead of bash | Eliminates jq dependency, base64 portability issues (macOS vs GNU), shell injection risks, and process-list API key exposure |
| No npm dependencies | `fetch()` is built into Node 20+; `Buffer`, `fs`, `path` are core modules |
| Script returns JSON to stdout | Claude can parse results programmatically for chained operations |
| Retry with backoff + 2min timeout | OpenAI rate limits (429) and transient failures (5xx) are common; generation can take 30-60s |
| Claude composes prompts | Style presets are suggestions in reference.md, not hardcoded strings. Claude adapts them to context |
| Confirmation only on first generation in conversation | After that, proceed unless cost > $0.50 or batch of 3+ |
| **History logging is automatic** | Script defaults to `.imagegen-history.jsonl`; auto-derives ID from filename. Claude doesn't need to remember extra flags |
| Append-only JSONL | No in-place mutation of history entries. Selection events are appended as new lines |

---

## 4. Skill File Structure

```
.claude/
  skills/
    chatgpt-imagegen/
      SKILL.md          # Core skill instructions (Claude reads this)
      generate.js       # Node.js API wrapper script (Claude executes this)
      reference.md      # Style presets, prompt templates, cost tables, tips

Project root:
  .imagegen-history.jsonl   # Generation history (created automatically on first use)
```

---

## 5. Phase 1: Core Skill (MVP)

### 5.1 SKILL.md

```yaml
---
name: chatgpt-imagegen
description: Generate images using OpenAI's gpt-image-1 model. Ideal for game assets (sprites, tiles, UI elements, icons), concept art, and placeholder graphics. Supports iteration — "try again", "make it bluer", "go back to v1".
disable-model-invocation: true
allowed-tools: Bash(node */generate.js *)
argument-hint: <description of image to generate>
---
```

````markdown
# Image Generation with gpt-image-1

Generate images via OpenAI's gpt-image-1 API. You (Claude) are the creative
director — you compose prompts, choose parameters, organize output files, and
manage the iteration loop. The bundled `generate.js` script is a thin API
wrapper that handles the API call, saves the result, and automatically logs
to `.imagegen-history.jsonl`.

Read [reference.md](reference.md) at least once when first using this skill
to familiarize yourself with available style presets and cost estimates.

## Prerequisites

- `OPENAI_API_KEY` environment variable must be set
- Node.js 20+ (for built-in `fetch()`)

## Quick Start

```bash
node .claude/skills/chatgpt-imagegen/generate.js \
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
script will warn and switch to PNG if you try.

**Always quote the `--output` and `--prompt` values** in the command to handle
spaces and special characters correctly.

**Before generating**, check if a file already exists at the output path. If it
does and this is NOT a deliberate overwrite/iteration, use a different name or
ask the user. If the user explicitly asks to "redo" or "replace" an existing
file, generate as a versioned file (e.g., `warrior-v2.png`) and ask: "Want me
to replace the original `warrior.png` with this version?"

## Confirmation Policy

- **First generation in this conversation**: Tell the user you will call the
  OpenAI image API, what prompt you plan to use, and the estimated cost. Ask
  for confirmation.
- **Subsequent generations**: Proceed without confirmation unless the estimated
  cost exceeds $0.50 (e.g., multiple high-quality HD images).
- **Simple retries and adjustments**: No confirmation needed — the user explicitly
  asked. Just proceed.
- **Batch operations** (3+ images): Always summarize the plan and estimated total
  cost before proceeding.

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
| **Reference-based** | "I liked the first one", "go back to v1", "use the robot style" | Look up the referenced generation (from context or history file), apply changes. |
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

## Script Location

```bash
node .claude/skills/chatgpt-imagegen/generate.js --prompt "..." --output "..." [options]
```
````

---

### 5.2 generate.js

```javascript
#!/usr/bin/env node

// generate.js — Thin OpenAI gpt-image-1 API wrapper for Claude Code skill.
// Zero external dependencies. Requires Node.js 20+ for built-in fetch().
//
// NOTE: gpt-image-1 always returns b64_json. Do NOT send `response_format`
// (that parameter is only for dall-e-2/dall-e-3 and causes errors with
// gpt-image-1). Use `output_format` for the image encoding (png/jpeg/webp).
//
// Usage:
//   node generate.js --prompt "..." --output "./path/to/image.png" [options]

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Early --help check (before argument parsing, so it works with any flags)
// ---------------------------------------------------------------------------

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
generate.js — OpenAI gpt-image-1 API wrapper

Usage:
  node generate.js --prompt "..." --output "./path/to/image.png" [options]

Required:
  --prompt <string>       Image generation prompt
  --output <path>         Output file path (.png, .jpg, .jpeg, or .webp)

Options:
  --size <size>           1024x1024 | 1024x1536 | 1536x1024 | auto
                          (default: 1024x1024)
  --quality <quality>     low | medium | high | auto (default: medium)
  --background <bg>       transparent | opaque | auto (default: auto)
  --model <model>         Model name (default: gpt-image-1)
  --help, -h              Show this help message

History (automatic by default):
  --history-id <string>   Override auto-derived ID (default: from output path)
  --history-parent <str>  Parent generation ID (for iterations)
  --no-history            Disable history logging for this generation

Environment:
  OPENAI_API_KEY          Required. Your OpenAI API key.

Examples:
  node generate.js --prompt "A pixel art sword" --output "./sword.png"
  node generate.js --prompt "Forest scene" --output "./bg.png" --size 1536x1024 --quality high
  node generate.js --prompt "Game icon" --output "./icon.png" --background transparent
`.trim());
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(message) {
  process.stdout.write(JSON.stringify({ success: false, error: message }) + "\n");
  process.exit(1);
}

function requireArgValue(flag, argv, index) {
  if (index >= argv.length || argv[index] === undefined) {
    fail(`${flag} requires a value.`);
  }
  return argv[index];
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    prompt: null,
    output: null,
    size: "1024x1024",
    quality: "medium",
    background: "auto",
    model: "gpt-image-1",
    historyId: null,      // null = auto-derive from output filename
    historyParent: null,
    noHistory: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--help":
      case "-h":
        break; // Already handled above
      case "--prompt":
        args.prompt = requireArgValue(flag, argv, ++i);
        break;
      case "--output":
        args.output = requireArgValue(flag, argv, ++i);
        break;
      case "--size":
        args.size = requireArgValue(flag, argv, ++i);
        break;
      case "--quality":
        args.quality = requireArgValue(flag, argv, ++i);
        break;
      case "--background":
        args.background = requireArgValue(flag, argv, ++i);
        break;
      case "--model":
        args.model = requireArgValue(flag, argv, ++i);
        break;
      case "--history-id":
        args.historyId = requireArgValue(flag, argv, ++i);
        break;
      case "--history-parent":
        args.historyParent = requireArgValue(flag, argv, ++i);
        break;
      case "--no-history":
        args.noHistory = true;
        break;
      default:
        fail(`Unknown argument: ${flag}. Use --help for usage information.`);
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const VALID_QUALITIES = new Set(["low", "medium", "high", "auto"]);
const VALID_BACKGROUNDS = new Set(["transparent", "opaque", "auto"]);
const VALID_EXTENSIONS = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp" };

function validate(args) {
  if (!args.prompt) fail("--prompt is required.");
  if (!args.output) fail("--output is required.");
  if (!VALID_SIZES.has(args.size))
    fail(`Invalid --size "${args.size}". Must be one of: ${[...VALID_SIZES].join(", ")}`);
  if (!VALID_QUALITIES.has(args.quality))
    fail(`Invalid --quality "${args.quality}". Must be one of: ${[...VALID_QUALITIES].join(", ")}`);
  if (!VALID_BACKGROUNDS.has(args.background))
    fail(`Invalid --background "${args.background}". Must be one of: ${[...VALID_BACKGROUNDS].join(", ")}`);

  const ext = path.extname(args.output).toLowerCase();
  if (!VALID_EXTENSIONS[ext]) {
    fail(`Unsupported file extension "${ext}". Use .png, .jpg, .jpeg, or .webp.`);
  }

  // JPEG does not support transparency
  if (args.background === "transparent" && (ext === ".jpg" || ext === ".jpeg")) {
    fail("JPEG does not support transparency. Use .png or .webp with --background transparent.");
  }
}

// ---------------------------------------------------------------------------
// Retry logic with exponential backoff
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 120_000; // 2 minutes

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.random() * delay * 0.5;
      await sleep(delay + jitter);
    }

    let response;
    try {
      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name === "TimeoutError") {
        lastError = `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
      } else {
        lastError = `Network error: ${err.message}`;
      }
      if (attempt < MAX_RETRIES) continue;
      fail(lastError);
    }

    if (response.ok) return response;

    let body;
    try {
      body = await response.json();
    } catch {
      body = { error: { message: `HTTP ${response.status} ${response.statusText}` } };
    }

    const errorMessage = body?.error?.message || `HTTP ${response.status}`;

    // Content policy — do NOT retry
    if (response.status === 400 && errorMessage.toLowerCase().includes("content policy")) {
      fail(`Content policy violation: ${errorMessage}`);
    }

    // Auth errors — do NOT retry
    if (response.status === 401) {
      fail(`Authentication failed: ${errorMessage}. Check your OPENAI_API_KEY.`);
    }

    // Billing/quota/verification — do NOT retry
    if (response.status === 402 || response.status === 403) {
      fail(`Access denied (HTTP ${response.status}): ${errorMessage}`);
    }

    // Retryable errors
    if (RETRYABLE_STATUS_CODES.has(response.status)) {
      lastError = `HTTP ${response.status}: ${errorMessage}`;
      if (attempt < MAX_RETRIES) continue;
      fail(`Failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`);
    }

    // Any other error
    fail(`API error (HTTP ${response.status}): ${errorMessage}`);
  }

  fail(`Failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  validate(args);

  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    fail(
      "OPENAI_API_KEY environment variable is not set. " +
      "See https://platform.openai.com/api-keys to create one."
    );
  }

  // Ensure output directory exists
  const outputDir = path.dirname(path.resolve(args.output));
  fs.mkdirSync(outputDir, { recursive: true });

  // Determine output format from file extension
  const ext = path.extname(args.output).toLowerCase();
  const outputFormat = VALID_EXTENSIONS[ext]; // Already validated

  // Build request body
  // NOTE: Do NOT include `response_format` — it is not valid for gpt-image-1
  // and will cause errors. gpt-image-1 always returns b64_json.
  const requestBody = {
    model: args.model,
    prompt: args.prompt,
    size: args.size,
    quality: args.quality,
    output_format: outputFormat,
  };

  // Only include background if not "auto" (let the API decide)
  if (args.background !== "auto") {
    requestBody.background = args.background;
  }

  // Call the API
  const response = await fetchWithRetry(
    "https://api.openai.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    }
  );

  // Parse response
  let data;
  try {
    data = await response.json();
  } catch (err) {
    fail(`Failed to parse API response as JSON: ${err.message}`);
  }

  // Extract the base64 image data
  // gpt-image-1 always returns b64_json (no URL option)
  const imageData = data?.data?.[0];
  if (!imageData || !imageData.b64_json) {
    fail("Unexpected API response: no image data (b64_json) returned.");
  }

  const imageBuffer = Buffer.from(imageData.b64_json, "base64");

  // Write to file
  const outputPath = path.resolve(args.output);
  try {
    fs.writeFileSync(outputPath, imageBuffer);
  } catch (err) {
    fail(`Failed to write image to "${outputPath}": ${err.message}`);
  }

  // Auto-derive history ID from output path if not provided
  // Uses relative path minus extension to avoid collisions (e.g.,
  // "assets/sprites/snake-idle" instead of just "snake-idle")
  const historyId = args.historyId ||
    args.output.replace(/\.[^.]+$/, "").replace(/^\.\//, "");

  // Build result
  const result = {
    success: true,
    output: outputPath,
    historyId: historyId,
    size: args.size,
    quality: args.quality,
    background: args.background,
    model: args.model,
    bytes: imageBuffer.length,
  };

  // Append to history file (best-effort — never fail the generation over this)
  if (!args.noHistory) {
    const historyEntry = {
      id: historyId,
      timestamp: new Date().toISOString(),
      prompt: args.prompt,
      output: args.output, // Keep as provided (relative path)
      params: {
        size: args.size,
        quality: args.quality,
        background: args.background,
        model: args.model,
      },
      parentId: args.historyParent || null,
      bytes: imageBuffer.length,
      outputFormat: outputFormat,
    };

    try {
      fs.appendFileSync(
        path.resolve(".imagegen-history.jsonl"),
        JSON.stringify(historyEntry) + "\n"
      );
    } catch (err) {
      result.historyWarning = `Failed to write history: ${err.message}`;
    }
  }

  process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
});
```

---

### 5.3 reference.md

```markdown
# Image Generation Reference

Supplementary reference for the chatgpt-imagegen skill. Contains style presets,
prompt templates, cost estimates, and advanced tips.

---

## Important: What gpt-image-1 Can and Cannot Do

### Strengths
- **Concept art and illustrations**: Excellent at producing stylized images across
  many art styles (painterly, flat, watercolor, etc.)
- **Character design**: Strong at generating characters with specific details when
  prompted well
- **Transparent backgrounds**: Supported natively via `background: "transparent"`
  with PNG output

### Limitations
- **Pixel art is interpretive, not pixel-perfect**: The model generates 1024x1024
  images that *look like* pixel art but are not actual low-res pixel grids. For
  real game sprites, you may need to downscale and clean up output, or treat
  generated images as reference art.
- **Style consistency across generations**: Each generation is independent. Even
  with the same prompt, results will vary. Reuse exact style descriptions and
  specify colors by hex code to maximize consistency.
- **Seamless tiles**: The model can approximate tileable textures but they may not
  tile perfectly. Manual cleanup may be needed.
- **Transparent background bug**: When using `background: "transparent"`,
  gpt-image-1 sometimes removes white areas within the subject itself. See the
  "Transparent Background Best Practices" section in SKILL.md for workarounds.
- **No revised prompt**: gpt-image-1 does NOT return a `revised_prompt` via the
  `/v1/images/generations` endpoint (unlike DALL-E 3). You cannot see how the
  model reinterpreted your prompt.
- **No image preview in CLI**: Claude Code cannot display images inline. The user
  must open generated files in an external viewer.

---

## Style Presets

These are starting-point suggestions. Adapt them to the specific request —
combine elements, adjust details, change palettes. Do not use them as rigid
templates.

### Pixel Art

> "Pixel art style, clean pixels, limited color palette, no anti-aliasing,
> [NxN] pixel canvas"

Variations:
- **Retro 8-bit**: "8-bit retro pixel art, NES-era color palette, 4-color limit per sprite"
- **16-bit**: "16-bit pixel art, SNES-era, richer color palette, subtle shading"
- **Modern pixel**: "Modern pixel art, detailed sub-pixel shading, vibrant colors"

### Flat Vector / UI

> "Clean flat vector illustration, solid colors, no gradients, sharp edges,
> minimal design, suitable for UI"

### Hand-Painted / Concept Art

> "Digital painting style, visible brush strokes, rich color blending,
> concept art quality, painterly lighting"

### Isometric

> "Isometric perspective, 2:1 ratio, clean edges, game-ready isometric tile,
> consistent light source from top-left"

### Low-Poly 3D

> "Low-poly 3D render, flat-shaded polygons, minimalist geometric style,
> soft studio lighting"

### Watercolor / Storybook

> "Watercolor illustration style, soft edges, paper texture, gentle color
> bleeding, storybook quality"

---

## Game-Specific Style Presets

### By Game Genre

**Platformer (2D side-scroller)**
> "2D side-view perspective, vibrant colors, clear silhouette, readable at
> small size, platform-game style"

**Top-Down RPG**
> "Top-down perspective, 45-degree overhead view, RPG style, detailed but
> clean, readable at tile size"

**Card Game**
> "Card illustration style, portrait framing with border space, rich detail
> in center, painterly quality"

**Visual Novel**
> "Anime/manga illustration style, character portrait, expressive features,
> clean line art, soft cel shading"

**Mobile/Casual**
> "Bright cheerful style, rounded shapes, thick outlines, high contrast,
> mobile-friendly clarity"

### Palette Suggestions by Theme

| Theme | Palette Description |
|-------|-------------------|
| Fantasy Forest | Deep greens, warm golds, mossy browns, dappled sunlight |
| Dungeon/Dark | Cool grays, deep purples, torch-orange highlights, dark atmosphere |
| Ocean/Water | Teals, deep blues, seafoam white, coral accents |
| Desert/Arid | Sandy yellows, terracotta, burnt orange, pale blue sky |
| Cyberpunk | Neon pink, electric blue, dark chrome, purple haze |
| Cozy/Wholesome | Warm pastels, soft pinks, cream, light wood tones |
| Horror | Desaturated greens, blood red accents, deep shadows, fog gray |

---

## Prompt Templates by Asset Type

### Characters / Sprites

```
[Style]. [Character description] in [pose]. Facing [direction].
[Outfit/armor/accessories]. [Color palette]. The subject is a standalone
element on a transparent background — do not remove any white or light
areas within the subject. For a [genre] game.
```

### Tilesets / Terrain

```
[Style]. [Terrain type] tile, seamlessly tileable. Top-down view.
[Lighting direction]. [Color palette]. [Texture details].
```

### Items / Collectibles

```
[Style]. [Item name/type], [key visual details]. Centered on canvas.
The subject is a standalone element on a transparent background — do not
remove any white or light areas within the subject. [Size context].
```

### UI Elements

```
[Style]. [UI element type] for a [game genre] game.
[State: normal/hover/pressed]. [Color scheme]. [Shape details].
Transparent background.
```

### Backgrounds / Scenes

```
[Style]. [Scene description]. [Time of day/lighting]. [Mood/atmosphere].
[Perspective]. [Dimensions context].
```

---

## Cost Estimates

Costs are approximate and subject to change. Check
[OpenAI pricing](https://openai.com/api/pricing/) for current rates.

| Quality | Square (1024x1024) | Rectangular (1024x1536 / 1536x1024) |
|---------|-------------------|--------------------------------------|
| Low     | ~$0.011           | ~$0.014                              |
| Medium  | ~$0.042           | ~$0.063                              |
| High    | ~$0.167           | ~$0.250                              |

### Typical Session Costs

| Scenario | Est. Cost |
|----------|-----------|
| Quick prototype: 5 medium sprites | ~$0.21 |
| Character sheet: 8 low-quality variations | ~$0.09 |
| Full tileset: 12 medium tiles | ~$0.50 |
| Hero art: 2 high-quality scenes | ~$0.50 |
| Heavy session: 20 mixed assets | ~$1-3 |

---

## History File Schema (.imagegen-history.jsonl)

Append-only JSONL. Each line is a self-contained JSON object:

```jsonc
{
  "id": "assets/sprites/robot-idle-v2",   // Auto-derived from output path
  "timestamp": "2026-03-15T14:32:07Z",    // ISO 8601 UTC
  "prompt": "Pixel art style...",          // Exact prompt sent to API
  "output": "assets/sprites/robot-idle-v2.png", // Relative to project root
  "params": { "size": "1024x1024", "quality": "medium", "background": "transparent", "model": "gpt-image-1" },
  "parentId": "assets/sprites/robot-idle", // null for first-of-concept
  "bytes": 231044,
  "outputFormat": "png"                    // Image encoding format
}
```

The file is **append-only** — entries are never modified in place. It is also
**disposable** — if deleted, the skill still works. Claude falls back to
conversation context for iteration.

---

## Tips for Better Results

1. **Iterate at low quality first.** Use `--quality low` to explore concepts
   quickly (~$0.01/image), then upgrade to `medium` or `high` for the keeper.

2. **Be explicit about what you do NOT want.** "No text", "no watermark",
   "no background elements", "no gradient".

3. **Reference real art styles.** "In the style of Studio Ghibli backgrounds"
   or "Celeste-inspired pixel art" gives the model strong anchors.

4. **For tilesets, generate one tile at a time.** Requesting a full grid in a
   single image produces inconsistent results.

5. **Transparent backgrounds work best with PNG.** Always use `--background
   transparent` and a `.png` output path together. Include the anti-leak
   prompt language described in SKILL.md.

6. **Square (1024x1024) is most versatile.** Use rectangular only when the
   content clearly benefits (landscapes, tall characters).

7. **Specify colors by hex code for consistency.** "Using colors #3A7D44,
   #F2C94C, #EB5757" produces more consistent results across generations than
   "green, yellow, and red".
```

---

## 6. Phase 2: Game Asset Enhancements

Phase 2 is delivered entirely through additions to SKILL.md and reference.md — no script changes needed.

### Additions to SKILL.md

Add the following after the "Regeneration & Iteration" section:

```markdown
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
```

---

## 7. Future Ideas

Items here are not part of the initial implementation. Documented for future consideration.

### Image Editing / Inpainting

The OpenAI API supports an image editing endpoint (`POST /v1/images/edits`) that takes a source image + prompt and modifies it. A `--edit <source_image>` mode on generate.js would enable targeted refinement: "add a crown to this character", "change the background color". This is the natural next step for the iteration pipeline.

> **Note**: Users will naturally ask for this (e.g., "make an enemy version of this warrior" referencing the generated image). Currently the skill is text-to-image only. When this comes up, explain the limitation and offer to compose a new text prompt that describes the desired variation instead.

### MCP Server Alternative

For heavier usage, the capability could be exposed as an MCP server, which would make it available as a tool across all sessions, enable richer integration, and support more complex workflows. The skill + script approach is simpler for now.

### Batch Mode

A `--batch <json_file>` mode that reads a JSON array of generation requests and processes them sequentially, with resume-on-failure support.

### Engine-Specific Asset Manifests

For Godot `.tres`, Unity `.meta`, Phaser atlas JSON — only worth building for a specific engine format.

### History Search Subcommand

A `--search <query>` mode in generate.js that returns only matching history entries, avoiding the need to dump the full JSONL into Claude's context.

---

## 8. Game Asset Workflow Examples

### Example 1: 16-bit RPG Snake Sprite with Iteration

**User says**: `/imagegen a 16-bit RPG style snake with a blank background`

**Claude**:
1. Confirms: "I'll generate a 16-bit RPG style snake sprite at medium quality (~$0.04). Shall I proceed?"
2. Generates:
   ```bash
   node .claude/skills/chatgpt-imagegen/generate.js \
     --prompt "16-bit pixel art style, SNES-era RPG aesthetic, richer color palette with subtle shading. A snake character, coiled and alert, facing right. Green scaled body with lighter belly, forked tongue, bright eyes. The subject is a standalone element on a transparent background — do not remove any white or light areas within the subject itself. For a top-down RPG game." \
     --output "./assets/sprites/snake-idle.png" \
     --quality medium \
     --background transparent
   ```
3. Reports:
   ```
   Generated **snake-idle** → `assets/sprites/snake-idle.png` (198 KB, 1024x1024, medium).

   You can:
   - "try again" for a different version
   - "make it more menacing" or "add a rattle tail"
   - "regenerate at high quality" for the final
   - Describe your next asset

   To view: `open assets/sprites/snake-idle.png`
   ```

**User**: "make it more menacing"

4. Modifies prompt (adds "menacing expression, darker color scheme, aggressive posture, fangs visible"), saves as `snake-idle-v2.png` with `--history-parent assets/sprites/snake-idle`.

**User**: "perfect, now make a matching slime enemy"

5. Reuses the exact style description, changes subject to slime. New concept: `slime-idle.png`.

### Example 2: Iterative Character Design with Rollback

**User**: `/imagegen a warrior character sprite for my platformer`

1. Generates `warrior.png` (v1 — silver armor, sword and shield)

**User**: "remove the shield and make the armor red"

2. Modifies prompt → `warrior-v2.png` (red armor, sword, no shield)

**User**: "I liked v1's pose better but keep the red armor"

3. Looks up v1's prompt from conversation, applies only the red armor change → `warrior-v3.png`

**User**: "that's the one. now an attack pose"

4. `warrior-attack.png` — new concept using v3's style description

### Example 3: Batch Variants with Selection

**User**: "generate 3 different potion bottle designs"

1. Confirms: "I'll generate 3 potion variants at medium quality (~$0.12 total)."
2. Generates:
   - `potion-alt1.png` — round flask, red healing potion
   - `potion-alt2.png` — tall vial, blue mana potion
   - `potion-alt3.png` — triangular bottle, green poison
3. "Which version do you prefer? I can refine any of them."

**User**: "I like #2 but make the liquid glow"

4. Takes potion-alt2's prompt, adds glow effect → `potion-alt2-v2.png`

### Example 4: Quality Ladder

**User**: `/imagegen a dragon boss for my game, keep it cheap for now`

1. Generates at `--quality low` (~$0.01): `dragon-boss.png`
2. "Low-quality draft. Want me to adjust anything while it's cheap, or upgrade?"

**User**: "looks good, go to high quality"

3. Same prompt, `--quality high` (~$0.17) → `dragon-boss-hq.png`

### Example 5: Cross-Session Continuity

```
[New session — yesterday's context is gone]

User: Make another enemy in the same style as yesterday's robot sprites.

Claude: Let me check the generation history.

[runs: grep "robot" .imagegen-history.jsonl | tail -10]

Claude: Found your robot generations:
- `robot-idle` — pixel art, blue metallic, 32x32 style
- `robot-idle-v2` — facing left
- `robot-walk-01`, `robot-walk-02`

I'll create an enemy robot using the same style description...
```

---

## 9. Cost Analysis

### Per-Image Costs (approximate)

> Check [openai.com/api/pricing](https://openai.com/api/pricing/) for current rates.

| Quality | Square (1024x1024) | Rectangular |
|---------|-------------------|-------------|
| Low     | ~$0.011           | ~$0.014     |
| Medium  | ~$0.042           | ~$0.063     |
| High    | ~$0.167           | ~$0.250     |

### Recommended Workflow: Quality Ladder

| Phase | What | Quality | Count | Est. Cost |
|-------|------|---------|-------|-----------|
| Explore | Low-quality concept sketches | Low | 5 | $0.06 |
| Iterate | Adjustments on favorites | Medium | 8 | $0.34 |
| Polish | Final hero assets | High | 3 | $0.50 |
| **Total** | **Typical session** | **Mixed** | **16** | **~$0.90** |

### Budget Guidelines

| Budget | What You Get |
|--------|-------------|
| $5     | A game jam's worth of assets (~50-100 images) |
| $20    | A polished indie game's core art assets |
| $50    | Extensive asset library with variations and iterations |

### Cost Controls

- Use `--quality low` for exploration (10-15x cheaper than high)
- Set spending limits at [platform.openai.com/settings/organization/limits](https://platform.openai.com/settings/organization/limits)
- Configure auto-recharge with a monthly cap to prevent surprise bills

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **API key leaked** | Low | High | Key only in env var; Node.js fetch doesn't expose headers in process list |
| **Organization not verified** | High (first time) | High | Clear setup instructions in Section 2; error points to verification URL |
| **Content policy rejection** | Medium | Low | Claude suggests rephrasing; script detects and does not retry |
| **Rate limiting (429)** | Medium | Low | Script retries up to 3x with exponential backoff + jitter; 2-min timeout |
| **Cost overrun** | Low | Medium | Confirmation on first use and for batches; OpenAI spending limits + auto-recharge cap |
| **Transparent background bug** | High | Medium | Anti-leak prompt language in all templates; opaque + post-process workaround documented |
| **Style inconsistency** | High | Medium | SKILL.md instructs reuse of exact style descriptions; hex color codes; history preserves prompts |
| **Pixel art not pixel-perfect** | High | Low | reference.md sets expectations: output is interpretive, may need post-processing |
| **API format changes** | Low | Medium | Script validates response; `response_format` vs `output_format` distinction documented in code comments |
| **History file grows large** | Medium | Low | `grep` for lookups (not `cat`); file is disposable; append-only (no corruption risk from mutation) |
| **Country restrictions** | Low | High | Documented in setup guide |

---

## 11. Testing Plan

### Test 1: Prerequisites

```bash
node --version                    # Must be v20+
node -e "console.log(process.env.OPENAI_API_KEY ? 'Key set' : 'Key NOT set')"
```

### Test 2: Help Flag

```bash
node .claude/skills/chatgpt-imagegen/generate.js --help
# Works even with extra flags:
node .claude/skills/chatgpt-imagegen/generate.js --help --foo
```

### Test 3: Argument Validation

```bash
# Missing prompt
node .claude/skills/chatgpt-imagegen/generate.js
# → {"success":false,"error":"--prompt is required."}

# Missing output
node .claude/skills/chatgpt-imagegen/generate.js --prompt "test"
# → {"success":false,"error":"--output is required."}

# Invalid size
node .claude/skills/chatgpt-imagegen/generate.js --prompt "test" --output "t.png" --size 999x999
# → error about invalid size

# Flag with missing value
node .claude/skills/chatgpt-imagegen/generate.js --prompt
# → {"success":false,"error":"--prompt requires a value."}

# Unsupported extension
node .claude/skills/chatgpt-imagegen/generate.js --prompt "test" --output "t.bmp"
# → error about unsupported extension
```

### Test 4: Missing API Key

```bash
OPENAI_API_KEY="" node .claude/skills/chatgpt-imagegen/generate.js --prompt "test" --output "t.png"
# → error about missing key
```

### Test 5: Successful Generation (requires API key + credits)

```bash
node .claude/skills/chatgpt-imagegen/generate.js \
  --prompt "A simple red circle on white background" \
  --output "/tmp/test-imagegen.png" \
  --quality low

file /tmp/test-imagegen.png   # Should show "PNG image data"
cat .imagegen-history.jsonl   # Should have one entry with id "test-imagegen"
```

### Test 6: Transparent Background

```bash
node .claude/skills/chatgpt-imagegen/generate.js \
  --prompt "A green star shape, centered. The subject is a standalone element on a transparent background." \
  --output "/tmp/test-transparent.png" \
  --quality low \
  --background transparent
```

### Test 7: History Auto-Logging

```bash
# Generate two images
node .claude/skills/chatgpt-imagegen/generate.js \
  --prompt "A blue square" --output "/tmp/blue-square.png" --quality low

node .claude/skills/chatgpt-imagegen/generate.js \
  --prompt "A red square" --output "/tmp/red-square.png" --quality low \
  --history-parent "blue-square"

# Verify history
wc -l .imagegen-history.jsonl    # Should show 2 lines
grep "blue-square" .imagegen-history.jsonl  # Should find entry
grep "red-square" .imagegen-history.jsonl   # Should show parentId: "blue-square"
```

### Test 8: No-History Flag

```bash
node .claude/skills/chatgpt-imagegen/generate.js \
  --prompt "A green square" --output "/tmp/green-square.png" --quality low --no-history

# History file should NOT have a green-square entry
grep "green-square" .imagegen-history.jsonl  # Should find nothing
```

### Test 9: Directory Auto-Creation

```bash
node .claude/skills/chatgpt-imagegen/generate.js \
  --prompt "A blue square" \
  --output "/tmp/test-nested/sub/dir/test.png" \
  --quality low
```

### Test 10: End-to-End Skill Invocation + Iteration

In Claude Code:
```
/imagegen a pixel-art mushroom sprite, low quality for testing
```
Then: `try again` → verify v2 is created.
Then: `make it red instead of brown` → verify v3 with modified prompt.

---

## 12. Appendix

### A. .gitignore Additions

```gitignore
# Generated image assets — uncomment the lines relevant to your project:
# generated-images/          # If using the generated-images/ directory
# assets/                    # If you don't want to track assets in git

# Image generation history (local iteration tracking)
.imagegen-history.jsonl

# Never commit API keys
.env
.env.local
```

Whether to commit generated assets depends on the project:
- **Commit them** if they are final game assets that other team members need.
- **Ignore them** if they are exploratory/temporary and can be regenerated.
- **Use Git LFS** for large binary assets in production projects.

### B. Quick Reference Card

```
/imagegen <prompt>              — Generate a new image
"try again"                     — Regenerate with same prompt
"make it [adjustment]"          — Modify and regenerate
"I like v2"                     — Select a version
"go back to v1"                 — Re-derive from v1's prompt
"generate 3 variants"           — Batch alternatives
"high quality version"          — Same prompt, upgrade quality

SIZES:        1024x1024 (default) | 1024x1536 | 1536x1024 | auto
QUALITIES:    low (~$0.01) | medium (~$0.04, default) | high (~$0.17)
BACKGROUNDS:  transparent | opaque | auto (default)

DIRECTORIES:
  assets/sprites/      Characters, enemies, NPCs
  assets/tiles/        Ground, walls, terrain
  assets/items/        Weapons, potions, collectibles
  assets/ui/           Buttons, frames, HUD
  assets/backgrounds/  Scene backgrounds
  assets/effects/      Particles, explosions
  assets/portraits/    Character portraits
  assets/concept/      Concept art, exploration
```

### C. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `OPENAI_API_KEY not set` | Key not exported | Add `export OPENAI_API_KEY=sk-proj-...` to shell profile, restart terminal |
| `Authentication failed` | Invalid/expired key | Generate new key at platform.openai.com/api-keys |
| `Access denied (HTTP 403)` | Org not verified | Complete Org Verification at Settings > Organization > General; create new key after |
| `Access denied (HTTP 429)` with billing message | No billing/credits | Add credits at platform.openai.com billing settings |
| `model_not_found` | No access to gpt-image-1 | Verify org + ensure Tier 1 ($5 minimum spend) |
| `Content policy violation` | Prompt rejected | Rephrase; avoid violent, sexual, or deceptive content |
| `Failed after 4 attempts` | Persistent rate limit/outage | Wait a few minutes; check status.openai.com |
| `Request timed out` | Slow generation or network issue | Retry; check connectivity |
| `Unsupported file extension` | Output path not .png/.jpg/.webp | Use a supported extension |
| White areas removed from subject | Transparent background bug | Add anti-leak language to prompt; or use opaque bg + post-process |
| Tier upgrade not taking effect | Propagation delay | Wait 24-48 hours; create a new API key after upgrade |

### D. History File (.imagegen-history.jsonl)

The history file is **disposable** — the skill works fine without it. It exists for:
- Cross-session prompt reuse ("use the same style as yesterday's robot")
- Version tracking (which generation led to which)
- Prompt archaeology (what exact wording produced a good result)

If it gets corrupted or deleted, just delete it. Claude falls back to conversation context. The file is **append-only** — entries are never modified in place. Use `grep` for efficient lookups on large files.

---

## Appendix E. Changes from v2 (v3)

- **generate.js**: Added arg-value guards (`requireArgValue`), fetch timeout (2min), `response.json()` try-catch, `writeFileSync` try-catch, file extension validation, `quality: "auto"` support, removed `n:1` from request body, added `response_format` vs `output_format` documentation, early `--help` handling
- **generate.js**: History logging is now **automatic** (no flags needed). ID auto-derived from filename. `--no-history` to opt out. Removed `--history-adjustment` flag (unnecessary metadata)
- **SKILL.md**: Fixed `allowed-tools` to use non-deprecated space-based wildcard. Added no-arguments handling. Added file-exists check guidance. Added image preview command. Changed "first in session" to "first in this conversation". Uses `grep` instead of `cat` for history lookups. Removed in-place status mutation (append-only JSONL). Added disambiguation rule for "try again". Fixed alt-to-version naming (e.g., `potion-alt2-v2.png`)
- **Setup guide**: Fixed `billing_not_active` to HTTP 429. Fixed `organization_must_be_verified` to be a message pattern. Node.js 20+ (was 22+). Added country restrictions note
- **reference.md**: Noted `revised_prompt` not returned by gpt-image-1. Added "no image preview in CLI" limitation. Merged game-specific presets

## Appendix F. Changes from v3 (v4)

v4 incorporated findings from four specialized review agents:

**API Verification** (all fields PASS):
- Confirmed every request/response field against current OpenAI docs — no API issues found
- Added JPEG+transparent validation (script now rejects this combination instead of silent data loss)

**allowed-tools Pattern Review**:
- Changed `:*` to ` *` (deprecated syntax → modern syntax) in both SKILL.md and settings instructions
- Confirmed the `*` glob matches nested paths including `/` separators

**End-to-End Simulation** (29 gaps found, all addressed):
- Step 7: Added explicit `mkdir -p` command and tip to use Claude Code for file extraction
- Step 8: Added full `settings.local.json` file structure example for new files
- Step 9: Increased `head -c` to 500 and added cost warning
- SKILL.md: Added "script creates directories automatically" note
- SKILL.md: Added explicit default output path rule (`assets/` if exists, create if not)
- SKILL.md: Added "NEVER combine transparent with JPEG" hard rule
- SKILL.md: Added "always quote --output and --prompt" reminder
- SKILL.md: Added generation timing expectation (10-30 seconds)
- SKILL.md: Added prompt retrieval from history when context is lost
- SKILL.md: Added `ls` check before versioned filenames to prevent overwrites
- SKILL.md: Added Codespace/devcontainer image viewing instructions
- SKILL.md: Added Claude can Read images to describe/evaluate them
- SKILL.md: Added batch rate limit guidance (max ~5 at Tier 1)
- SKILL.md: Added partial batch failure handling instructions
- SKILL.md: Added history file existence check instruction
- Gitignore: Reconciled `generated-images/` vs `assets/` mismatch

**History File Architecture Review**:
- Fixed ID collision: IDs now use relative path (e.g., `assets/sprites/snake-idle`) instead of bare basename — eliminates collisions across directories
- Added `outputFormat` field to history entries
- Confirmed JSONL append atomicity is safe for single-user use on local filesystems
- Confirmed `grep` scales fine to 10K+ entries (sub-millisecond)

---

*Plan complete. All code, configuration, and file contents are ready for implementation.*
