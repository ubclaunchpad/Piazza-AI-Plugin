import { createRoot } from "react-dom/client";
import App from "./App";
import { UserAuthProvider } from "../context/UserAuthContext";
import "./popup.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <UserAuthProvider>
      <App />
    </UserAuthProvider>
  );
}
