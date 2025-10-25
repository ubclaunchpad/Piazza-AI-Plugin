/* Temporary content script styles */

(function () { 

    const searchBar = document.createElement("style");
    searchBar.textContent = `
    .ts-searchbar {
      display: flex;
      gap: 6px;
      align-items: center;
      font-family: system-ui, sans-serif;
    }
    .ts-searchbar-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #ccc;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .ts-searchbar-btn {
      display: inline-flex;
      align-items: center;
      padding-top: 5px;
      padding-bottom: 5px;
      font-size: 14px;
      border-radius: 7px;
      text-shadow: none;
      text-decoration: none;
      color: #fff;
      background-color: #0c5fab;
      border-color: #0c5fab;
      cursor: pointer;
    }
    .ts-searchbar-btn:hover {
      background: #556cd6;
    }
  `;

    window.ThreadSenseStyles = { searchBar };
})();