/**
 * Defines the components used in ui injections
 */

(function () {
  /**
   * SearchBar Component
   * A semantic search input bar with placeholder UI
   */
  function createSearchBar() {
    const container = document.createElement("div");
    container.classList.add("ts-searchbar");

    const input = document.createElement("input");
    input.type = "text";
    input.id = "ts-searchbar-id"
    input.placeholder = "Search threads semantically...";
    input.classList.add("ts-searchbar-input");

    const button = document.createElement("button");
    button.textContent = "Search";
    button.classList.add("ts-searchbar-btn");

    button.addEventListener("click", () => {
      const query = input.value.trim();
      if (!query) return;
      console.log("🧠 Semantic search triggered:", query);

      window.postMessage({
        source: "threadsense",
        type: window.ThreadSenseContracts.EVENT_TYPES.REQUEST_SEARCH,
        payload: { query: query }
      });

    });

    container.append(input, button);
    console.log("SearchBar component created");
    return container;
  }

  /**
   * ResponseCard Component
   * -----------------------
   * AI-generated summaries and insights component to appear below each visible post
   */
  function createResponseCard(summaryText = "AI summary coming soon...") {
    const container = document.createElement("div");
    container.classList.add("ts-response-card");

    const header = document.createElement("div");
    header.textContent = "💡 ThreadSense AI Response Summary";
    header.classList.add("ts-response-card-header");

    const content = document.createElement("div");
    content.classList.add("ts-response-card-content");
    content.textContent = summaryText;

    container.append(header, content);
    console.log("ResponseCard component created");
    return container;
  };

  /**
   * ComposerButton Component
   * -----------------------
   * A button to check duplicates or suggest answer insights in the composer area
   */
  function createComposerButton(message, req) {
    const container = document.createElement("div");
    container.classList.add("ts-composer-area");

    const button = document.createElement("button");
    button.textContent = message;
    button.classList.add("ts-composer-btn");

    button.addEventListener("click", () => {
      const query = "Composer area draft query";
      if (!query) return;
      console.log("🧠 Composer button triggered:");

      window.postMessage({
        source: "threadsense",
        type: req,
        payload: { query: query }
      });

    });

    container.append(button);
    console.log("ComposerButton component created");
    return container;
  }

  window.ThreadSenseComponents = { createSearchBar, createResponseCard, createComposerButton };
})();
