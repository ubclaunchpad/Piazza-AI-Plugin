/**
 * Renders ThreadSenseComponent into the ThreadSense Shadow DOM root
 */
(function () { 

  /**
   * Renders the SearchBar component into the ThreadSense Shadow DOM root
   * Visible at the top of the page with placeholder UI
   */
  function renderSearchBar() {
    const rootID = window.ThreadSenseContracts.DOM_IDS.SEARCHBAR_ID;
    let shadowRoot = window.ThreadSenseRoot.initRoot(rootID, "#feed_search_bar");
    
    if (!shadowRoot) {
      console.error("Shadow root not available");
    }

    // Prevent duplicate injection
    if (shadowRoot.querySelector(".ts-searchbar-container")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("ts-searchbar-container");
    wrapper.appendChild(window.ThreadSenseStyles.searchBar);

    const searchBar = window.ThreadSenseComponents.createSearchBar();
    wrapper.appendChild(searchBar);

    shadowRoot.appendChild(wrapper);
    console.log("SearchBar component rendered into shadow root");
    console.log("Shadow root:", shadowRoot);
  }

  /**
   * Renders the ResponseCard component into the ThreadSense Shadow DOM root
   * Visible under each post section
   */
  const responseCardRootID = window.ThreadSenseContracts.DOM_IDS.RESPONSECARD_ID;
  const responseCardPosition = '#qaContentViewId'

  function renderResponseCardRequest() {
    console.log("ResponseCard component waiting for post to load...");
    waitForElement(responseCardPosition, renderResponseCard);
  }

  function renderResponseCard() {
    shadowRoot = window.ThreadSenseRoot.initRoot(responseCardRootID, responseCardPosition);

    if (!shadowRoot) {
      console.error("Shadow root not available");
    return;
  }

    // Prevent duplicate injection
    if (shadowRoot.querySelector(".ts-response-card-container")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("ts-response-card-container");
    wrapper.appendChild(window.ThreadSenseStyles.responseCard);

    const responseCard = window.ThreadSenseComponents.createResponseCard();
    wrapper.appendChild(responseCard);

    shadowRoot.appendChild(wrapper);
    console.log("ResponseCard component rendered into shadow root");
    console.log("Shadow root:", shadowRoot);
  }

  /**
   * UI Injection on Load
   */
  function waitForElement(query, callback) {
    if (document.querySelector(query)) {
      callback();
      return;
    }

    const observer = new MutationObserver((_mutations, obs) => {
      const post = document.querySelector(query);
      if (post) {
        obs.disconnect();
        callback();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * UI Injection on Navigation
   */

  let lastUrl = location.href;
  function observeUrlChanges(callback) {
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        callback();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  observeUrlChanges(() => {
    console.log("Navigation detected, re-injecting components...");
    window.ThreadSenseRoot.teardownRootById(responseCardRootID);
    renderResponseCardRequest();
  })

  window.ThreadSenseUI = { renderSearchBar, renderResponseCardRequest };
})();
