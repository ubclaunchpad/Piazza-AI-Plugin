// Background script for handling extension logic
chrome.runtime.onInstalled.addListener(() => {
    console.log('ThreadSense extension installed');
});

// Handle messages from content script if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_RESPONSE') {
        // Handle chat API calls here
        sendResponse({ message: 'Response from background' });
    }
    return true;
});