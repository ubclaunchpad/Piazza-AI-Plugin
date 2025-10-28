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
    let shadowRoot = window.ThreadSenseRoot.getRoot(rootID);
    
    if (!shadowRoot) {
      shadowRoot = window.ThreadSenseRoot.initRoot(rootID, "#feed_search_bar");
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
   * Visible under each post below Student Answer
   */
  const responseCardPosition = '#qaContentViewId'
  function renderResponseCardRequest() {
    waitForPost(responseCardPosition, renderResponseCard);
  }

  function renderResponseCard() {
    const rootID = window.ThreadSenseContracts.DOM_IDS.RESPONSECARD_ID;
    let shadowRoot = window.ThreadSenseRoot.getRoot(rootID);

    if (!shadowRoot) {
      shadowRoot = window.ThreadSenseRoot.initRoot(rootID, responseCardPosition);
    }

    // Prevent duplicate injection
    if (shadowRoot.querySelector(".ts-response-card-container")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("ts-response-card-container");
    wrapper.appendChild(window.ThreadSenseStyles.responseCard);

    const responseCard = window.ThreadSenseComponents.createResponseCard();
    wrapper.appendChild(responseCard);

    shadowRoot.appendChild(wrapper);
    console.log("Response Card component rendered into shadow root");
    console.log("Shadow root:", shadowRoot);
  }

  /**
   * Helper that waits for query element to be loaded 
   * Then calls callback functino
   */
  function waitForPost(query, callback) {
    const observer = new MutationObserver((_mutations, obs) => {
      const post = document.querySelector(query);
      if (post) {
        obs.disconnect();
        callback();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.ThreadSenseUI = { renderSearchBar, renderResponseCardRequest };
})();
