# imagegen — Game Art Generation via OpenAI gpt-image-1

Generate game assets from your terminal or AI agent — sprites, tiles, UI
elements, portraits, concept art — using OpenAI's `gpt-image-1` model.

At its core, `generate.cjs` is a zero-dependency Node.js CLI tool that any
script, agent, or CI pipeline can call directly. It also ships as a Claude
Code skill (`/imagegen`) with built-in style presets, iteration support, and
asset organization — but the CLI works anywhere Node.js runs.

Zero external dependencies. Just Node.js and an API key.

## Quick Start

### 1. Get an OpenAI API Key

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. **Verify your organization** — Settings > Organization > General.
   Requires a government-issued photo ID. Takes 15–30 minutes.
3. **Add billing** — Settings > Billing. Minimum $5 in prepaid credits.
4. **Create a key** —
   [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
   Copy it immediately.

### 2. Install

Copy `generate.cjs` anywhere in your project:

```bash
# Standalone — just the CLI tool
curl -o generate.cjs https://raw.githubusercontent.com/zeveck/imagegen/main/.claude/skills/chatgpt-imagegen/generate.cjs
```

For the full Claude Code skill (with style presets and iteration support):

```bash
mkdir -p .claude/skills/chatgpt-imagegen
# Copy SKILL.md, generate.cjs, and reference.md into that directory
```

### 3. Set Your API Key

Create a `.env` file in your project root:

```
OPENAI_API_KEY=sk-proj-your-key-here
```

The script loads this automatically. Alternatively, set it as a regular
environment variable in your shell.

### 4. Generate

```
/imagegen a pixel art treasure chest with gold coins, transparent
```

## Usage

### CLI (any agent, script, or terminal)

```bash
node generate.cjs --prompt "A pixel art sword" --output "./sword.png"
node generate.cjs --prompt "Forest scene" --output "./bg.png" --size 1536x1024 --quality high
node generate.cjs --prompt "Game icon" --output "./icon.png" --background transparent
```

### Claude Code Skill

With the skill installed, describe what you want naturally:

```
/imagegen a 16-bit RPG snake sprite, transparent background
/imagegen a flat vector settings icon for a mobile game
/imagegen a watercolor forest scene, landscape, high quality
/imagegen an FFT-style knight, transparent
/imagegen 3 potion bottle variants, low quality
```

### Iteration

Image generation is iterative. After every result, you can keep going:

```
try again                          → new version, same prompt
make it more menacing              → adjusts the prompt and regenerates
make the armor red                 → targeted modification
go back to v1                      → re-derives from an earlier version
generate 3 variants                → batch alternatives to compare
regenerate at high quality         → upgrades the keeper
I like v2                          → selects a version
```

All generations are logged to `.imagegen-history.jsonl`, so iteration works
across sessions — you can pick up where you left off.

### Parameters

| Parameter | Options | Default |
|-----------|---------|---------|
| Size | `1024x1024`, `1024x1536`, `1536x1024` | `1024x1024` |
| Quality | `low`, `medium`, `high` | `medium` |
| Background | `transparent`, `opaque` | `auto` |
| Format | `.png`, `.webp`, `.jpg` | `.png` |

### Cost per Image

| Quality | Square | Rectangular |
|---------|--------|-------------|
| Low | ~$0.01 | ~$0.01 |
| Medium | ~$0.04 | ~$0.06 |
| High | ~$0.17 | ~$0.25 |

Iterate at `low` quality (~1 cent per image), then upgrade the keeper to
`high`.

## Style Presets

The skill includes prompt presets for common game art styles. Reference them
by name and Claude composes the full prompt.

### General

| Preset | Description |
|--------|-------------|
| Pixel Art (8-bit) | NES-era, 4-color limit per sprite |
| Pixel Art (16-bit) | SNES-era, richer palette, subtle shading |
| Modern Pixel | Detailed sub-pixel shading, vibrant colors |
| Flat Vector | Solid colors, sharp edges, UI-ready |
| Hand-Painted | Digital painting, visible brush strokes, concept art quality |
| Isometric | 2:1 ratio, game-ready tiles, consistent lighting |
| Low-Poly 3D | Flat-shaded polygons, minimalist geometric |
| Watercolor | Soft edges, paper texture, storybook quality |

### Tactics / SRPG

| Preset | Inspired By |
|--------|-------------|
| FFT / Yoshida | Final Fantasy Tactics — muted earth tones, chibi sprites, medieval manuscript aesthetic |
| Dark Tactics | Tactics Ogre — somber palette, deep purples, political war drama |
| Classic 16-bit SRPG | Shining Force — bright, vivid, heroic adventure |
| Fire Emblem GBA | Sacred Stones — clean 16-color sprites, faction-colored units |
| Anime Tactics | Disgaea — extreme chibi, neon saturated, comedic fantasy |
| HD-2D | Triangle Strategy — pixel sprites in 3D diorama, tilt-shift bokeh, volumetric lighting |

### By Genre

Platformer, Top-Down RPG, Card Game, Visual Novel, Mobile/Casual

### Palettes by Theme

Fantasy Forest, Dungeon/Dark, Ocean/Water, Desert/Arid, Cyberpunk,
Cozy/Wholesome, Horror

See
[reference.md](.claude/skills/chatgpt-imagegen/reference.md)
for the full preset library with prompt text you can customize.

## Asset Organization

Generated images are organized by type:

```
assets/
  sprites/        Characters, enemies, NPCs
  tiles/          Ground, walls, terrain
  items/          Weapons, potions, collectibles
  ui/             Buttons, frames, HUD elements
  backgrounds/    Scene backgrounds, parallax layers
  effects/        Particles, explosions, magic
  portraits/      Character portraits, dialog faces
  concept/        Concept art, exploration
```

The script creates directories automatically.

## GitHub Actions

Add your API key as a repository secret to use in CI or with scheduled
Claude Code agents:

1. Repo **Settings > Secrets and variables > Actions**
2. Add secret: `OPENAI_API_KEY`
3. In your workflow:

```yaml
- name: Generate image
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    node .claude/skills/chatgpt-imagegen/generate.cjs \
      --prompt "A pixel art sword, transparent background" \
      --output "./assets/items/sword.png" \
      --quality medium \
      --background transparent
```

## What's in the Repo

```
.claude/skills/chatgpt-imagegen/
  generate.cjs      The CLI tool — works standalone, no dependencies
  SKILL.md          Claude Code skill definition (optional)
  reference.md      Style presets, prompt templates, cost tables
```

## Requirements

- Node.js 20.12+
- OpenAI API key with `gpt-image-1` access (org verification + $5 minimum)

## License

MIT
