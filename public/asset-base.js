/* Resolve network asset URLs beneath the static host's mount path.
 * Virtual desktop file paths remain unchanged in application state.
 * This also runs in embedded app documents, before their own scripts.
 */
(() => {
  const base = document.currentScript?.dataset.base || "";
  if (!base || window.__portfolioAssetBase === base) return;
  window.__portfolioAssetBase = base;

  const resolve = (value) => {
    if (typeof value !== "string") return value;
    if (value.startsWith("/") && !value.startsWith("//")) {
      return value === base || value.startsWith(base + "/")
        ? value
        : base + value;
    }
    if (value.startsWith(location.origin + "/")) {
      const url = new URL(value);
      return location.origin + resolve(url.pathname + url.search + url.hash);
    }
    return value;
  };
  const css = (value) =>
    typeof value === "string"
      ? value.replace(/url\(\s*(["']?)(\/(?!\/)[^"')]+)\1\s*\)/g,
          (_, quote, url) => "url(" + quote + resolve(url) + quote + ")")
      : value;
  const sourceSet = (value) =>
    value.replace(/(^|,\s*)(\/(?!\/))/g, (_, prefix) => prefix + base + "/")
      .replaceAll(base + base + "/", base + "/");
  const attributeValue = (name, value) =>
    name === "style" ? css(value)
      : name === "srcset" || name === "imagesrcset" ? sourceSet(value)
      : resolve(value);

  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = (input, options) => {
      const mapped = input instanceof Request
        ? new Request(resolve(input.url), input)
        : input instanceof URL ? resolve(input.href) : resolve(input);
      return originalFetch.call(window, mapped, options);
    };
  }
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...options) {
    return Reflect.apply(open, this, [method, resolve(String(url)), ...options]);
  };

  const setAttribute = Element.prototype.setAttribute;
  const urlAttributes = new Set(["src", "href", "poster", "data", "srcset", "imagesrcset", "style"]);
  Element.prototype.setAttribute = function (name, value) {
    const key = name.toLowerCase();
    return setAttribute.call(this, name,
      urlAttributes.has(key) ? attributeValue(key, String(value)) : value);
  };

  const patchProperty = (prototype, property, transform) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor?.set || !descriptor.configurable) return;
    Object.defineProperty(prototype, property, {
      ...descriptor,
      set(value) { descriptor.set.call(this, transform(value)); },
    });
  };
  [
    [HTMLImageElement.prototype, "src"],
    [HTMLScriptElement.prototype, "src"],
    [HTMLLinkElement.prototype, "href"],
    [HTMLIFrameElement.prototype, "src"],
    [HTMLMediaElement.prototype, "src"],
    [HTMLVideoElement.prototype, "poster"],
    [HTMLSourceElement.prototype, "src"],
    [HTMLObjectElement.prototype, "data"],
  ].forEach(([prototype, property]) => patchProperty(prototype, property, resolve));
  patchProperty(HTMLImageElement.prototype, "srcset", sourceSet);
  patchProperty(HTMLSourceElement.prototype, "srcset", sourceSet);
  patchProperty(HTMLLinkElement.prototype, "imageSrcset", sourceSet);

  const insertRule = CSSStyleSheet.prototype.insertRule;
  CSSStyleSheet.prototype.insertRule = function (rule, ...options) {
    return Reflect.apply(insertRule, this, [css(rule), ...options]);
  };
  const setProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (name, value, priority) {
    return setProperty.call(this, name, css(value), priority);
  };
  ["cssText", "background", "backgroundImage", "cursor", "maskImage", "listStyleImage"]
    .forEach((property) => patchProperty(CSSStyleDeclaration.prototype, property, css));

  if (window.Worker) {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(resolve(url instanceof URL ? url.href : url), options);
      }
    };
  }
})();
