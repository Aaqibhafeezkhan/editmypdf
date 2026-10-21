import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Root } from "./root.tsx";
import { applyTheme, readTheme } from "./theme.ts";
import "./index.css";

applyTheme(readTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <Root />
    </TooltipProvider>
  </StrictMode>,
);
