import { createRoot } from "react-dom/client";
import App from "./App";
import styles from "./App.css?raw";

console.log(styles);

// div to inject into body
const container = document.createElement('div');
container.id = 'ai-chatbot-extension-root';

// configuring the styles to add to shadow
const sheet = new CSSStyleSheet();
sheet.replaceSync(styles);

// creating the shadow DOM
const shadow = container.attachShadow({mode: "open"});
shadow.adoptedStyleSheets = [sheet];

// Append to body
document.body.appendChild(container);

// Render React app
const root = createRoot(shadow);
root.render(<App />);