# Extension Icons

This directory should contain the Chrome extension icons in PNG format.

## Required Icon Sizes

- `icon-16.png` - 16x16 pixels (toolbar icon)
- `icon-32.png` - 32x32 pixels (Windows)
- `icon-48.png` - 48x48 pixels (extension management page)
- `icon-128.png` - 128x128 pixels (Chrome Web Store)

## Design Guidelines

- Use a consistent design across all sizes
- Ensure the icon is recognizable at 16x16 pixels
- Use PNG format with transparency if needed
- Follow Chrome extension design guidelines

## Adding Icons

Once you create the icon files, update the `manifest.json` to include:

```json
"action": {
  "default_popup": "src/popup/popup.html",
  "default_title": "Piazza AI Plugin",
  "default_icon": {
    "16": "assets/icons/icon-16.png",
    "32": "assets/icons/icon-32.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  }
},

"icons": {
  "16": "assets/icons/icon-16.png",
  "32": "assets/icons/icon-32.png",
  "48": "assets/icons/icon-48.png",
  "128": "assets/icons/icon-128.png"
}
```
