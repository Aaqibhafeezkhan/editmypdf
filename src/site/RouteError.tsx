import { isRouteErrorResponse, useRouteError } from "react-router";
import { PRODUCT, routeHref } from "../data/product.ts";
import { reloadPending } from "../reload.ts";
import { LogoMark } from "./Logo.tsx";

// The screen shown while a lazy route loads.
export function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <LogoMark size={36} />
      <span>Opening…</span>
    </div>
  );
}

// What a route shows when it throws. While the page is reloading itself after a deploy replaced
// its chunks (reload.ts), the failed import is expected and the loading screen stays up; any other
// error gets a plain page with a reload button instead of the router's default dump.
export function RouteError() {
  const error = useRouteError();
  if (reloadPending()) return <Loading />;
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`.trim()
    : error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return (
    <div className="app-error" role="alert">
      <LogoMark size={36} />
      <h1>Something went wrong</h1>
      <p>
        This page could not be shown. Reloading usually fixes it. If it keeps happening, please{" "}
        <a href={`${PRODUCT.repository}/issues`} rel="noopener noreferrer" target="_blank">
          report it
        </a>{" "}
        with the line below.
      </p>
      {detail && <pre>{detail}</pre>}
      <p className="app-error-actions">
        <button type="button" onClick={() => location.reload()}>
          Reload
        </button>
        <a href={routeHref("/")}>Back to the start</a>
      </p>
    </div>
  );
}
