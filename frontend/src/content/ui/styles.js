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
      padding: 8px 10px;
      margin-bottom: 10px;
      font-size: 14px;
      border-radius: 7px;
      text-shadow: none;
      text-decoration: none;
      box-shadow: none;
      color: #fff;
      background-color: #0c5fab;
      border-color: #0c5fab;
      cursor: pointer;
    }
    .ts-searchbar-btn:hover {
      color: #fff;
      background-color: #094b87;
      border-color: #09457b;
    }
    `;

    const responseCard = document.createElement("style");
    responseCard.textContent =  `
    .ts-response-card {
      margin-top: 8px;
      margin-bottom: 8px;
      padding: 10px 14px;
      background: #f5f7ff;
      border: 1px solid #d4d8f0;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      color: #333;
    }
    .ts-response-card-header {
      font-weight: 600;
      color: #2d4cc8;
      margin-bottom: 6px;
    }
    `;

    const composerButton = document.createElement("style");
    composerButton.textContent = `
    .ts-composer-area {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      margin-left: 3px;
      align-items: center;
      font-family: system-ui, sans-serif;
    }
    .ts-composer-btn {
      display: inline-flex;
      align-items: center;
      padding: 8px 10px;
      margin-bottom: 10px;
      font-size: 14px;
      border-radius: 7px;
      text-shadow: none;
      text-decoration: none;
      box-shadow: none;
      color: #fff;
      background-color: #0c5fab;
      border-color: #0c5fab;
      cursor: pointer;
    }
    .ts-composer-btn:hover {
      color: #fff;
      background-color: #094b87;
      border-color: #09457b;
    }
    `;

    window.ThreadSenseStyles = { searchBar, responseCard, composerButton };
})();