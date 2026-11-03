import type { ReactNode } from "react";
import { PRODUCT, routeHref, ROUTES } from "./data/product.ts";
import { MenuBar, MenuButton, type MenuDef } from "./menus.tsx";
import { navigate, plainClick } from "./router.ts";
import { LogoMark } from "./site/Logo.tsx";
import { useMediaQuery } from "./useMediaQuery.ts";

// The bar across the top of the editor and the documents screen: the brand, the application menus
// (folded into one button in a narrow window), whatever belongs in the middle (the document's
// name) and the primary actions on the right.
export function AppBar({
  menus,
  brandTo = ROUTES.app,
  brandLabel = "Documents",
  center,
  children,
}: {
  menus?: MenuDef[];
  // Where the brand mark leads.
  brandTo?: string;
  brandLabel?: string;
  center?: ReactNode;
  children?: ReactNode;
}) {
  const compact = useMediaQuery("(max-width: 860px)");
  return (
    <header className="app-bar">
      <div className="app-bar-start">
        <a
          className="app-brand"
          href={routeHref(brandTo)}
          aria-label={brandLabel}
          title={brandLabel}
          onClick={(event) => {
            if (!plainClick(event)) return;
            event.preventDefault();
            navigate(brandTo);
          }}
        >
          <LogoMark size={24} />
          <span className="app-brand-word">{PRODUCT.name}</span>
        </a>
        {menus && (compact ? <MenuButton menus={menus} /> : <MenuBar menus={menus} />)}
      </div>
      <div className="app-bar-center">{center}</div>
      <div className="app-bar-end">{children}</div>
    </header>
  );
}
