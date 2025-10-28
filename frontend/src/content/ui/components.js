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
      // TODO: connect to messaging bridge -> REQUEST_SEARCH via postMessage.
    });

    container.append(input, button);
    console.log("SearchBar component created");
    return container;
  }

  /**
   * ResponseCard Component
   * -----------------------
   * AI-generated summaries and insights component to appear below each posts' student answer
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

  window.ThreadSenseComponents = { createSearchBar, createResponseCard };
})();
