/**
 * Renders ThreadSenseComponent into the ThreadSense Shadow DOM root
 */
(function () { 

  /**
   * Renders the SearchBar component into the ThreadSense Shadow DOM root
   * Visible at the top of the page as a temporary placeholder UI
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

  window.ThreadSenseUI = { renderSearchBar };
})();
