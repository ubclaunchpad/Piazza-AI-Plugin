# ThreadSense AI - Browser Extension Frontend

This directory contains the Chrome/Firefox browser extension for the ThreadSense AI Piazza Plugin.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Loading the Extension](#loading-the-extension)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

ThreadSense AI is a browser extension that enhances the Piazza experience with AI-powered features. The extension consists of:

- **Content Script**: Injects AI features directly into Piazza pages
- **Popup**: Extension popup interface for quick access to features
- **Background Service Worker**: Handles background tasks and API communication

## ⚠️ Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- A **Chromium-based browser** (Chrome, Edge, Brave, etc.) or **Firefox**
- **Backend server running** - See [backend setup](../backend/README.md)

## 🚀 Installation & Setup

### 1. Install Dependencies

Navigate to the frontend directory and install the required packages:

```bash
cd frontend
npm install
```

### 2. Configure Backend URL (Optional)

If your backend is running on a different URL than `http://localhost:8000`, you'll need to update the API endpoint:

1. Open `src/content/content.js` or `src/background/background.js` (depending on where API calls are made)
2. Update the backend URL to match your setup
3. Update `manifest.json` host_permissions if needed

## 💻 Development

### Start Development Mode

Run the development build with auto-recompilation on file changes:

```bash
npm run dev
# or
npm start
```

This command:
- Builds the extension in development mode
- Watches for file changes and automatically rebuilds
- Outputs files to the `dist/` directory
- Includes source maps for easier debugging

### Development Workflow

1. **Start the dev build**:
   ```bash
   npm run dev
   ```

2. **Load the extension** in your browser (see [Loading the Extension](#loading-the-extension))

3. **Make changes** to your code in the `src/` directory

4. **Reload the extension**:
   - For content script changes: Reload the Piazza page
   - For popup/background changes: Click the reload button in `chrome://extensions`

## 🏗️ Building for Production

Create an optimized production build:

```bash
npm run build
```

This command:
- Builds the extension in production mode
- Minifies and optimizes the code
- Outputs files to the `dist/` directory
- Removes source maps for smaller file size

The `dist/` folder will contain all the files needed to distribute your extension.

## 🔌 Loading the Extension

### Chrome / Edge / Brave (Chromium-based browsers)

1. **Open Extensions Page**:
   - Navigate to `chrome://extensions/` (Chrome)
   - Or `edge://extensions/` (Edge)
   - Or click the puzzle icon → "Manage Extensions"

2. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load Unpacked Extension**:
   - Click "Load unpacked" button
   - Navigate to and select the `frontend/dist` directory
   - Click "Select Folder"

4. **Verify Installation**:
   - You should see "ThreadSense AI" in your extensions list
   - The extension icon should appear in your browser toolbar

5. **Test the Extension**:
   - Navigate to any Piazza class page: `https://piazza.com/class/*`
   - The extension should automatically inject AI features into the page

### Firefox

1. **Open Debugging Page**:
   - Navigate to `about:debugging#/runtime/this-firefox`

2. **Load Temporary Add-on**:
   - Click "Load Temporary Add-on..."
   - Navigate to `frontend/dist`
   - Select the `manifest.json` file

3. **Verify Installation**:
   - The extension will be loaded temporarily (until browser restart)
   - Navigate to a Piazza page to test

**Note**: For permanent Firefox installation, you'll need to sign the extension through Mozilla's Add-on Developer Hub.

## ⚙️ Configuration

### Manifest Configuration

The extension uses **Manifest V3** (the latest Chrome extension standard). Key configurations in `public/manifest.json`:

- **Content Scripts**: Runs on `https://piazza.com/class/*` pages
- **Permissions**: 
  - `activeTab`: Access to the current tab
  - `storage`: Store user preferences
  - `cookies`: Access Piazza cookies for authentication
- **Host Permissions**: 
  - `https://piazza.com/*`: Access Piazza content
  - `http://localhost:8000/*`: Communicate with local backend

### Updating Backend URL

If your backend runs on a different URL:

1. **Update manifest.json**:
   ```json
   "host_permissions": [
     "https://piazza.com/*",
     "https://your-backend-url.com/*"
   ]
   ```

2. **Update API calls** in your source files to use the new URL

3. **Rebuild** the extension:
   ```bash
   npm run build
   ```

## 🐛 Troubleshooting

### Extension Not Loading

**Problem**: Extension doesn't appear after loading unpacked

**Solutions**:
- Ensure you selected the `dist/` directory, not the `frontend/` directory
- Check that `manifest.json` exists in the `dist/` folder
- Look for errors in the Extensions page
- Try running `npm run build` again

### Content Script Not Running

**Problem**: AI features don't appear on Piazza pages

**Solutions**:
- Verify you're on a Piazza class page: `https://piazza.com/class/*`
- Check the browser console (F12) for errors
- Reload the extension: Go to `chrome://extensions` → Click reload icon
- Reload the Piazza page (Ctrl+R or Cmd+R)

### Build Errors

**Problem**: `npm run dev` or `npm run build` fails

**Solutions**:
- Delete `node_modules/` and `package-lock.json`, then run `npm install` again
- Ensure you're using Node.js v16 or higher: `node --version`
- Check for syntax errors in your code
- Look at the error message for specific issues

### Backend Connection Issues

**Problem**: Extension can't communicate with backend

**Solutions**:
- Ensure the backend server is running (see [backend setup](../backend/README.md))
- Check that the backend URL in your code matches the running server
- Verify `host_permissions` in `manifest.json` includes your backend URL
- Check browser console for CORS errors
- Ensure backend CORS settings allow the extension origin

### Changes Not Reflecting

**Problem**: Code changes don't appear in the extension

**Solutions**:
- **For content script changes**: Reload the Piazza page
- **For popup/background changes**: 
  1. Go to `chrome://extensions`
  2. Click the reload icon on the ThreadSense AI extension
  3. Close and reopen the popup (if testing popup)
- Ensure `npm run dev` is still running and watching for changes
- Check the terminal for build errors

### Permission Errors

**Problem**: Extension shows permission-related errors

**Solutions**:
- Ensure all required permissions are listed in `manifest.json`
- Reload the extension after manifest changes
- Check that host_permissions include all necessary domains
- For local development, ensure `http://localhost:8000/*` is in host_permissions

## 🔗 Related Documentation

- [Main Project README](../README.md)
- [Backend Setup Guide](../backend/README.md)
- [Supabase Setup Guide](../supabase/README.md)
- [Project Setup Guide](../SETUP.md)

## 📚 Additional Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Content Scripts Guide](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Webpack Documentation](https://webpack.js.org/)
- [React Documentation](https://react.dev/)

## 🆘 Getting Help

If you encounter issues not covered here:

1. Check the browser console (F12) for error messages
2. Check the extension's service worker console:
   - Go to `chrome://extensions`
   - Click "service worker" under ThreadSense AI
3. Review the [main project README](../README.md)
4. Contact the development team

---

Happy coding! 🚀

