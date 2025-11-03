# Piazza AI Plugin - Chrome Extension Frontend

A Chrome extension that enhances the Piazza experience with AI-powered features for students and instructors.

## 🚀 Quick Start

### Prerequisites

- Chrome browser (version 88 or higher)
- Text editor or IDE (VS Code recommended)

### Environment Setup

1. **Copy environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your values:**

   ```bash
   # Required
   VITE_API_BASE_URL=http://localhost:8000
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Optional
   VITE_ENABLE_DEBUG_MODE=true
   VITE_NODE_ENV=development
   ```

### Loading the Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `frontend/` folder from this repository
5. The extension should now appear in your extensions list

### Testing the Extension

1. Navigate to any Piazza page (https://piazza.com)
2. The extension will automatically inject a visual indicator
3. Click the extension icon in the toolbar to open the popup
4. Use the "Test Connection" button to verify communication

## 📁 Project Structure

```
frontend/
├── assets/
│   └── icons/                  # Extension icons
├── src/
│   ├── background/             # Background processes
│   │   └── service-worker.js   # Service worker for extension
│   ├── config/                 # Configuration management
│   │   └── config.js           # Environment configuration loader
│   ├── content/                # Content scripts (injected into Piazza)
│   │   ├── bridge/
│   │   │   └── bridge.js       # Message bridge between injected UI and background
│   │   ├── dom/                
│   │   │   └── root.js         # Shadow dom root used for UI injections
│   │   ├── observe
│   │   │   └── observer.js     # Monitor DOM changes for re-injection
│   │   ├── ui/                
│   │   │   ├── components.js   # UI injection components
│   │   │   ├── renders.js      # Renders components into shadow DOM
│   │   │   └── styles.js       # Component styles
│   │   └── piazza-enhancer.js  # Main content script
│   ├── popup/                  # Extension popup interface
│   │   ├── popup.css           # Popup styling
│   │   ├── popup.html          # Popup UI
│   │   └── popup.js            # Popup functionality
│   ├── shared/                 
│   │   └── contracts.js        # Common definitions to avoid naming drift
├── .env                        # Your environment variables (git-ignored)
└── manifest.json               # Extension configuration
```

## 🛠️ Development Workflow

### Making Changes

1. Edit the relevant files in the `src/` directory
2. Go to `chrome://extensions/`
3. Find "Piazza AI Plugin" and click the reload button (🔄)
4. Test your changes on Piazza

### Development Tips

- **Pin the extensions tab**: Keep `chrome://extensions/` pinned for quick reloading
- **Use Developer Tools**: Right-click → "Inspect" on the extension popup for debugging
- **Console logging**: Use `console.log()` in content scripts - logs appear in the page's DevTools
- **Background script logs**: Check the service worker logs in `chrome://extensions/` → "Inspect views"

### File Types and Their Purpose

#### `manifest.json`

- **Purpose**: Extension configuration and permissions
- **Key sections**: Permissions, content scripts, background scripts, popup settings
- **When to edit**: Adding new permissions, changing file paths, updating extension metadata

#### Content Scripts (`src/content/`)

- **Purpose**: Code that runs on Piazza pages
- **Access**: Can modify page DOM, but limited Chrome API access
- **When to edit**: Adding UI elements, enhancing Piazza functionality, page interaction

#### Popup (`src/popup/`)

- **Purpose**: Extension's main interface (toolbar icon click)
- **Access**: Full Chrome API access, can communicate with content scripts
- **When to edit**: Building user controls, settings, main features

#### Service Worker (`src/background/`)

- **Purpose**: Background processing, persistent tasks
- **Access**: Full Chrome API access, no DOM access
- **When to edit**: Background tasks, API calls, cross-tab communication

## ⚙️ Environment Configuration

### Environment Variables

The extension uses environment variables for different deployment environments:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:8000    # Backend API URL
VITE_VERSION=1.0.0                         # Extension version
VITE_NODE_ENV=development                  # Environment (development/production)
```

### Using Configuration in Code

```javascript
// In any extension file (popup, content script, service worker)
const config = window.ExtensionConfig;

// Get API URL
const apiUrl = config.getApiUrl("api/endpoint");

// Check environment
if (config.isDevelopment()) {
  console.log("Running in development mode");
}

// Access specific values
const debugMode = config.get("ENABLE_DEBUG_MODE");
```

### Build Process

The `build.sh` script processes your `.env` file and creates a production-ready extension in the `build/` directory with environment variables properly injected.

## 🔧 Common Development Tasks

### Adding New Features

1. **UI Features**: Modify popup files (`src/popup/`)
2. **Page Integration**: Edit content script (`src/content/piazza-enhancer.js`)
3. **Background Processing**: Update service worker (`src/background/service-worker.js`)

### Debugging

```javascript
// Content script debugging (logs in page console)
console.log("Content script message");

// Popup debugging (logs in popup inspector)
console.log("Popup message");

// Service worker debugging (logs in extension inspector)
console.log("Background message");
```

### Communication Between Components

```javascript
// From content script to popup/background
chrome.runtime.sendMessage({ type: "CONTENT_ACTION", data: {} });

// From popup to content script
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { type: "POPUP_ACTION", data: {} });
});
```

## 🎨 Adding Icons (For Future Ref)

1. Create PNG icons in these sizes: 16px, 32px, 48px, 128px
2. Place them in `assets/icons/` with names:
   - `icon-16.png` (toolbar)
   - `icon-32.png` (Windows)
   - `icon-48.png` (extensions page)
   - `icon-128.png` (Chrome Web Store)
3. Update `manifest.json` to include icon references

## 📋 Extension Permissions

Current permissions in `manifest.json`:

- `activeTab`: Access to current active tab
- `storage`: Local storage for extension data
- `scripting`: Ability to inject scripts
- `host_permissions`: Access to Piazza and localhost (for API calls)

### Adding New Permissions

1. Add to `permissions` array in `manifest.json`
2. Reload extension
3. Chrome will prompt users for new permissions

## 🔌 Backend Integration

The extension is configured to communicate with the FastAPI backend:

- **Local development**: `http://localhost:8000`
- **API calls**: Use `fetch()` in popup or service worker
- **CORS**: Backend is configured to accept requests from the extension

Example API call:

```javascript
async function callBackendAPI() {
  try {
    const response = await fetch("http://localhost:8000/api/endpoint");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API call failed:", error);
  }
}
```

## 🚀 Deployment

### Testing Build

1. Test thoroughly in development mode
2. Verify all features work on different Piazza pages
3. Check console for errors
4. Test popup functionality

### Chrome Web Store Preparation

1. Add proper icons to `assets/icons/`
2. Update version in `manifest.json`
3. Create store screenshots and descriptions
4. Zip the `frontend/` folder (exclude `node_modules` if any)
5. Upload to Chrome Web Store Developer Dashboard

### Common Issues

- **Extension not loading**: Check `manifest.json` syntax, Click the reload button for this extension in [](chrome://extensions/)
- **Content script not working**: Verify file paths and permissions
- **API calls failing**: Check CORS settings and network tab
- **Icons missing**: Add PNG files or remove icon references

## 📚 Resources

- [Chrome Extension Development Guide](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Content Script Guide](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

## 🐛 Troubleshooting

### Extension Won't Load

- Check `manifest.json` for syntax errors
- Verify all file paths exist
- Look for errors in Chrome's extension page

### Content Script Issues

- Ensure Piazza page is fully loaded
- Check browser console for JavaScript errors
- Verify content script permissions

### Communication Problems

**"Could not establish connection" Error:**

- This means the content script isn't loaded on the current page
- **Solution 1**: Refresh the Piazza page and try again
- **Solution 2**: Check that you're on a `https://piazza.com/*` URL
- **Solution 3**: Reload the extension in `chrome://extensions/`

**Other communication issues:**

- Check message format and event listeners
- Verify both sender and receiver are set up properly
- Use Chrome DevTools to debug message flow
- Check the browser console for JavaScript errors

---
