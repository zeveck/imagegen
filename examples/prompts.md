# Imagegen Benchmark Prompts

The images in `examples/images/` were generated from these prompts with
`gpt-image-1` at `--quality low`, except the transparent sample which uses
`--quality medium --background transparent`.

This set is meant to overlap with `imagegen2` and, where appropriate,
`nanogen`, so outputs can be compared by prompt category. The tools are not
identical: this skill is the one to choose when native transparent PNG/WebP
output matters.

## Suggested Output Names

```text
cat-tophat.png
cat-tophat-transparent.png
health-potion.png
tactical-knight.png
isometric-grass-tile.png
settings-icon.png
forest-background.png
skeleton-16bit-gpt-image-1.png
```

## Sprite

```text
32-bit pixel art. A tuxedo cat wearing a small black top hat, seated, centered,
blank opaque background, crisp readable silhouette, warm fur highlights, no
text, no watermark, no extra objects.
```

## Transparent Sprite

```text
32-bit pixel art. A tuxedo cat wearing a small black top hat, seated, centered,
crisp readable silhouette, warm fur highlights. The subject is a standalone
element on a transparent background. Do not remove any white or light areas
within the subject itself. Only the area surrounding the subject should be
transparent. No text, no watermark, no extra objects.
```

## Item Icon

```text
Modern pixel art. A glass health potion bottle with red liquid and cork stopper,
centered standalone game icon, crisp outline, bright highlight, blank opaque
background, no text, no watermark.
```

## Tactical RPG Unit

```text
Isometric tactical RPG sprite. A compact knight with blue cape and steel helmet,
readable on a grid, muted fantasy palette, dark outline, blank opaque
background, no text, no watermark.
```

## Terrain Tile

```text
Isometric pixel art grass terrain tile, 2:1 game tile feel, lush green grass
with small stones and flowers, seamless-looking edges, consistent top-left
lighting, blank opaque background, no text, no watermark.
```

## UI Icon

```text
Clean flat vector settings gear icon for a mobile game UI, rounded friendly
shape, teal and gold accents, centered, crisp edges, blank opaque background,
no text, no watermark.
```

## Background

```text
Hand-painted fantasy forest background, twilight lighting, layered trees,
soft mist, path leading into the distance, wide landscape composition, no text,
no watermark.
```

## Reference Edit

```text
16-bit SNES-era pixel art rendition of this skeleton figure. Preserve the
skeleton pose and overall silhouette from the photo, convert it into readable
classic game sprite art with limited palette, crisp pixel edges, subtle shading,
blank opaque background, no text, no watermark.
```
