import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, useParams } from "react-router";
import { attachRouter } from "./router.ts";
import { LogoMark } from "./site/Logo.tsx";
import { SiteLayout } from "./site/SiteLayout.tsx";
import { Landing } from "./site/Landing.tsx";
import { Blog } from "./site/Blog.tsx";
import { BlogPost } from "./site/BlogPost.tsx";
import { Compare } from "./site/Compare.tsx";
import { ComparePage } from "./site/ComparePage.tsx";
import { HowItWorks } from "./site/HowItWorks.tsx";
import { Privacy } from "./site/Privacy.tsx";
import { Faq } from "./site/Faq.tsx";
import { NotFound } from "./site/NotFound.tsx";

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
    <Suspense fallback={<Loading />}>
      <Editor key={sessionId} sessionId={sessionId} />
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    Component: SiteLayout,
    children: [
      { index: true, Component: Landing },
      { path: "blog", Component: Blog },
      { path: "blog/:slug", Component: BlogPost },
      { path: "compare", Component: Compare },
      { path: "compare/:slug", Component: ComparePage },
      { path: "how-it-works", Component: HowItWorks },
      { path: "privacy", Component: Privacy },
      { path: "faq", Component: Faq },
      { path: "*", Component: NotFound },
    ],
  },
  {
    path: "/app",
    element: (
      <Suspense fallback={<Loading />}>
        <AppHome />
      </Suspense>
    ),
  },
  { path: "/edit/:id", Component: EditorRoute },
]);

attachRouter(router);

export function Root() {
  return <RouterProvider router={router} />;
}
