import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./rich-theme.css";
import './accessibility-theme.css';
import './plain-layout.css';
import './styles/owner-console.css';
import './styles/theme-toggle.css';
import './styles/company-console.css';
import { installGlobalFetchLoader } from "./services/loadingService.js";

installGlobalFetchLoader();
try{const theme=localStorage.getItem('ug-display-theme');document.documentElement.dataset.theme=theme==='dark'?'dark':'light';}catch{}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
