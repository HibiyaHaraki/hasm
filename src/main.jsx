// ###################################################
// File Name : main.jsx
// Author : Hibiya Haraki
// Date : August 2026
// ###################################################
// Purpose : Frontend entry point for HASM
// Description : Initializes and renders the React application.
// ###################################################

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
