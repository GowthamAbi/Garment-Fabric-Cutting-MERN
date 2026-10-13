import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./rich-theme.css";
import './accessibility-theme.css';
import './plain-layout.css';
import { installGlobalFetchLoader } from "./services/loadingService.js";

installGlobalFetchLoader();
try{const theme=localStorage.getItem('ug-display-theme')||'system';document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;}catch{}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
