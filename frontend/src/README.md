
## 📁 Structure

```
src/
├── background/             # Background processes
│   └── service-worker.js   # Service worker for extension
├── config/                 # Configuration management
│   └── config.js           # Environment configuration loader
├── content/                # Content scripts (injected into Piazza)
│   ├── bridge/
│   │   └── bridge.js       # Message bridge to connect UI injections with background
│   ├── dom/                
│   │   └── root.js         # Shadow dom root used for UI injections
│   ├── observe
│   │   └── observer.js     # Monitor DOM changes for re-injection
│   ├── ui/                
│   │   ├── components.js   # UI injection components
│   │   ├── renders.js      # Renders components into shadow DOM
│   │   └── styles.js       # Component styles
│   └── piazza-enhancer.js  # Main content script
├── popup/                  # Extension popup interface
│   ├── popup.css           # Popup styling
│   ├── popup.html          # Popup UI
│   └── popup.js            # Popup functionality
└── shared/                 
    └── contracts.js        # Common definitions to avoid naming drift
```


## 🛠️ Injection Points

|            Component             |                  Position                  |           Selector          |
| :------------------------------: | :----------------------------------------: | :-------------------------: |
| Search Bar                       | Below the Piazza search bar (left column)  | #feed_search_bar            |
| AI Summary Response Card         | Below each visible post (right column)     | #qaContentViewId            |
| Check Duplicates Composer Button | Below the new post composer area           | #main-post > :nth-child(8)  |
| Suggest Answer Composer Button   | Below the student answer composer area     | #s_answer_edit              |


## 📋 Testing

1. In popup, toggle Threadsense On/Off and make sure injections are only injected when toggle is On

2. Ensure search bar is injected on the left column below Piazza search bar
<img width="394" height="212" alt="Screenshot 2025-10-25 at 3 50 02 PM" src="https://github.com/user-attachments/assets/125a6d83-9293-445b-a693-9b548651ddb9" />

3. Ensure AI Summary Response Card is visible below the post. Make sure this is rendered when switching posts without reloading the page
<img width="1059" height="674" alt="Screenshot 2025-10-27 at 8 41 04 PM" src="https://github.com/user-attachments/assets/7eec18bb-da6f-42a8-999d-097e2a59e405" />

4. Ensure Check Duplicates Button is visible under composer area when creating a new post
<img width="677" height="701" alt="Screenshot 2025-10-31 at 9 58 16 PM" src="https://github.com/user-attachments/assets/7a00d5a4-9948-4354-b86e-b483fd1e549e" />

5. Ensure Suggest Answer Button is visible under composer area when editing student answer under a post
<img width="1060" height="661" alt="Screenshot 2025-10-31 at 12 31 46 AM" src="https://github.com/user-attachments/assets/fa51778c-17c8-4135-92cc-3ba0a4efe230" />


6. Check in console that message bridge connecting ui injections and background is working 
   - AI Response Summary Card sends "REQUEST_AI_SUMMARY" > recieve "AI_SUMMARY_RESULT" whenever a post loads
   - Search Button sends "REQUEST_SEARCH" with input text as query > recieve "SEARCH_RESULT" 
   - Suggest Answer button sends "REQUEST_AI_SUGGESTION" on click > recieve "AI_SUGGESTION_RESULT"
   - Check Duplicates button sends "REQUEST_DUPLICATE_CHECK" on click > recieve "DUPLICATE_CHECK_RESULT"
<img width="615" height="538" alt="Screenshot 2025-10-31 at 9 26 48 PM" src="https://github.com/user-attachments/assets/498fc6aa-9f4c-4465-a592-f5db88cf2ddd" />
