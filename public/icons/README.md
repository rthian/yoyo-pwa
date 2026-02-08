# PWA Icons

Add your app icons here. Required sizes for PWA:

- `icon-192x192.png` - Used for Android home screen
- `icon-512x512.png` - Used for splash screens
- `icon-maskable-192x192.png` - Adaptive icon for Android
- `icon-maskable-512x512.png` - Adaptive icon for Android

## Creating Icons

### Option 1: Online Generator

1. Create a 1024x1024 source image
2. Use [realfavicongenerator.net](https://realfavicongenerator.net)
3. Download and extract to this folder

### Option 2: From SVG

If you have an SVG logo:

```bash
# Using ImageMagick
convert -background transparent logo.svg -resize 192x192 icon-192x192.png
convert -background transparent logo.svg -resize 512x512 icon-512x512.png
```

### Maskable Icons

Maskable icons need "safe zone" padding (at least 10% on each side).
Use [maskable.app](https://maskable.app/editor) to preview and create.

## Current Setup

The `manifest.json` references these icons. Until you add real icons,
the PWA will work but may show a default icon on install.
