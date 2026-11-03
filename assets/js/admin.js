/* =============================================================
   写作台逻辑（纯本地）
   - 读取 data.js 的 window.BLOG
   - 编辑 / 新建 / 删除 / 置顶
   - 实时预览、草稿暂存、封面压缩
   - 生成新的 data.js 供下载覆盖
   ============================================================= */

(function () {
  "use strict";

  var BLOG = window.BLOG;
  var Data = window.ArticleData;
  var UI = window.BlogUI || {
    formatDate: function (d) {
      return d;
    },
    readingTime: function () {
      return "1 分钟";
    },
    escapeHtml: function (s) {
      return String(s == null ? "" : s);
    },
    plainText: function (s) {
      return String(s || "").replace(/<[^>]*>/g, "");
    }
  };

  if (!BLOG || !Array.isArray(BLOG.posts) || !Data) {
    document.body.innerHTML =
      '<p style="padding:3rem;text-align:center;font-family:sans-serif">数据没有载入成功，请确认 assets/js/data.js 存在且格式正确。</p>';
    return;
  }

  var DRAFT_KEY = "wz-blog-admin-draft-v2";
  var ALLOWED = {
    P: 1,
    H2: 1,
    H3: 1,
    BLOCKQUOTE: 1,
    UL: 1,
    OL: 1,
    LI: 1,
    STRONG: 1,
    B: 1,
    EM: 1,
    I: 1,
    A: 1,
    IMG: 1,
    HR: 1,
    BR: 1,
    CODE: 1,
    PRE: 1
  };

  var els = {
    list: document.querySelector("[data-list]"),
    count: document.querySelector("[data-count]"),
    newBtn: document.querySelector("[data-new]"),
    fields: document.querySelector("[data-fields]"),
    empty: document.querySelector("[data-empty]"),
    title: document.querySelector('[data-field="title"]'),
    date: document.querySelector('[data-field="date"]'),
    tags: document.querySelector('[data-field="tags"]'),
    featured: document.querySelector('[data-field="featured"]'),
    excerpt: document.querySelector('[data-field="excerpt"]'),
    id: document.querySelector('[data-field="id"]'),
    idHint: document.querySelector("[data-id-hint]"),
    editor: document.querySelector("[data-editor]"),
    toolbar: document.querySelector("[data-toolbar]"),
    inlineImage: document.querySelector("[data-inline-image]"),
    coverInput: document.querySelector("[data-cover-input]"),
    coverPick: document.querySelector("[data-cover-pick]"),
    coverClear: document.querySelector("[data-cover-clear]"),
    coverThumb: document.querySelector("[data-cover-thumb]"),
    coverHint: document.querySelector("[data-cover-hint]"),
    postBgInput: document.querySelector("[data-post-bg-input]"),
    postBgPick: document.querySelector("[data-post-bg-pick]"),
    postBgClear: document.querySelector("[data-post-bg-clear]"),
    postBgThumb: document.querySelector("[data-post-bg-thumb]"),
    postBgHint: document.querySelector("[data-post-bg-hint]"),
    saveBtn: document.querySelector("[data-save]"),
    discardBtn: document.querySelector("[data-discard]"),
    deleteBtn: document.querySelector("[data-delete]"),
    statusDot: document.querySelector("[data-status-dot]"),
    statusText: document.querySelector("[data-status-text]"),
    banner: document.querySelector("[data-banner]"),
    bannerText: document.querySelector("[data-banner-text]"),
    bannerClose: document.querySelector("[data-banner-close]"),
    bannerDiscard: document.querySelector("[data-banner-discard]"),
    toast: document.querySelector("[data-toast]"),
    preview: {
      title: document.querySelector("[data-preview-title]"),
      excerpt: document.querySelector("[data-preview-excerpt]"),
      tags: document.querySelector("[data-preview-tags]"),
      meta: document.querySelector("[data-preview-meta]"),
      content: document.querySelector("[data-preview-content]"),
      cover: document.querySelector("[data-preview-cover]"),
      coverImg: document.querySelector("[data-preview-cover-img]"),
      words: document.querySelector("[data-words]")
    }
  };

  var state = {
    site: BLOG.site || {},
    posts: [],
    current: null,
    dirty: false,
    previewTimer: null,
    listTimer: null,
    draftTimer: null,
    toastTimer: null,
    quotaWarned: false
  };

  /* ---------- 小工具 ---------- */
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function parseTags(value) {
    var seen = {};
    return String(value || "")
      .split(/[,，、]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        if (!s || seen[s]) return false;
        seen[s] = true;
        return true;
      })
      .slice(0, 8);
  }

  /* ---------- 状态 ---------- */
  var fileHandle = null;
  var statusOverride = "";

  function updateStatus() {
    els.statusDot.classList.toggle("is-dirty", state.dirty);
    els.statusText.textContent = state.dirty
      ? "有未保存修改"
      : statusOverride || "已载入 " + state.posts.length + " 篇";
    els.discardBtn.hidden = !state.dirty;
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    requestAnimationFrame(function () {
      els.toast.classList.add("is-show");
    });
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      els.toast.classList.remove("is-show");
      setTimeout(function () {
        els.toast.hidden = true;
      }, 260);
    }, 2800);
  }

  /* ---------- 草稿 ---------- */
  function scheduleDraft() {
    clearTimeout(state.draftTimer);
    state.draftTimer = setTimeout(saveDraft, 700);
  }

  function saveDraft() {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ posts: state.posts, savedAt: Date.now() })
      );
    } catch (e) {
      if (!state.quotaWarned) {
        state.quotaWarned = true;
        toast("草稿体积过大，自动暂存已停止；请及时保存 data.js");
      }
    }
  }

  function readDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.posts)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  /* ---------- 触达修改 ---------- */
  function touch() {
    state.dirty = true;
    statusOverride = "";
    updateStatus();
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(updatePreview, 120);
    scheduleDraft();
  }

  function scheduleList() {
    clearTimeout(state.listTimer);
    state.listTimer = setTimeout(renderList, 260);
  }

  /* ---------- 列表 ---------- */
  function renderList() {
    var scrollTop = els.list.scrollTop;
    if (!state.posts.length) {
      els.list.innerHTML = '<p class="admin-hint" style="padding:.5rem .2rem">还没有文章，点上面新建一篇。</p>';
    } else {
      els.list.innerHTML = state.posts
        .map(function (post, index) {
          var active = post === state.current ? " is-active" : "";
          return (
            '<button class="admin-list__item' +
            active +
            '" type="button" data-index="' +
            index +
            '">' +
            '<span class="admin-list__title">' +
            esc(post.title || "无标题文章") +
            "</span>" +
            '<span class="admin-list__meta">' +
            esc(post.date || "—") +
            (post.featured ? " · 置顶" : "") +
            "</span>" +
            "</button>"
          );
        })
        .join("");
      Array.prototype.forEach.call(els.list.querySelectorAll("[data-index]"), function (btn) {
        btn.addEventListener("click", function () {
          var post = state.posts[Number(btn.getAttribute("data-index"))];
          if (post) selectPost(post);
        });
      });
    }
    els.count.textContent = state.posts.length + " 篇";
    els.list.scrollTop = scrollTop;
  }

  /* ---------- 选择 / 表单 ---------- */
  function selectPost(post) {
    if (!post || post === state.current) return;
    state.current = post;
    fillForm(post);
    renderList();
    updatePreview();
  }

  function fillForm(post) {
    els.empty.hidden = true;
    els.fields.hidden = false;
    els.title.value = post.title || "";
    els.date.value = post.date || "";
    els.tags.value = (post.tags || []).join(", ");
    els.featured.checked = Boolean(post.featured);
    els.excerpt.value = post.excerpt || "";
    els.id.value = post.id || "";
    els.idHint.textContent = post.id ? "文章链接：post.html#" + post.id : "还没有设置地址标识";
    els.editor.innerHTML = post.content || "";
    updateCover(post);
    updatePostBg(post);
  }

  function showEmpty() {
    els.fields.hidden = true;
    els.empty.hidden = false;
  }

  function updateCover(post) {
    els.coverThumb.innerHTML = "";
    if (post.cover) {
      var img = document.createElement("img");
      img.src = post.cover;
      img.alt = "";
      els.coverThumb.appendChild(img);
      els.coverClear.hidden = false;
      els.coverHint.textContent =
        "已设置封面 · 约 " + Math.round((post.cover.length * 0.75) / 1024) + " KB（会写入 data.js）";
    } else {
      var span = document.createElement("span");
      span.textContent = "无封面";
      els.coverThumb.appendChild(span);
      els.coverClear.hidden = true;
      els.coverHint.textContent = "不选则自动使用装饰封面（推荐，文件更小）";
    }
  }

  function updatePostBg(post) {
    els.postBgThumb.innerHTML = "";
    if (post.bg) {
      var img = document.createElement("img");
      img.src = post.bg;
      img.alt = "";
      els.postBgThumb.appendChild(img);
      els.postBgClear.hidden = false;
      els.postBgHint.textContent =
        "只在这篇文章页显示 · 约 " + Math.round((post.bg.length * 0.75) / 1024) + " KB（会写入 data.js）";
    } else {
      var span = document.createElement("span");
      span.textContent = "无背景";
      els.postBgThumb.appendChild(span);
      els.postBgClear.hidden = true;
      els.postBgHint.textContent = "只在这篇文章页显示；不选则用「外观设置」里的文章页背景";
    }
  }

  /* ---------- 实时预览 ---------- */
  function updatePreview() {
    var post = state.current;
    var pv = els.preview;

    if (!post) {
      pv.title.textContent = "无标题文章";
      pv.excerpt.textContent = "";
      pv.tags.innerHTML = "";
      pv.meta.textContent = "";
      pv.content.innerHTML = "";
      pv.words.textContent = "";
      pv.cover.hidden = true;
      return;
    }

    pv.title.textContent = (post.title || "").trim() || "无标题文章";
    pv.excerpt.textContent = post.excerpt || "";
    pv.tags.innerHTML = (post.tags || [])
      .map(function (tag) {
        return '<span class="tag">' + esc(tag) + "</span>";
      })
      .join("");
    pv.meta.innerHTML =
      "<time>" +
      esc(UI.formatDate(post.date || today())) +
      "</time><span>·</span><span>阅读约 " +
      UI.readingTime(post.content) +
      "</span>";
    pv.content.innerHTML = post.content || "";

    if (post.cover) {
      pv.coverImg.src = post.cover;
      pv.cover.hidden = false;
    } else {
      pv.cover.hidden = true;
      pv.coverImg.removeAttribute("src");
    }

    var chars = UI.plainText(post.content || "").replace(/\s+/g, "").length;
    pv.words.textContent = chars ? chars + " 字" : "";
  }

  /* ---------- 编辑动作 ---------- */
  function onTitle() {
    var post = state.current;
    if (!post) return;
    post.title = els.title.value;
    touch();
    scheduleList();
  }

  function onDate() {
    var post = state.current;
    if (!post) return;
    post.date = els.date.value;
    touch();
    scheduleList();
  }

  function onTags() {
    var post = state.current;
    if (!post) return;
    post.tags = parseTags(els.tags.value);
    touch();
  }

  function onFeatured() {
    var post = state.current;
    if (!post) return;
    if (els.featured.checked) {
      state.posts.forEach(function (item) {
        item.featured = false;
      });
      post.featured = true;
    } else {
      post.featured = false;
    }
    touch();
    renderList();
    updatePreview();
  }

  function onExcerpt() {
    var post = state.current;
    if (!post) return;
    post.excerpt = els.excerpt.value;
    touch();
  }

  function onId() {
    var post = state.current;
    if (!post) return;
    var clean = els.id.value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+/, "");
    if (clean !== els.id.value) els.id.value = clean;
    post.id = clean;
    els.idHint.textContent = clean ? "文章链接：post.html#" + clean : "还没有设置地址标识";
    touch();
    scheduleList();
  }

  function onIdBlur() {
    var post = state.current;
    if (!post) return;
    if (!post.id) {
      post.id = uniqueId();
      els.id.value = post.id;
      els.idHint.textContent = "文章链接：post.html#" + post.id;
      touch();
      scheduleList();
    }
  }

  function onContent() {
    var post = state.current;
    if (!post) return;
    post.content = els.editor.innerHTML;
    touch();
  }

  /* ---------- 富文本工具栏 ---------- */
  function exec(command, value) {
    try {
      document.execCommand(command, false, value == null ? null : value);
    } catch (e) {
      /* 少数浏览器不支持该命令时静默跳过 */
    }
  }

  /* ---------- 正文插图 ---------- */
  var savedRange = null;

  function saveSelection() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    if (els.editor.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  }

  function restoreSelection() {
    els.editor.focus();
    if (!savedRange) return;
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function compressInlineImage(file) {
    return readFileAsDataUrl(file).then(function (src) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          try {
            var scale = Math.min(1, 1600 / img.width);
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
            while (data.length > 700000 && quality > 0.5) {
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

  function insertInlineImage(file) {
    return compressInlineImage(file).then(function (dataUrl) {
      restoreSelection();
      var empty = !els.editor.textContent.trim() && !els.editor.querySelector("img");
      var tag = '<img src="' + dataUrl + '" alt="">';
      document.execCommand(
        "insertHTML",
        false,
        empty ? "<p>" + tag + "</p><p><br></p>" : tag
      );
      saveSelection();
      onContent();
      if (dataUrl.length > 1100000) {
        toast("这张图较大，保存后 data.js 会明显变大");
      }
    });
  }

  function insertImageFiles(files) {
    var images = Array.prototype.filter.call(files || [], function (file) {
      return /^image\//.test(file.type);
    });
    if (!images.length) {
      toast("请选择图片文件");
      return;
    }
    toast(images.length > 1 ? "正在处理 " + images.length + " 张图片…" : "正在压缩图片…");
    saveSelection();
    var chain = Promise.resolve();
    images.forEach(function (file) {
      chain = chain.then(function () {
        return insertInlineImage(file).catch(function () {
          toast("有一张图片处理失败");
        });
      });
    });
  }

  function onToolbar(event) {
    var btn = event.target.closest("button[data-cmd]");
    if (!btn) return;
    var cmd = btn.getAttribute("data-cmd");

    if (cmd === "image") {
      saveSelection();
      els.inlineImage.click();
      return;
    }

    els.editor.focus();

    if (cmd === "link") {
      var url = window.prompt("链接地址", "https://");
      if (url && url.indexOf("http") !== 0 && url.indexOf("mailto:") !== 0) {
        url = "https://" + url;
      }
      if (url && url !== "https://") exec("createLink", url);
    } else if (cmd === "hr") {
      exec("insertHorizontalRule");
    } else if (cmd === "p" || cmd === "h2" || cmd === "blockquote") {
      exec("formatBlock", "<" + cmd + ">");
    } else if (cmd === "ul") {
      exec("insertUnorderedList");
    } else if (cmd === "ol") {
      exec("insertOrderedList");
    } else if (cmd === "bold") {
      exec("bold");
    } else if (cmd === "clear") {
      exec("removeFormat");
      exec("formatBlock", "<p>");
    }
    onContent();
  }

  function onPaste(event) {
    var clipboard = event.clipboardData || window.clipboardData;
    var items = clipboard && clipboard.items;
    var images = [];

    if (items) {
      for (var i = 0; i < items.length; i += 1) {
        if (items[i].kind === "file" && /^image\//.test(items[i].type)) {
          var file = items[i].getAsFile();
          if (file) images.push(file);
        }
      }
    }

    if (images.length) {
      event.preventDefault();
      insertImageFiles(images);
      return;
    }

    event.preventDefault();
    var text = clipboard.getData("text/plain");
    if (!text) return;
    var html = text
      .split(/\n{2,}/)
      .map(function (block) {
        return "<p>" + esc(block).replace(/\n/g, "<br>") + "</p>";
      })
      .join("");
    exec("insertHTML", html);
    onContent();
  }

  /* ---------- 封面 ---------- */
  function compressImage(file, done, fail) {
    var reader = new FileReader();
    reader.onerror = fail;
    reader.onload = function () {
      var img = new Image();
      img.onerror = fail;
      img.onload = function () {
        try {
          var scale = Math.min(1, 1200 / img.width);
          var width = Math.max(1, Math.round(img.width * scale));
          var height = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          var quality = 0.85;
          var data = canvas.toDataURL("image/jpeg", quality);
          while (data.length > 400000 && quality > 0.45) {
            quality -= 0.1;
            data = canvas.toDataURL("image/jpeg", quality);
          }
          done(data, width, height);
        } catch (e) {
          fail();
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function onCoverFile() {
    var file = els.coverInput.files && els.coverInput.files[0];
    els.coverInput.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast("请选择图片文件");
      return;
    }
    toast("正在压缩图片…");
    compressImage(
      file,
      function (dataUrl) {
        var post = state.current;
        if (!post) return;
        post.cover = dataUrl;
        updateCover(post);
        touch();
        updatePreview();
        toast("封面已加入，会随文章一起写进 data.js");
      },
      function () {
        toast("图片读取失败，换一张试试");
      }
    );
  }

  function onCoverClear() {
    var post = state.current;
    if (!post) return;
    post.cover = "";
    updateCover(post);
    touch();
    updatePreview();
  }

  /* ---------- 文章背景 ---------- */
  function compressBackground(file, done, fail) {
    var reader = new FileReader();
    reader.onerror = fail;
    reader.onload = function () {
      var img = new Image();
      img.onerror = fail;
      img.onload = function () {
        try {
          var scale = Math.min(1, 1920 / img.width);
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
          while (data.length > 900000 && quality > 0.5) {
            quality -= 0.08;
            data = canvas.toDataURL("image/jpeg", quality);
          }
          done(data, width, height);
        } catch (e) {
          fail();
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function onPostBgFile() {
    var file = els.postBgInput.files && els.postBgInput.files[0];
    els.postBgInput.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast("请选择图片文件");
      return;
    }
    toast("正在压缩背景图…");
    compressBackground(
      file,
      function (dataUrl) {
        var post = state.current;
        if (!post) return;
        post.bg = dataUrl;
        updatePostBg(post);
        touch();
        toast("文章背景已加入，会随文章写进 data.js");
      },
      function () {
        toast("图片读取失败，换一张试试");
      }
    );
  }

  function onPostBgClear() {
    var post = state.current;
    if (!post) return;
    post.bg = "";
    updatePostBg(post);
    touch();
    toast("已移除这篇文章的背景");
  }

  /* ---------- 新建 / 删除 ---------- */
  function uniqueId() {
    var d = new Date();
    var base =
      "post-" +
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "-" +
      pad(d.getHours()) +
      pad(d.getMinutes());
    var id = base;
    var n = 2;
    var used = function (value) {
      return state.posts.some(function (item) {
        return item.id === value;
      });
    };
    while (used(id)) {
      id = base + "-" + n;
      n += 1;
    }
    return id;
  }

  function newPost() {
    var post = {
      id: uniqueId(),
      title: "",
      date: today(),
      tags: [],
      featured: false,
      cover: "",
      bg: "",
      excerpt: "",
      content: ""
    };
    state.posts.unshift(post);
    state.current = post;
    state.dirty = true;
    renderList();
    fillForm(post);
    updatePreview();
    updateStatus();
    scheduleDraft();
    els.title.focus();
    toast("已新建一篇空白文章，先写个标题吧");
  }

  function deletePost() {
    var post = state.current;
    if (!post) return;
    var name = (post.title || "").trim() || "无标题文章";
    if (!window.confirm("确定删除《" + name + "》吗？保存 data.js 后才会从网站移除。")) return;
    var index = state.posts.indexOf(post);
    state.posts.splice(index, 1);
    state.current = state.posts[Math.min(index, state.posts.length - 1)] || null;
    state.dirty = true;
    renderList();
    if (state.current) {
      fillForm(state.current);
    } else {
      showEmpty();
    }
    updatePreview();
    updateStatus();
    scheduleDraft();
    toast("已删除，记得保存 data.js");
  }

  /* ---------- 校验 / 保存 ---------- */
  function validate() {
    var seen = {};
    for (var i = 0; i < state.posts.length; i += 1) {
      var post = state.posts[i];
      var title = (post.title || "").trim();
      var name = title ? "《" + title + "》" : "有一篇";
      if (!title) return "有一篇文章还没有标题";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date || "")) return name + " 的日期没填或格式不对";
      if (!post.id) return name + " 还没有地址标识，展开「高级设置」填一个";
      if (!/^[a-z0-9][a-z0-9-]*$/.test(post.id))
        return name + " 的地址标识只能用英文小写、数字和连字符";
      if (seen[post.id]) return "地址标识重复：" + post.id;
      seen[post.id] = true;
    }
    return "";
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

  function writeDataFile(text) {
    if (!window.showSaveFilePicker) {
      return Promise.reject({ name: "NotSupported" });
    }

    var picker;
    try {
      picker = fileHandle
        ? Promise.resolve(fileHandle)
        : window.showSaveFilePicker({
            suggestedName: "data.js",
            types: [{ description: "JavaScript 文件", accept: { "text/javascript": [".js"] } }]
          });
    } catch (e) {
      return Promise.reject(e);
    }

    return picker.then(function (handle) {
      fileHandle = handle;
      return handle.createWritable().then(function (writable) {
        return writable.write(text).then(function () {
          return writable.close();
        });
      });
    });
  }

  function finishSave(message) {
    clearTimeout(state.draftTimer);
    state.dirty = false;
    statusOverride = message;
    updateStatus();
    clearDraft();
    toast(message);
  }

  function save() {
    var problem = validate();
    if (problem) {
      toast(problem);
      return;
    }

    state.posts.forEach(function (post) {
      post.title = (post.title || "").trim();
      post.excerpt = (post.excerpt || "").trim();
      post.bg = post.bg || "";
      post.content = sanitizeHTML(post.content || "");
      post.tags = post.tags.filter(Boolean);
    });

    state.posts.sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

    renderList();
    if (state.current) fillForm(state.current);
    updatePreview();

    var text = Data.buildDataFile(state.site, state.posts);

    writeDataFile(text).then(
      function () {
        finishSave("已写入 data.js，刷新首页即可看到");
      },
      function (err) {
        if (err && err.name === "AbortError") {
          toast("已取消保存");
          return;
        }
        fileHandle = null;
        download("data.js", text);
        finishSave("未能直接写入，已下载 data.js，请覆盖 assets/js/data.js");
      }
    );
  }

  function discardAll() {
    if (!window.confirm("放弃所有未保存的修改，重新读取 data.js？")) return;
    clearDraft();
    window.location.reload();
  }

  /* ---------- HTML 清洗 ---------- */
  function sanitizeHTML(html) {
    if (!html) return "";
    var doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    var root = doc.body.firstChild;
    if (!root) return "";
    var out = "";
    for (var i = 0; i < root.childNodes.length; i += 1) {
      out += cleanNode(root.childNodes[i]);
    }
    return out
      .replace(/<p>\s*<\/p>/g, "")
      .replace(/<p><br><\/p>/g, "")
      .replace(/(<br>\s*){3,}/g, "<br><br>")
      .trim();
  }

  function cleanNode(node) {
    if (node.nodeType === 3) return esc(node.nodeValue);
    if (node.nodeType !== 1) return "";

    var tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME" || tag === "OBJECT") return "";

    if (tag === "IMG") {
      var src = node.getAttribute("src") || "";
      if (!/^(data:image\/|https?:\/\/|assets\/|\/)/i.test(src)) return "";
      return '<img src="' + esc(src) + '" alt="' + esc(node.getAttribute("alt") || "") + '">';
    }

    var inner = "";
    for (var i = 0; i < node.childNodes.length; i += 1) {
      inner += cleanNode(node.childNodes[i]);
    }

    if (tag === "DIV") return "<p>" + inner + "</p>";
    if (!ALLOWED[tag]) return inner;

    var lower = tag.toLowerCase();
    if (lower === "br" || lower === "hr") return "<" + lower + ">";

    var attrs = "";
    if (lower === "a") {
      var href = node.getAttribute("href") || "";
      if (/^(https?:\/\/|mailto:|#|\/)/i.test(href)) attrs = ' href="' + esc(href) + '"';
    }
    return "<" + lower + attrs + ">" + inner + "</" + lower + ">";
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    els.title.addEventListener("input", onTitle);
    els.date.addEventListener("input", onDate);
    els.date.addEventListener("change", onDate);
    els.tags.addEventListener("input", onTags);
    els.featured.addEventListener("change", onFeatured);
    els.excerpt.addEventListener("input", onExcerpt);
    els.id.addEventListener("input", onId);
    els.id.addEventListener("blur", onIdBlur);

    els.editor.addEventListener("input", onContent);
    els.editor.addEventListener("paste", onPaste);
    els.editor.addEventListener("keyup", saveSelection);
    els.editor.addEventListener("mouseup", saveSelection);
    els.editor.addEventListener("drop", function (event) {
      event.preventDefault();
      var files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length) return;
      if (document.caretRangeFromPoint) {
        var range = document.caretRangeFromPoint(event.clientX, event.clientY);
        if (range) {
          var selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          saveSelection();
        }
      }
      insertImageFiles(files);
    });

    els.inlineImage.addEventListener("change", function () {
      var files = Array.prototype.slice.call(els.inlineImage.files || []);
      els.inlineImage.value = "";
      if (files.length) insertImageFiles(files);
    });

    document.addEventListener("selectionchange", function () {
      var selection = window.getSelection();
      if (selection && selection.rangeCount && els.editor.contains(selection.anchorNode)) {
        saveSelection();
      }
    });

    els.toolbar.addEventListener("mousedown", function (event) {
      if (event.target.closest("button")) event.preventDefault();
    });
    els.toolbar.addEventListener("click", onToolbar);

    els.coverPick.addEventListener("click", function () {
      els.coverInput.click();
    });
    els.coverInput.addEventListener("change", onCoverFile);
    els.coverClear.addEventListener("click", onCoverClear);

    els.postBgPick.addEventListener("click", function () {
      els.postBgInput.click();
    });
    els.postBgInput.addEventListener("change", onPostBgFile);
    els.postBgClear.addEventListener("click", onPostBgClear);

    els.newBtn.addEventListener("click", newPost);
    els.deleteBtn.addEventListener("click", deletePost);
    els.saveBtn.addEventListener("click", save);
    els.discardBtn.addEventListener("click", discardAll);
    els.bannerClose.addEventListener("click", function () {
      els.banner.hidden = true;
    });
    els.bannerDiscard.addEventListener("click", discardAll);

    window.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    var nameEls = document.querySelectorAll("[data-site-name]");
    Array.prototype.forEach.call(nameEls, function (el) {
      el.textContent = state.site.title || "我的博客";
    });
    document.title = "写作台 · " + (state.site.title || "博客");

    var draft = readDraft();
    if (draft) {
      state.posts = draft.posts;
      state.dirty = true;
      els.banner.hidden = false;
      els.bannerText.textContent =
        "已恢复上次未保存的编辑内容" + (draft.savedAt ? "（" + formatTime(draft.savedAt) + "）" : "");
    } else {
      state.posts = clone(BLOG.posts);
      state.dirty = false;
    }

    state.current = state.posts[0] || null;

    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (e) {}

    renderList();
    if (state.current) {
      fillForm(state.current);
    } else {
      showEmpty();
    }
    updatePreview();
    updateStatus();
    bind();
  }

  init();
})();
