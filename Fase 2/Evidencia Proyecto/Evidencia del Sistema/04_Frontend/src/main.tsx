import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { initTheme } from "./app/theme";
import App from "./App";
import { SessionProvider } from "./app/SessionContext";
import "./styles.css";

initTheme();

// The data router supplies native navigation blocking for inline draft warnings.
// Existing routes stay in App; no loaders/actions or business transitions run on navigation.
const router = createBrowserRouter([{path: "*", element: <SessionProvider><App /></SessionProvider>}]);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>
);
