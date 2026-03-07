import React from "react";
import { createRoot } from "react-dom/client";
import InjectedEventButton from "./InjectedEventButton.jsx";

export default function injectEventButtonToPosts() {
  const containers = document.querySelectorAll("div#qanda-content");

  containers.forEach((container) => {
    const article = container.querySelector("article#qaContentViewId");
    if (article && !article.querySelector(".my-injected-link")) {
      const mountDiv = document.createElement("div");
      article.appendChild(mountDiv);
      createRoot(mountDiv).render(<InjectedEventButton />);
    }
  });
}
