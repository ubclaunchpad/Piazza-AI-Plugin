/**
 * Renders ThreadSenseComponent into the ThreadSense Shadow DOM root
 */
(function () { 

  /**
   * Renders the SearchBar component into the ThreadSense Shadow DOM root
   * Visible at the top of the page with placeholder UI
   */
  const searchBarRootID = window.ThreadSenseContracts.DOM_IDS.SEARCHBAR_ID;
  const searchBarPosition = "#feed_search_bar";
  
  function renderSearchBar() {
    let shadowDom = window.ThreadSenseRoot.initRoot(searchBarRootID, searchBarPosition);
    
    if (!shadowDom) {
      console.error("Shadow DOM not available");
      return;
    }

    if (shadowDom.querySelector(".ts-searchbar-container")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("ts-searchbar-container");
    wrapper.appendChild(window.ThreadSenseStyles.searchBar);

    const searchBar = window.ThreadSenseComponents.createSearchBar();
    wrapper.appendChild(searchBar);

    shadowDom.appendChild(wrapper);
    console.log("SearchBar component rendered into Shadow DOM");
    console.log("Shadow DOM:", shadowDom);
  }

  /**
   * Renders the ResponseCard component into the ThreadSense Shadow DOM root
   * Visible under each post section
   */
  const responseCardRootID = window.ThreadSenseContracts.DOM_IDS.RESPONSECARD_ID;
  const responseCardPosition = "#qaContentViewId"

  function renderResponseCardRequest() {
    window.ThreadSenseObserver.waitForElement(responseCardPosition, renderResponseCard);
  }

  function renderResponseCard() {
    let shadowDom = window.ThreadSenseRoot.initRoot(responseCardRootID, responseCardPosition);

    if (!shadowDom) {
      console.error("Shadow DOM not available");
      return;
    }

    if (shadowDom.querySelector(".ts-response-card-container")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("ts-response-card-container");
    wrapper.appendChild(window.ThreadSenseStyles.responseCard);

    window.postMessage({
      source: "threadsense",
      type: "REQUEST_AI_SUMMARY",
      payload: { query: "Test AI Summary" }
    });

    const responseCard = window.ThreadSenseComponents.createResponseCard();
    wrapper.appendChild(responseCard);

    shadowDom.appendChild(wrapper);
    console.log("ResponseCard component rendered into Shadow DOM");
    console.log("Shadow DOM:", shadowDom);
  }

  /**
   * Renders the ComposerButton component into the ThreadSense Shadow DOM root
   * Visible below composer area when creating a new post and when 
   */
  const composerButtonRootID = window.ThreadSenseContracts.DOM_IDS.COMPOSER_ID;
  const newPostPosition = "#main-post > :nth-child(8)";
  const studentAnswerPosition = "#s_answer_edit";

  function renderComposerButtonRequest() {
    window.ThreadSenseObserver.waitForElement(newPostPosition, () => renderComposerButton(newPostPosition, "Check Duplicates"));
    window.ThreadSenseObserver.waitForElement(studentAnswerPosition, () => renderComposerButton(studentAnswerPosition, "Suggest Answer"));
  }

  function renderComposerButton(position, message) {
    let shadowDom = window.ThreadSenseRoot.initRoot(composerButtonRootID, position);

    if (!shadowDom) {
      console.error("Shadow DOM not available");
      return;
    }

    if (shadowDom.querySelector(".ts-composer-container")) return;

    const wrapper = document.createElement("div");
    wrapper.classList.add("ts-composer-container");
    wrapper.appendChild(window.ThreadSenseStyles.composerButton);

    const composerButton = window.ThreadSenseComponents.createComposerButton(message);
    wrapper.appendChild(composerButton);

    shadowDom.appendChild(wrapper);
    console.log("ComposerButton component rendered into Shadow DOM");
    console.log("Shadow DOM:", shadowDom);
  }

  window.ThreadSenseUI = { renderSearchBar, renderResponseCardRequest, renderComposerButtonRequest };
})();
