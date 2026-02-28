import React from 'react';
import { createRoot } from 'react-dom/client';
import PostAssistant from './PostAssistant.jsx';
import cssText from "./content.css?raw";

const INJECTED_CLASS = 'piazza-ai-injected';

export function initPostInjector() {
  console.log("🚀 Piazza AI: PostInjector initialized");
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        shouldCheck = true;
      }
    });
    
    if (shouldCheck) {
      checkForPosts();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial check
  checkForPosts();
}

function checkForPosts() {
  // Target the main post container directly
  const postContainer = document.getElementById('qaContentViewId');

  if (!postContainer) return;
  if (postContainer.classList.contains(INJECTED_CLASS)) return;

  // Find the content element to extract text from (cleaner than taking whole post text)
  const contentElement = postContainer.querySelector('.render-html-content');
  if (!contentElement) {
    console.log("⚠️ Piazza AI: Content element (.render-html-content) not found");
    return;
  }

  const content = contentElement.innerText || contentElement.textContent;

  // Extract Thread ID (Class ID)
  const threadIdMatch = window.location.pathname.match(/\/class\/([^/?]+)/);
  const threadId = threadIdMatch ? threadIdMatch[1] : null;

  // Extract Post Number
  let postNum = null;
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('cid')) {
    postNum = urlParams.get('cid');
  } else {
    const postMatch = window.location.pathname.match(/\/post\/(\d+)/);
    if (postMatch) postNum = postMatch[1];
  }
  
  // Fallback to DOM if not in URL
  if (!postNum) {
     const copyBtn = document.querySelector('.post_number_copy');
     if (copyBtn) {
        postNum = copyBtn.textContent.replace('@', '').trim();
     }
  }

  console.log(`Piazza AI: Injecting toolbar for Post #${postNum} (Thread: ${threadId})`);

  // Create a container for our toolbar
  const toolbarContainer = document.createElement('div');
  toolbarContainer.className = 'piazza-ai-toolbar-container';

  // Append to the bottom of the post container (this puts it after the footer)
  postContainer.appendChild(toolbarContainer);
  postContainer.classList.add(INJECTED_CLASS);

  // Create Shadow DOM for style isolation
  const shadowRoot = toolbarContainer.attachShadow({ mode: 'open' });

  // Inject Styles (Tailwind + Custom)
  const style = document.createElement('style');
  style.textContent = cssText;
  shadowRoot.appendChild(style);

  // Add KaTeX CSS for math rendering
  const katexLink = document.createElement("link");
  katexLink.rel = "stylesheet";
  katexLink.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
  katexLink.crossOrigin = "anonymous";
  shadowRoot.appendChild(katexLink);

  // Create mount point inside shadow DOM
  const mountPoint = document.createElement('div');
  shadowRoot.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<PostAssistant threadId={threadId} postNum={postNum} content={content} />);
}