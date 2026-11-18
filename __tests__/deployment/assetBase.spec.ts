import { readFileSync } from "fs";
import { join } from "path";

const source = readFileSync(
  join(process.cwd(), "public/asset-base.js"),
  "utf8"
);
const base = "/Vanshika-s-Portfolio";
const createPage = (
  mount = base
): {
  originalFetch: jest.Mock<Promise<unknown>, [RequestInfo | URL, RequestInit?]>;
  page: { window: { close: () => void } };
  window: Window & typeof globalThis;
  xhrOpen: jest.SpyInstance;
} => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const window = frame.contentWindow as Window & typeof globalThis;
  const page = { window: { close: () => frame.remove() } };
  const script = window.document.createElement("script");
  script.dataset.base = mount;
  Object.defineProperty(window.document, "currentScript", { value: script });
  const originalFetch = jest
    .fn<Promise<unknown>, [RequestInfo | URL, RequestInit?]>()
    .mockResolvedValue("ok");
  Object.defineProperty(window, "fetch", {
    configurable: true,
    value: originalFetch,
    writable: true,
  });
  Object.defineProperty(window, "Request", {
    value: class Request {
      public url = "";
    },
  });
  const xhrOpen = jest
    .spyOn(window.XMLHttpRequest.prototype, "open")
    .mockImplementation(() => {
      // Record the request without starting a network connection.
    });
  window.eval(source);
  return { originalFetch, page, window, xhrOpen };
};

describe("static host asset mounting", () => {
  it("rebases DOM properties and attributes without changing external or relative URLs", () => {
    const { page, window } = createPage();
    const image = window.document.createElement("img");
    image.src = "/System/Icons/48x48/folder.webp";
    expect(image.getAttribute("src")).toBe(
      `${base}/System/Icons/48x48/folder.webp`
    );
    image.setAttribute("src", `${base}/internships/assets/octopus.png`);
    expect(image.getAttribute("src")).toBe(
      `${base}/internships/assets/octopus.png`
    );
    image.src = "https://external.test/image.png";
    expect(image.src).toBe("https://external.test/image.png");
    image.src = "assets/image.png";
    expect(image.getAttribute("src")).toBe("assets/image.png");
    image.srcset = "/System/a.webp 1x, /System/b.webp 2x";
    expect(image.srcset).toBe(
      `${base}/System/a.webp 1x, ${base}/System/b.webp 2x`
    );
    page.window.close();
  });

  it("keeps BrowserFS fetch and XHR requests inside the mount", async () => {
    const { originalFetch, page, window, xhrOpen } = createPage();
    await window.fetch("/Users/Public/Desktop/My%20PC.url");
    expect(originalFetch).toHaveBeenLastCalledWith(
      `${base}/Users/Public/Desktop/My%20PC.url`,
      undefined
    );
    await window.fetch("https://external.test/api");
    expect(originalFetch).toHaveBeenLastCalledWith(
      "https://external.test/api",
      undefined
    );
    const xhr = new window.XMLHttpRequest();
    xhr.open("GET", "/CREDITS.md", true);
    expect(xhrOpen).toHaveBeenCalledWith("GET", `${base}/CREDITS.md`, true);
    page.window.close();
  });

  it("rebases stylesheet and inline background URLs exactly once", () => {
    const { page, window } = createPage();
    const style = window.document.createElement("style");
    window.document.head.append(style);
    const { sheet } = style;
    if (!sheet) throw new Error("Test stylesheet was not created.");
    sheet.insertRule(
      '.preview { background: url("/System/background.png") }',
      0
    );
    expect(sheet.cssRules[0].cssText).toContain(
      `${base}/System/background.png`
    );
    const element = window.document.createElement("div");
    element.style.backgroundImage = 'url("/System/background.png")';
    expect(element.style.backgroundImage).toContain(
      `${base}/System/background.png`
    );
    element.style.backgroundImage = `url("${base}/System/background.png")`;
    expect(element.style.backgroundImage).not.toContain(base + base);
    page.window.close();
  });

  it("leaves root-hosted Vercel pages untouched", () => {
    const { originalFetch, page, window } = createPage("");
    expect(window.fetch).toBe(originalFetch);
    const image = window.document.createElement("img");
    image.src = "/System/image.png";
    expect(image.getAttribute("src")).toBe("/System/image.png");
    page.window.close();
  });
});
