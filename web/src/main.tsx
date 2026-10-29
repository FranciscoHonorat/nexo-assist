import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./estilo.css";

const raiz = document.getElementById("raiz");
if (raiz === null) throw new Error("a página não tem o elemento #raiz");
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
