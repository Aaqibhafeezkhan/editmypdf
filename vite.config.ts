import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { COMPETITORS } from "./src/data/competitors.ts";
import { POSTS } from "./src/data/posts.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

// Every public route of the site, for the sitemap. Editor documents (/edit/<id>) exist only in
// one browser and are left out.
function routes(): { path: string; lastmod?: string }[] {
  return [
    { path: "/" },
    { path: "/app" },
    { path: "/how-it-works" },
    { path: "/privacy" },
    { path: "/faq" },
    { path: "/blog" },
    ...POSTS.map((post) => ({ path: `/blog/${post.slug}`, lastmod: post.date })),
    { path: "/compare" },
    ...COMPETITORS.map((tool) => ({ path: `/compare/${tool.slug}` })),
  ];
}

// Serves /sitemap.xml in development and writes it into the build. Set VITE_SITE_URL to the
// site's origin so the entries are absolute; without it they are root-relative.
function sitemap(origin: string): Plugin {
  const xml = () =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes()
      .map(
        (route) =>
          `  <url><loc>${origin}${route.path}</loc>${route.lastmod ? `<lastmod>${route.lastmod}</lastmod>` : ""}</url>`,
      )
      .join("\n")}\n</urlset>\n`;
  return {
    name: "sitemap",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/sitemap.xml") {
          next();
          return;
        }
        response.setHeader("Content-Type", "application/xml");
        response.end(xml());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml() });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "VITE_");
  const origin = (env.VITE_SITE_URL ?? "").replace(/\/$/, "");
  return {
    plugins: [react(), tailwindcss(), sitemap(origin)],
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
      },
    },
  };
});
