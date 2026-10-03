import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTES, SITE_URL } from "./seo.config";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * After the build, write one HTML file per page with its own title, description, social tags and
 * readable intro text (search engines and link previews see real content), plus sitemap.xml and
 * robots.txt. The React app still takes over as normal once it loads.
 */
function seoPages(): Plugin {
  return {
    name: "data-lab-seo-pages",
    apply: "build",
    closeBundle() {
      const dist = join(process.cwd(), "dist");
      const base = readFileSync(join(dist, "index.html"), "utf8");
      const nav = ROUTES.filter((r) => r.path !== "/")
        .map((r) => `<a href="${r.path}">${esc(r.heading.split(" · ")[0])}</a>`)
        .join(" · ");
      const jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Data Lab · ডেটা ল্যাব",
        url: SITE_URL,
        inLanguage: ["en", "bn"],
        description: ROUTES[0].description,
        creator: { "@type": "Person", name: "Atiqul Islam Chowdhury", url: "https://aichowdhury14.github.io/", jobTitle: "AI & ML Engineer · Senior Data Scientist" },
        isAccessibleForFree: true,
      });
      for (const r of ROUTES) {
        const url = SITE_URL + (r.path === "/" ? "/" : r.path);
        let html = base
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(r.title)}</title>`)
          .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(r.description)}" />`)
          .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(r.title)}" />`)
          .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(r.description)}" />`)
          .replace(
            "</head>",
            `    <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n    <meta property="og:site_name" content="Data Lab" />\n    ${r.path === "/" ? `<script type="application/ld+json">${jsonLd}</script>\n  ` : ""}</head>`,
          );
        // readable content inside the loading shell (replaced by the app a moment later)
        html = html.replace(
          /<div class="boot-hero">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
          `<div class="boot-hero"><h1 class="boot-h1">${esc(r.heading)}</h1><p class="boot-p">${esc(r.intro)}</p><div class="boot-line" style="width: 55%"></div><nav class="boot-nav">${nav}</nav></div>\n      </div>\n    </div>`,
        );
        // /sql is served from sql.html (Vercel cleanUrls; Vite preview does the same)
        writeFileSync(join(dist, r.path === "/" ? "index.html" : `${r.path.slice(1)}.html`), html);
      }
      const today = new Date().toISOString().slice(0, 10);
      writeFileSync(
        join(dist, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ROUTES.map((r) => `  <url><loc>${SITE_URL}${r.path === "/" ? "/" : r.path}</loc><lastmod>${today}</lastmod><priority>${r.path === "/" ? "1.0" : "0.8"}</priority></url>`).join("\n")}\n</urlset>\n`,
      );
      writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
    },
  };
}

export default defineConfig({ plugins: [react(), seoPages()] });
