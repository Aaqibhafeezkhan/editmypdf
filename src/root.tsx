import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, useParams } from "react-router";
import { BASE_PATH } from "./data/product.ts";
import { attachRouter } from "./router.ts";
import { LogoMark } from "./site/Logo.tsx";
import { siteRoutes } from "./site/routes.tsx";

// The editor and its PDF libraries load only when a document route is opened.
const Editor = lazy(() => import("./App.tsx").then((module) => ({ default: module.Editor })));
const AppHome = lazy(() => import("./AppHome.tsx").then((module) => ({ default: module.AppHome })));

function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <LogoMark size={36} />
      <span>Opening…</span>
    </div>
  );
}

function EditorRoute() {
  const { id = "" } = useParams();
  const sessionId = decodeURIComponent(id);
  return (
    <div key={sessionId} className="page-transition app-route">
      <Suspense fallback={<Loading />}>
        <Editor key={sessionId} sessionId={sessionId} />
      </Suspense>
    </div>
  );
}

const router = createBrowserRouter([
  ...siteRoutes,
  {
    path: "/app",
    element: (
      <div className="page-transition app-route">
        <Suspense fallback={<Loading />}>
          <AppHome />
        </Suspense>
      </div>
    ),
  },
  { path: "/edit/:id", Component: EditorRoute },
], { basename: BASE_PATH });

attachRouter(router);

export function Root() {
  return <RouterProvider router={router} />;
}
