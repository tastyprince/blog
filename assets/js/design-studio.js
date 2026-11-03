/* =============================================================
   外观设置逻辑
   - 读取 design.js（window.DESIGN）作为起点
   - 实时改颜色 / 字体 / 字号 / 背景 / 文案
   - 右侧 iframe 加载真实首页、文章页做实时预览
   - 保存：直接写入 assets/js/design.js（不支持时自动降级为下载）
   ============================================================= */

(function () {
  "use strict";

  var BLOG = window.BLOG || { posts: [] };
  var PRESETS = window.DESIGN_PRESETS || {};
  var Color = window.DesignColor;
  var Loader = window.DesignLoader;

  if (!Color || !Loader || !window.DESIGN) {
    document.body.innerHTML =
      '<p style="padding:3rem;text-align:center;font-family:sans-serif">外观模块没有载入成功，请确认 assets/js/design*.js 存在。</p>';
    return;
  }

  var DRAFT_KEY = "wz-design-draft-v1";
  var LIVE_KEY = "wz-design-live";

  var DEFAULTS = {
    preset: "terracotta",
    accent: "#a8573c",
    font: "serif",
    fontSize: 16,
    lineHeight: 2.05,
    fallback: "paper",
    bgHome: { type: "none", src: "", overlay: 0.35, blur: 0 },
    bgPost: { type: "none", src: "", overlay: 0.3, blur: 0 },
    text: {
      siteTitle: "",
      tagline: "",
      heroTitle: "",
      heroIntro: "",
      aboutIntro: "",
      navHome: "",
      navAbout: "",
      footerNote: ""
    }
  };

  var normalize = Loader.normalize;

  function cloneSocials(list) {
    return (Array.isArray(list) ? list : [])
      .map(function (item) {
        return { label: String(item.label || ""), href: String(item.href || "") };
      })
      .slice(0, 8);
  }

  /* 没有单独设置过就用 data.js 里的社交链接作为起点 */
  function withSocials(input) {
    var next = normalize(input);
    if (!Array.isArray(next.socials)) {
      next.socials = cloneSocials((BLOG.site || {}).socials || []);
    }
    return next;
  }

  var state = withSocials(window.DESIGN || DEFAULTS);
  var preview = {
    page: "home",
    device: "desktop",
    theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  };
  var dirty = false;
  var statusOverride = "";
  var fileHandle = null;
  var quotaWarned = false;
  var previewTimer = null;
  var draftTimer = null;
  var toastTimer = null;

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  var els = {
    presets: $("[data-presets]"),
    accentColor: $("[data-accent-color]"),
    accentText: $("[data-accent-text]"),
    accentReset: $("[data-accent-reset]"),
    font: $("[data-font]"),
    size: $("[data-size]"),
    sizeOut: $("[data-size-out]"),
    lh: $("[data-lh]"),
    lhOut: $("[data-lh-out]"),
    fallback: $("[data-fallback]"),
    bgType: { home: $('[data-bg-type="home"]'), post: $('[data-bg-type="post"]') },
    bgPick: { home: $('[data-bg-pick="home"]'), post: $('[data-bg-pick="post"]') },
    bgFile: { home: $('[data-bg-file="home"]'), post: $('[data-bg-file="post"]') },
    bgThumb: { home: $('[data-bg-thumb="home"]'), post: $('[data-bg-thumb="post"]') },
    bgNote: { home: $('[data-bg-note="home"]'), post: $('[data-bg-note="post"]') },
    bgPath: { home: $('[data-bg-path="home"]'), post: $('[data-bg-path="post"]') },
    bgPathWrap: { home: $('[data-bg-path-wrap="home"]'), post: $('[data-bg-path-wrap="post"]') },
    bgOverlay: { home: $('[data-bg-overlay="home"]'), post: $('[data-bg-overlay="post"]') },
    bgOverlayOut: {
      home: $('[data-bg-overlay-out="home"]'),
      post: $('[data-bg-overlay-out="post"]')
    },
    bgBlur: { home: $('[data-bg-blur="home"]'), post: $('[data-bg-blur="post"]') },
    bgBlurOut: { home: $('[data-bg-blur-out="home"]'), post: $('[data-bg-blur-out="post"]') },
    bgRemove: { home: $('[data-bg-remove="home"]'), post: $('[data-bg-remove="post"]') },
    text: $all("[data-text]"),
    socialsList: $("[data-socials-list]"),
    socialAdd: $("[data-social-add]"),
    previewPage: $("[data-preview-page]"),
    previewDevice: $("[data-preview-device]"),
    previewTheme: $("[data-preview-theme]"),
    stage: $("[data-stage]"),
    scaler: $("[data-scaler]"),
    frame: $("[data-frame]"),
    save: $("[data-save]"),
    discard: $("[data-discard]"),
    reset: $("[data-reset]"),
    statusDot: $("[data-status-dot]"),
    statusText: $("[data-status-text]"),
    banner: $("[data-banner]"),
    bannerText: $("[data-banner-text]"),
    bannerClose: $("[data-banner-close]"),
    bannerDiscard: $("[data-banner-discard]"),
    toast: $("[data-toast]"),
    saveHint: $("[data-save-hint]")
  };

  /* ---------- 基础工具 ---------- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bgOf(kind) {
    return kind === "post" ? state.bgPost : state.bgHome;
  }

  function presetAccent() {
    return (PRESETS[state.preset] || {}).accent || DEFAULTS.accent;
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    } catch (e) {
      return "";
    }
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    requestAnimationFrame(function () {
      els.toast.classList.add("is-show");
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("is-show");
      setTimeout(function () {
        els.toast.hidden = true;
      }, 260);
    }, 3200);
  }

  /* ---------- 状态 ---------- */
  function updateStatus() {
    els.statusDot.classList.toggle("is-dirty", dirty);
    els.statusText.textContent = dirty
      ? "有未保存的修改"
      : statusOverride || "已载入 design.js";
    els.discard.hidden = !dirty;
  }

  function scheduleSync(options) {
    dirty = true;
    statusOverride = "";
    updateStatus();
    if (options && options.controls) fillControls();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(postPreview, 100);
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 800);
  }

  /* ---------- 草稿 ---------- */
  function readDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.settings) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ settings: state, savedAt: Date.now() }));
    } catch (e) {
      if (!quotaWarned) {
        quotaWarned = true;
        toast("背景图太大，草稿无法自动暂存；请及时点「保存 design.js」");
      }
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  /* ---------- 渲染控件 ---------- */
  function buildPresets() {
    els.presets.innerHTML = Object.keys(PRESETS)
      .map(function (key) {
        var p = PRESETS[key];
        return (
          '<button class="preset" type="button" data-preset="' +
          key +
          '" aria-pressed="false">' +
          '<span class="preset__swatches">' +
          '<i style="background:' +
          p.light.bg +
          '"></i><i style="background:' +
          p.light.paper +
          '"></i><i style="background:' +
          p.light.ink +
          '"></i><i style="background:' +
          p.accent +
          '"></i>' +
          "</span>" +
          '<span class="preset__name">' +
          esc(p.label) +
          "</span>" +
          '<span class="preset__hint">' +
          esc(p.hint) +
          "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function pressAll(container, attr, value) {
    if (!container) return;
    Array.prototype.forEach.call(container.querySelectorAll("[" + attr + "]"), function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute(attr) === value));
    });
  }

  function setPressed(container, selector, value) {
    if (!container) return;
    Array.prototype.forEach.call(container.querySelectorAll(selector), function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-value") === value));
    });
  }

  function renderThumb(kind) {
    var cfg = bgOf(kind);
    var box = els.bgThumb[kind];
    box.innerHTML = "";
    if (cfg.type === "image" && cfg.src) {
      var img = document.createElement("img");
      img.src = cfg.src;
      img.alt = "";
      box.appendChild(img);
    } else if (cfg.type === "video" && cfg.src) {
      var video = document.createElement("video");
      video.src = cfg.src;
      video.muted = true;
      video.setAttribute("preload", "metadata");
      video.setAttribute("playsinline", "");
      box.appendChild(video);
    } else {
      var span = document.createElement("span");
      span.textContent = cfg.src ? "未选择类型" : "未设置";
      box.appendChild(span);
    }
  }

  function updateBgNote(kind) {
    var cfg = bgOf(kind);
    var note = els.bgNote[kind];
    if (!cfg.src) {
      note.textContent = "图片自动压缩；GIF 保留动画";
      return;
    }
    if (cfg.type === "video") {
      note.textContent = "路径：" + cfg.src + "（请确认文件在项目里）";
    } else if (cfg.src.indexOf("data:image/gif") === 0) {
      note.textContent = "GIF 已内嵌 · 约 " + Math.round((cfg.src.length * 0.75) / 1024) + " KB";
    } else {
      note.textContent = "已内嵌 · 约 " + Math.round((cfg.src.length * 0.75) / 1024) + " KB";
    }
  }

  function refreshBgUi(kind) {
    var cfg = bgOf(kind);
    els.bgPathWrap[kind].hidden = cfg.type !== "video";
    els.bgRemove[kind].hidden = !cfg.src;
    updateBgNote(kind);
    renderThumb(kind);
  }

  function fillControls() {
    $all("[data-preset]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-preset") === state.preset));
    });

    var accent = state.accent || presetAccent();
    if (els.accentColor) els.accentColor.value = accent;
    if (els.accentText && document.activeElement !== els.accentText) {
      els.accentText.value = accent.toUpperCase();
    }

    setPressed(els.font, "[data-value]", state.font);
    els.size.value = state.fontSize;
    els.sizeOut.textContent = state.fontSize + "px";
    els.lh.value = state.lineHeight;
    els.lhOut.textContent = Number(state.lineHeight).toFixed(2);

    setPressed(els.fallback, "[data-value]", state.fallback);

    ["home", "post"].forEach(function (kind) {
      var cfg = bgOf(kind);
      setPressed(els.bgType[kind], "[data-value]", cfg.type);
      if (document.activeElement !== els.bgPath[kind]) {
        els.bgPath[kind].value = cfg.type === "video" ? cfg.src : "";
      }
      els.bgPathWrap[kind].hidden = cfg.type !== "video";
      els.bgOverlay[kind].value = cfg.overlay;
      els.bgOverlayOut[kind].textContent = Math.round(cfg.overlay * 100) + "%";
      els.bgBlur[kind].value = cfg.blur;
      els.bgBlurOut[kind].textContent = cfg.blur + "px";
      els.bgRemove[kind].hidden = !cfg.src;
      updateBgNote(kind);
      renderThumb(kind);
    });

    els.text.forEach(function (input) {
      var key = input.getAttribute("data-text");
      if (document.activeElement !== input) input.value = state.text[key] || "";
    });

    renderSocials();
  }

  /* ---------- 找到我 ---------- */
  function normalizeHref(value) {
    var href = String(value || "").trim();
    if (!href) return "";
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) return href;
    return "https://" + href;
  }

  function renderSocials() {
    if (!els.socialsList) return;
    var list = state.socials || [];
    if (!list.length) {
      els.socialsList.innerHTML = '<p class="social-empty">还没有链接，点下面「添加一项」。</p>';
      return;
    }
    els.socialsList.innerHTML = list
      .map(function (item, index) {
        return (
          '<div class="social-row" data-social-row="' +
          index +
          '">' +
          '<input class="studio-input" type="text" data-social-label placeholder="名称，如 豆瓣" value="' +
          esc(item.label) +
          '" />' +
          '<input class="studio-input" type="text" data-social-href placeholder="https://…" value="' +
          esc(item.href) +
          '" />' +
          '<button class="social-row__remove" type="button" data-social-remove="' +
          index +
          '" aria-label="删除这一项">×</button>' +
          "</div>"
        );
      })
      .join("");
  }

  /* ---------- 预览 ---------- */
  function previewUrl() {
    var theme = "&theme=" + preview.theme;
    if (preview.page === "post") {
      var id = BLOG.posts && BLOG.posts[0] ? BLOG.posts[0].id : "";
      return "post.html?preview=1" + theme + (id ? "#" + encodeURIComponent(id) : "");
    }
    return "index.html?preview=1" + theme;
  }

  function postPreview() {
    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify(state));
    } catch (e) {}
    if (els.frame.contentWindow) {
      els.frame.contentWindow.postMessage(
        {
          source: "design-studio",
          settings: state,
          theme: preview.theme
        },
        "*"
      );
    }
  }

  function loadPreview() {
    els.frame.src = previewUrl();
  }

  function fitFrame() {
    if (!els.stage) return;
    var available = Math.max(280, els.stage.clientWidth - 40);
    var baseWidth = preview.device === "desktop" ? 1280 : 414;
    var baseHeight = preview.device === "desktop" ? 1520 : 1420;
    var scale = Math.min(available / baseWidth, 1);

    els.frame.style.width = baseWidth + "px";
    els.frame.style.height = baseHeight + "px";
    els.frame.style.transform = "scale(" + scale + ")";
    els.scaler.style.width = Math.round(baseWidth * scale) + "px";
    els.scaler.style.height = Math.round(baseHeight * scale) + "px";
  }

  /* ---------- 保存 ---------- */
  function buildDesignFile() {
    var data = {
      version: 1,
      preset: state.preset,
      accent: state.accent || presetAccent(),
      font: state.font,
      fontSize: state.fontSize,
      lineHeight: Number(Number(state.lineHeight).toFixed(2)),
      fallback: state.fallback,
      bgHome: {
        type: state.bgHome.type,
        src: state.bgHome.src,
        overlay: Number(state.bgHome.overlay),
        blur: Number(state.bgHome.blur)
      },
      bgPost: {
        type: state.bgPost.type,
        src: state.bgPost.src,
        overlay: Number(state.bgPost.overlay),
        blur: Number(state.bgPost.blur)
      },
      socials: state.socials
        .filter(function (item) {
          return String(item.label || "").trim();
        })
        .map(function (item) {
          return {
            label: String(item.label || "").trim(),
            href: String(item.href || "").trim() || "#"
          };
        }),
      text: state.text
    };

    var header =
      "/* =============================================================\n" +
      "   网站外观配置 —— 由「外观设置」生成（" +
      new Date().toLocaleString("zh-CN", { hour12: false }) +
      "）\n" +
      "   想换回来：把 design.js 删除或改成默认内容即可\n" +
      "   ============================================================= */\n\n";

    return header + "window.DESIGN = " + JSON.stringify(data, null, 2) + ";\n";
  }

  function download(name, text) {
    var blob = new Blob([text], { type: "text/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 3000);
  }

  function finishSave(message) {
    clearTimeout(draftTimer);
    dirty = false;
    statusOverride = message;
    updateStatus();
    clearDraft();
    toast(message);
  }

  function save() {
    var text = buildDesignFile();

    if (!window.showSaveFilePicker) {
      download("design.js", text);
      finishSave("已下载 design.js，请覆盖 assets/js/design.js");
      return;
    }

    var picker;
    if (fileHandle) {
      picker = Promise.resolve(fileHandle);
    } else {
      picker = window.showSaveFilePicker({
        suggestedName: "design.js",
        types: [{ description: "JavaScript 文件", accept: { "text/javascript": [".js"] } }]
      });
    }

    picker
      .then(function (handle) {
        fileHandle = handle;
        return handle.createWritable().then(function (writable) {
          return writable.write(text).then(function () {
            return writable.close();
          });
        });
      })
      .then(
        function () {
          finishSave("已写入 design.js，刷新首页即可看到");
        },
        function (err) {
          if (err && err.name === "AbortError") {
            toast("已取消保存");
            return;
          }
          fileHandle = null;
          download("design.js", text);
          finishSave("未能直接写入，已下载 design.js，请覆盖 assets/js/design.js");
        }
      );
  }

  /* ---------- 图片处理 ---------- */
  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function compressImage(file) {
    return readAsDataUrl(file).then(function (src) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          try {
            var max = 1920;
            var scale = Math.min(1, max / img.width);
            var width = Math.max(1, Math.round(img.width * scale));
            var height = Math.max(1, Math.round(img.height * scale));
            var canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            var quality = 0.82;
            var data = canvas.toDataURL("image/jpeg", quality);
            while (data.length > 800000 && quality > 0.5) {
              quality -= 0.08;
              data = canvas.toDataURL("image/jpeg", quality);
            }
            resolve(data);
          } catch (e) {
            reject(e);
          }
        };
        img.src = src;
      });
    });
  }

  function setBg(kind, type, src) {
    var cfg = bgOf(kind);
    cfg.type = type;
    cfg.src = src;
    scheduleSync({ controls: true });
  }

  function onFile(kind, file) {
    if (!file) return;
    if (file.type === "image/gif") {
      if (file.size > 4.5 * 1024 * 1024) {
        toast("GIF 超过 4.5MB，内嵌后会明显拖慢页面，建议压缩或用视频");
      }
      readAsDataUrl(file).then(function (url) {
        setBg(kind, "image", url);
        toast("GIF 已加入（保留动画）");
      });
      return;
    }
    if (file.type.indexOf("image/") === 0) {
      compressImage(file).then(
        function (url) {
          setBg(kind, "image", url);
          toast("图片已压缩并加入");
        },
        function () {
          toast("图片读取失败，换一张试试");
        }
      );
      return;
    }
    if (file.type.indexOf("video/") === 0) {
      var path = "assets/media/" + file.name;
      setBg(kind, "video", path);
      toast("已记录路径 " + path + "，请把视频复制到 assets/media/");
      return;
    }
    toast("请选择图片、GIF 或视频文件");
  }

  /* ---------- 事件 ---------- */
  function bind() {
    els.presets.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-preset]");
      if (!btn) return;
      state.preset = btn.getAttribute("data-preset");
      state.accent = (PRESETS[state.preset] || {}).accent || state.accent;
      scheduleSync({ controls: true });
    });

    els.accentColor.addEventListener("input", function () {
      state.accent = els.accentColor.value;
      els.accentText.value = state.accent.toUpperCase();
      scheduleSync();
    });

    els.accentText.addEventListener("input", function () {
      var value = els.accentText.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
        state.accent = value.charAt(0) === "#" ? value : "#" + value;
        els.accentColor.value = state.accent;
        scheduleSync();
      }
    });

    els.accentReset.addEventListener("click", function () {
      state.accent = presetAccent();
      scheduleSync({ controls: true });
    });

    els.font.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-value]");
      if (!btn) return;
      state.font = btn.getAttribute("data-value");
      scheduleSync({ controls: true });
    });

    els.size.addEventListener("input", function () {
      state.fontSize = Number(els.size.value);
      els.sizeOut.textContent = state.fontSize + "px";
      scheduleSync();
    });

    els.lh.addEventListener("input", function () {
      state.lineHeight = Number(els.lh.value);
      els.lhOut.textContent = Number(state.lineHeight).toFixed(2);
      scheduleSync();
    });

    els.fallback.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-value]");
      if (!btn) return;
      state.fallback = btn.getAttribute("data-value");
      scheduleSync({ controls: true });
    });

    ["home", "post"].forEach(function (kind) {
      els.bgType[kind].addEventListener("click", function (event) {
        var btn = event.target.closest("[data-value]");
        if (!btn) return;
        var cfg = bgOf(kind);
        cfg.type = btn.getAttribute("data-value");
        if (cfg.type === "none") cfg.src = "";
        scheduleSync({ controls: true });
      });

      els.bgPick[kind].addEventListener("click", function () {
        els.bgFile[kind].click();
      });

      els.bgFile[kind].addEventListener("change", function () {
        var file = els.bgFile[kind].files && els.bgFile[kind].files[0];
        els.bgFile[kind].value = "";
        onFile(kind, file);
      });

      els.bgPath[kind].addEventListener("input", function () {
        var cfg = bgOf(kind);
        cfg.type = "video";
        cfg.src = els.bgPath[kind].value.trim();
        els.bgPathWrap[kind].hidden = false;
        els.bgRemove[kind].hidden = !cfg.src;
        updateBgNote(kind);
        scheduleSync();
      });

      els.bgPath[kind].addEventListener("change", function () {
        refreshBgUi(kind);
      });

      els.bgOverlay[kind].addEventListener("input", function () {
        var cfg = bgOf(kind);
        cfg.overlay = Number(els.bgOverlay[kind].value);
        els.bgOverlayOut[kind].textContent = Math.round(cfg.overlay * 100) + "%";
        scheduleSync();
      });

      els.bgBlur[kind].addEventListener("input", function () {
        var cfg = bgOf(kind);
        cfg.blur = Number(els.bgBlur[kind].value);
        els.bgBlurOut[kind].textContent = cfg.blur + "px";
        scheduleSync();
      });

      els.bgRemove[kind].addEventListener("click", function () {
        var cfg = bgOf(kind);
        cfg.type = "none";
        cfg.src = "";
        scheduleSync({ controls: true });
      });
    });

    els.text.forEach(function (input) {
      input.addEventListener("input", function () {
        var key = input.getAttribute("data-text");
        state.text[key] = input.value;
        scheduleSync();
      });
    });

    els.socialsList.addEventListener("input", function (event) {
      var row = event.target.closest("[data-social-row]");
      if (!row) return;
      var item = state.socials[Number(row.getAttribute("data-social-row"))];
      if (!item) return;
      if (event.target.hasAttribute("data-social-label")) {
        item.label = event.target.value;
      } else if (event.target.hasAttribute("data-social-href")) {
        item.href = event.target.value;
      }
      scheduleSync();
    });

    els.socialsList.addEventListener(
      "blur",
      function (event) {
        if (!event.target.hasAttribute("data-social-href")) return;
        var row = event.target.closest("[data-social-row]");
        if (!row) return;
        var item = state.socials[Number(row.getAttribute("data-social-row"))];
        if (!item) return;
        var clean = normalizeHref(item.href);
        if (clean !== item.href) {
          item.href = clean;
          event.target.value = clean;
          scheduleSync();
        }
      },
      true
    );

    els.socialsList.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-social-remove]");
      if (!btn) return;
      state.socials.splice(Number(btn.getAttribute("data-social-remove")), 1);
      renderSocials();
      scheduleSync();
    });

    els.socialAdd.addEventListener("click", function () {
      if (state.socials.length >= 8) {
        toast("最多 8 个链接");
        return;
      }
      state.socials.push({ label: "", href: "" });
      renderSocials();
      scheduleSync();
      var inputs = els.socialsList.querySelectorAll("[data-social-label]");
      if (inputs.length) inputs[inputs.length - 1].focus();
    });

    els.previewPage.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-value]");
      if (!btn) return;
      preview.page = btn.getAttribute("data-value");
      setPressed(els.previewPage, "[data-value]", preview.page);
      loadPreview();
    });

    els.previewDevice.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-value]");
      if (!btn) return;
      preview.device = btn.getAttribute("data-value");
      setPressed(els.previewDevice, "[data-value]", preview.device);
      fitFrame();
    });

    els.previewTheme.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-value]");
      if (!btn) return;
      preview.theme = btn.getAttribute("data-value");
      setPressed(els.previewTheme, "[data-value]", preview.theme);
      loadPreview();
    });

    els.frame.addEventListener("load", function () {
      postPreview();
      fitFrame();
    });

    els.save.addEventListener("click", save);
    els.discard.addEventListener("click", discard);
    els.reset.addEventListener("click", resetAll);

    els.bannerClose.addEventListener("click", function () {
      els.banner.hidden = true;
    });
    els.bannerDiscard.addEventListener("click", discard);

    window.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    });

    if (window.ResizeObserver) {
      new ResizeObserver(fitFrame).observe(els.stage);
    } else {
      window.addEventListener("resize", fitFrame);
    }
  }

  function discard() {
    if (!window.confirm("放弃所有未保存的调整，重新读取 design.js？")) return;
    clearDraft();
    window.location.reload();
  }

  function resetAll() {
    if (!window.confirm("恢复成默认外观（暖纸 · 陶土），并清空自定义文字？")) return;
    state = withSocials(JSON.parse(JSON.stringify(DEFAULTS)));
    fileHandle = null;
    fillControls();
    scheduleSync();
    toast("已恢复默认外观");
  }

  /* ---------- 初始化 ---------- */
  function init() {
    var site = (BLOG.site || {});
    $all("[data-site-name]").forEach(function (el) {
      el.textContent = site.title || "王子猪博客";
    });
    document.title = "外观设置 · " + (site.title || "博客");

    var draft = readDraft();
    if (draft) {
      state = withSocials(draft.settings);
      dirty = true;
      els.banner.hidden = false;
      els.bannerText.textContent =
        "已恢复上次未保存的调整" + (draft.savedAt ? "（" + formatTime(draft.savedAt) + "）" : "");
    }

    buildPresets();
    fillControls();
    updateStatus();
    setPressed(els.previewPage, "[data-value]", preview.page);
    setPressed(els.previewDevice, "[data-value]", preview.device);
    setPressed(els.previewTheme, "[data-value]", preview.theme);
    bind();
    loadPreview();
    fitFrame();
  }

  init();
})();
