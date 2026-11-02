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
    { path: "/pricing" },
    { path: "/privacy" },
    { path: "/faq" },
    { path: "/blog" },
    ...POSTS.map((post) => ({ path: `/blog/${post.slug}`, lastmod: post.date })),
    { path: "/compare" },
    ...COMPETITORS.map((tool) => ({ path: `/compare/${tool.slug}` })),
  ];
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// An RSS feed of the blog, for readers and for crawlers that follow it.
function feed(origin: string): string {
  const items = POSTS.map(
    (post) =>
      `  <item>\n    <title>${escapeXml(post.title)}</title>\n    <link>${origin}/blog/${post.slug}</link>\n    <guid isPermaLink="true">${origin}/blog/${post.slug}</guid>\n    <pubDate>${new Date(`${post.date}T09:00:00Z`).toUTCString()}</pubDate>\n    <description>${escapeXml(post.description)}</description>\n  </item>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>Stet blog</title>\n  <link>${origin}/blog</link>\n  <description>Engineering notes on editing PDF text in the browser.</description>\n  <language>en</language>\n${items.join("\n")}\n</channel>\n</rss>\n`;
}

// Serves /sitemap.xml and /feed.xml in development and writes them into the build. Set
// VITE_SITE_URL to the site's origin so the entries are absolute; without it they are root-relative.
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
        if (request.url === "/sitemap.xml") {
          response.setHeader("Content-Type", "application/xml");
          response.end(xml());
          return;
        }
        if (request.url === "/feed.xml") {
          response.setHeader("Content-Type", "application/rss+xml");
          response.end(feed(origin));
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml() });
      this.emitFile({ type: "asset", fileName: "feed.xml", source: feed(origin) });
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
