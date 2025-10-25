const { createSearchBar } = window.ThreadSenseComponents;

/**
 * Renders ThreadSenseComponent into the ThreadSense Shadow DOM root
 */
(function () { 

  /**
   * Renders the SearchBar component into the ThreadSense Shadow DOM root
   * Visible at the top of the page as a temporary placeholder UI
   */
  function renderSearchBar() {

    const shadowRoot = window.ThreadSenseRoot.getRoot();
    if (!shadowRoot) {
      console.error("window.ThreadSense.renderSearchBar: Shadow DOM root not available");
      return;
    }

    // Prevent duplicate injection
    if (shadowRoot.querySelector(".ts-searchbar-container")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("ts-searchbar-container");
    wrapper.appendChild(window.ThreadSenseStyles.searchBar);

    const searchBar = createSearchBar();
    wrapper.appendChild(searchBar);

    shadowRoot.appendChild(wrapper);
    console.log("SearchBar component rendered into shadow root");
    console.log("Shadow root:", shadowRoot);
  }

  window.ThreadSenseUI = { renderSearchBar };
})();
