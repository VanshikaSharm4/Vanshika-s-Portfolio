const { readdirSync, readFileSync, statSync, writeFileSync } = require("fs");
const { join, extname } = require("path");

const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
if (base && !/^\/[a-zA-Z0-9._/-]+$/.test(base)) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be a root-relative URL path.");
}
const prefix = (url) =>
  url.startsWith("/") &&
  !url.startsWith("//") &&
  url !== base &&
  !url.startsWith(base + "/")
    ? base + url
    : url;
const rewriteCss = (text) =>
  text.replace(
    /url\(\s*(["']?)(\/(?!\/)[^"')]+)\1\s*\)/g,
    (_, quote, url) => "url(" + quote + prefix(url) + quote + ")"
  );

const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!base) continue;
    if (extname(path) === ".css") {
      writeFileSync(path, rewriteCss(readFileSync(path, "utf8")));
    } else if (extname(path) === ".html") {
      let html = readFileSync(path, "utf8");
      html = html.replace(
        /\b(src|href|poster|data)=("([^"]*)"|'([^']*)')/gi,
        (_, name, quoted, doubleValue, singleValue) => {
          const quote = quoted[0];
          return (
            name + "=" + quote + prefix(doubleValue ?? singleValue) + quote
          );
        }
      );
      html = html.replace(
        /\b(srcset|imagesrcset)="([^"]*)"/gi,
        (_, name, values) =>
          name +
          '="' +
          values.replace(
            /(^|,\s*)(\/(?!\/)[^\s,]+)/g,
            (match, separator, url) => separator + prefix(url)
          ) +
          '"'
      );
      html = rewriteCss(html);
      const bootstrap =
        '<script src="' +
        base +
        '/asset-base.js" data-base="' +
        base +
        '"></script>';
      html = html.replace(/<head(?:\s[^>]*)?>/i, (head) => head + bootstrap);
      writeFileSync(path, html);
    }
  }
};
walk("out");
writeFileSync("out/.nojekyll", "");
console.log("Static export prepared for " + (base || "/") + ".");
