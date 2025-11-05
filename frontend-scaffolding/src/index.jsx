import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css"

// Create a shadow DOM to isolate styles from the host page
const container = document.createElement('div');
container.id = 'ai-chatbot-extension-root';

// Append to body
document.body.appendChild(container);

// Render React app
const root = createRoot(container);
root.render(<App />);