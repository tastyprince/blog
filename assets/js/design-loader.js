/* =============================================================
   把 window.DESIGN 应用到页面上
   - 颜色 / 字体 / 字号行高 / 默认背景装饰
   - 自定义背景（图片、GIF、视频）
   - 文案覆盖
   - 在 ?preview=1 模式下接收「外观设置」发来的实时预览消息
   ============================================================= */

(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var Color = window.DesignColor;
  var PRESETS = (window.DESIGN_PRESETS || {});
  var isPreview = false;

  try {
    isPreview = new URLSearchParams(location.search).has("preview");
  } catch (e) {}

  var FALLBACKS = ["paper", "plain", "geo", "none"];

  var DEFAULTS = {
    preset: "terracotta",
    accent: "#a8573c",
    font: "serif",
    fontSize: 16,
    lineHeight: 2.05,
    fallback: "paper",
    bgHome: { type: "none", src: "", overlay: 0.35, blur: 0 },
    bgPost: { type: "none", src: "", overlay: 0.3, blur: 0 },
    text: {}
  };

  function clamp(value, min, max, fallback) {
    var n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function normBg(cfg) {
    cfg = cfg || {};
    var type = cfg.type === "image" || cfg.type === "video" ? cfg.type : "none";
    var src = typeof cfg.src === "string" ? cfg.src.trim() : "";
    if (!src) type = "none";
    return {
      type: type,
      src: src,
      overlay: clamp(cfg.overlay, 0, 0.9, 0.35),
      blur: clamp(cfg.blur, 0, 20, 0)
    };
  }

  function normalize(input) {
    var s = input || {};
    var text = s.text || {};
    return {
      version: 1,
      preset: PRESETS[s.preset] ? s.preset : DEFAULTS.preset,
      accent: /^#[0-9a-fA-F]{6}$/.test(String(s.accent || "")) ? s.accent : "",
      font: Color.FONTS[s.font] ? s.font : DEFAULTS.font,
      fontSize: clamp(s.fontSize, 14, 20, DEFAULTS.fontSize),
      lineHeight: clamp(s.lineHeight, 1.5, 2.4, DEFAULTS.lineHeight),
      fallback: FALLBACKS.indexOf(s.fallback) >= 0 ? s.fallback : DEFAULTS.fallback,
      bgHome: normBg(s.bgHome),
      bgPost: normBg(s.bgPost),
      socials: Array.isArray(s.socials)
        ? s.socials
            .filter(function (item) {
              return item && (item.label || item.href);
            })
            .map(function (item) {
              return { label: String(item.label || ""), href: String(item.href || "") };
            })
            .slice(0, 8)
        : null,
      text: {
        siteTitle: String(text.siteTitle || ""),
        tagline: String(text.tagline || ""),
        heroTitle: String(text.heroTitle || ""),
        heroIntro: String(text.heroIntro || ""),
        aboutIntro: String(text.aboutIntro || ""),
        navHome: String(text.navHome || ""),
        navAbout: String(text.navAbout || ""),
        footerNote: String(text.footerNote || "")
      }
    };
  }

  var settings = normalize(window.DESIGN || DEFAULTS);

  /* ---------- 颜色与字体 ---------- */
  var styleEl = null;

  function cssVars(palette) {
    return (
      "--bg:" +
      palette.bg +
      ";--bg-deep:" +
      palette.bgDeep +
      ";--paper:" +
      palette.paper +
      ";--paper-2:" +
      palette.paper2 +
      ";--ink:" +
      palette.ink +
      ";--ink-soft:" +
      palette.inkSoft +
      ";--muted:" +
      palette.muted +
      ";--line:" +
      palette.line +
      ";--line-strong:" +
      palette.lineStrong +
      ";--accent:" +
      palette.accent +
      ";--accent-deep:" +
      palette.accentDeep +
      ";--accent-soft:" +
      palette.accentSoft +
      ";--accent-wash:" +
      palette.accentWash +
      ";"
    );
  }

  function applyTheme(s) {
    var palette = Color.palette(s.preset, s.accent);
    var font = Color.FONTS[s.font] || Color.FONTS.serif;
    var css =
      ":root{" +
      cssVars(palette.light) +
      "--serif:" +
      font +
      ";--design-read-size:" +
      s.fontSize +
      "px;--read-lh:" +
      s.lineHeight +
      ";}\n" +
      '[data-theme="dark"]{' +
      cssVars(palette.dark) +
      "}";

    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = "design-style";
      (doc.head || doc.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = css + previewCSS();
    root.setAttribute("data-fallback", s.fallback);
  }

  /* 预览里关掉过渡，改色能立刻看到 */
  function previewCSS() {
    if (!isPreview) return "";
    return (
      'html[data-design-preview="1"] *,html[data-design-preview="1"] *::before,' +
      'html[data-design-preview="1"] *::after{transition-duration:0s !important;animation-duration:0s !important}'
    );
  }

  /* ---------- 文案 ---------- */
  function escHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function heroHtml(value) {
    return escHtml(value).replace(/\{([^{}]+)\}/g, "<em>$1</em>");
  }

  function setText(selector, value, asHtml) {
    var nodes = doc.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.__designDefault === undefined) node.__designDefault = node.innerHTML;
      if (value) {
        if (asHtml) {
          node.innerHTML = heroHtml(value);
        } else {
          node.textContent = value;
        }
      } else if (node.__designDefault !== undefined) {
        node.innerHTML = node.__designDefault;
      }
    }
  }

  function applyText(s) {
    var text = s.text || {};
    setText('[data-design-text="siteTitle"]', text.siteTitle);
    setText('[data-design-text="tagline"]', text.tagline);
    setText('[data-design-text="heroIntro"]', text.heroIntro);
    setText('[data-design-text="aboutIntro"]', text.aboutIntro);
    setText('[data-design-text="navHome"]', text.navHome);
    setText('[data-design-text="navAbout"]', text.navAbout);
    setText('[data-design-text="footerNote"]', text.footerNote);
    setText('[data-design-text="heroTitle"]', text.heroTitle, true);
  }

  /* ---------- 找到我（社交链接） ---------- */
  function applySocials(list) {
    var box = doc.querySelector("[data-socials]");
    if (!box) return;

    if (box.__designSocialsDefault === undefined) {
      box.__designSocialsDefault = box.innerHTML;
    }

    /* 没设置过就沿用 data.js 里的链接 */
    if (!Array.isArray(list)) {
      box.innerHTML = box.__designSocialsDefault;
      return;
    }

    box.innerHTML = list
      .map(function (item) {
        var href = String(item.href || "#");
        var external = /^https?:\/\//i.test(href);
        return (
          '<a class="about__link" href="' +
          escHtml(href) +
          '"' +
          (external ? ' target="_blank" rel="noopener noreferrer"' : "") +
          ">" +
          escHtml(item.label) +
          "</a>"
        );
      })
      .join("");
  }

  /* ---------- 背景 ---------- */
  var backgroundOverride = null;

  function backgroundFor(s) {
    if (backgroundOverride) return backgroundOverride;
    if (!doc.body) return null;
    var page = doc.body.getAttribute("data-page");
    if (page === "home") return s.bgHome;
    if (page === "post") return s.bgPost;
    return null;
  }

  /* 单篇文章自己的背景，覆盖「外观设置」里的文章页背景 */
  function setPostBackground(src) {
    var base = settings.bgPost || {};
    if (src) {
      backgroundOverride = {
        type: "image",
        src: String(src),
        overlay: base.overlay == null ? 0.35 : base.overlay,
        blur: base.blur == null ? 0 : base.blur
      };
    } else {
      backgroundOverride = null;
    }
    applyBackground(settings);
  }

  function applyBackground(s) {
    if (!doc.body) return;

    var cfg = backgroundFor(s);
    var box = doc.getElementById("design-bg");
    var hasMedia = Boolean(cfg && cfg.type !== "none" && cfg.src);

    root.setAttribute("data-has-media", hasMedia ? "1" : "0");

    if (!hasMedia) {
      if (box && box.parentNode) box.parentNode.removeChild(box);
      return;
    }

    var signature = cfg.type + "|" + cfg.src + "|" + cfg.blur + "|" + cfg.overlay;
    if (box && box.getAttribute("data-signature") === signature) return;

    if (!box) {
      box = doc.createElement("div");
      box.id = "design-bg";
      box.setAttribute("aria-hidden", "true");
      doc.body.insertBefore(box, doc.body.firstChild);
    }
    box.setAttribute("data-signature", signature);
    box.innerHTML = "";

    var media;
    if (cfg.type === "video") {
      media = doc.createElement("video");
      media.src = cfg.src;
      media.autoplay = true;
      media.muted = true;
      media.loop = true;
      media.setAttribute("playsinline", "");
      media.setAttribute("muted", "");
    } else {
      media = doc.createElement("img");
      media.src = cfg.src;
      media.alt = "";
    }
    media.className = "design-bg__media";
    if (cfg.blur > 0) {
      media.style.filter = "blur(" + cfg.blur + "px)";
      media.style.transform = "scale(" + (1 + Math.min(cfg.blur, 20) / 150) + ")";
    }
    box.appendChild(media);

    var overlay = doc.createElement("div");
    overlay.className = "design-bg__overlay";
    overlay.style.opacity = String(cfg.overlay);
    box.appendChild(overlay);
  }

  /* ---------- 应用 ---------- */
  function applyAll(next) {
    settings = normalize(next);
    applyTheme(settings);
    if (doc.body) {
      applyText(settings);
      applySocials(settings.socials);
      applyBackground(settings);
    }
  }

  /* ---------- 预览模式 ---------- */
  if (isPreview) {
    root.setAttribute("data-design-preview", "1");
    try {
      var cached = localStorage.getItem("wz-design-live");
      if (cached) settings = normalize(JSON.parse(cached));
    } catch (e) {}

    window.addEventListener("message", function (event) {
      var data = event.data;
      if (!data || data.source !== "design-studio") return;
      if (data.settings) applyAll(data.settings);
      if (data.theme) {
        root.setAttribute("data-theme", data.theme === "dark" ? "dark" : "light");
      }
    });
  }

  applyTheme(settings);

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", function () {
      applyAll(settings);
    });
  } else {
    applyAll(settings);
  }

  window.DesignLoader = {
    apply: applyAll,
    normalize: normalize,
    setPostBackground: setPostBackground,
    get settings() {
      return settings;
    }
  };
})();
