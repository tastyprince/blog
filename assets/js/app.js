/* =============================================================
   首页逻辑：渲染精选 / 年份分组 / 标签筛选 / 站内搜索
   ============================================================= */

(function () {
  "use strict";

  var BLOG = window.BLOG || { site: {}, posts: [] };
  var UI = window.BlogUI;

  var state = { q: "", tag: "全部" };

  var posts = (BLOG.posts || [])
    .slice()
    .sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });

  var featuredEl = document.querySelector("[data-featured]");
  var featuredSection = document.querySelector("[data-featured-section]");
  var listEl = document.querySelector("[data-post-list]");
  var emptyEl = document.querySelector("[data-empty]");
  var filtersEl = document.querySelector("[data-filters]");
  var noteEl = document.querySelector("[data-result-note]");
  var searchWrap = document.querySelector("[data-search-wrap]");
  var searchInput = document.getElementById("search-input");
  var clearBtn = document.querySelector("[data-search-clear]");
  var resetBtn = document.querySelector("[data-reset]");

  /* ---------- 站点信息 ---------- */
  function fillSite() {
    var site = BLOG.site || {};
    var dt = (window.DESIGN && window.DESIGN.text) || {};
    var siteTitle = dt.siteTitle || site.title || "王子猪博客";
    var tagline = dt.tagline || site.tagline || "";
    document.querySelectorAll("[data-site-title]").forEach(function (el) {
      el.textContent = siteTitle;
    });
    document.querySelectorAll("[data-site-name]").forEach(function (el) {
      if (site.name) el.textContent = site.name;
    });
    document.querySelectorAll("[data-site-tagline]").forEach(function (el) {
      if (tagline) el.textContent = tagline;
    });
    document.querySelectorAll("[data-site-intro]").forEach(function (el) {
      var text = site.heroIntro || site.intro;
      if (text) el.textContent = text;
    });
    document.querySelectorAll("[data-site-about]").forEach(function (el) {
      if (site.intro) el.textContent = site.intro;
    });
    document.querySelectorAll("[data-since]").forEach(function (el) {
      if (site.since) el.textContent = site.since;
    });
    document.title = siteTitle + " · " + tagline;

    var avatar = document.querySelector("[data-avatar]");
    if (avatar && site.avatar) {
      avatar.innerHTML = '<img src="' + UI.escapeHtml(site.avatar) + '" alt="" decoding="async">';
    }

    var socials = document.querySelector("[data-socials]");
    if (socials && Array.isArray(site.socials)) {
      socials.innerHTML = site.socials
        .map(function (s) {
          var href = String(s.href || "#");
          var external = /^https?:\/\//i.test(href);
          return (
            '<a class="about__link" href="' +
            UI.escapeHtml(href) +
            '"' +
            (external ? ' target="_blank" rel="noopener noreferrer"' : "") +
            ">" +
            UI.escapeHtml(s.label) +
            "</a>"
          );
        })
        .join("");
    }
  }

  /* ---------- 统计 ---------- */
  function allTags() {
    var map = new Map();
    posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        map.set(t, (map.get(t) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort(function (a, b) {
      return b[1] - a[1] || a[0].localeCompare(b[0], "zh");
    });
  }

  function fillStats() {
    var countEl = document.querySelector("[data-count-posts]");
    if (countEl) countEl.textContent = posts.length + " 篇";
    var tagEl = document.querySelector("[data-count-tags]");
    if (tagEl) tagEl.textContent = allTags().length + " 个";
  }

  /* ---------- 筛选条 ---------- */
  function renderFilters() {
    if (!filtersEl) return;
    var html = [
      '<button class="chip" type="button" data-tag="全部">全部<sup class="chip__count">' +
        posts.length +
        "</sup></button>"
    ];
    allTags().forEach(function (pair) {
      html.push(
        '<button class="chip" type="button" data-tag="' +
          UI.escapeHtml(pair[0]) +
          '">' +
          UI.escapeHtml(pair[0]) +
          '<sup class="chip__count">' +
          pair[1] +
          "</sup></button>"
      );
    });
    filtersEl.innerHTML = html.join("");
    filtersEl.querySelectorAll("[data-tag]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-tag") === state.tag));
      btn.addEventListener("click", function () {
        setTag(btn.getAttribute("data-tag"));
      });
    });
  }

  function syncChips() {
    if (!filtersEl) return;
    filtersEl.querySelectorAll("[data-tag]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-tag") === state.tag));
    });
  }

  /* ---------- 搜索匹配 ---------- */
  function matches(post) {
    if (state.tag !== "全部" && (post.tags || []).indexOf(state.tag) === -1) return false;
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    var bodyText = UI.plainText(String(post.content || "").replace(/<img[^>]*>/gi, " "));
    var haystack = [post.title, post.excerpt, (post.tags || []).join(" "), bodyText]
      .join(" ")
      .toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  function highlight(text) {
    var safe = UI.escapeHtml(text);
    if (!state.q) return safe;
    var q = UI.escapeHtml(state.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      return safe.replace(new RegExp("(" + q + ")", "gi"), "<mark>$1</mark>");
    } catch (e) {
      return safe;
    }
  }

  /* ---------- 渲染 ---------- */
  function metaHtml(post) {
    return (
      '<div class="meta">' +
      '<time datetime="' +
      post.date +
      '">' +
      UI.formatShort(post.date) +
      "</time>" +
      '<span class="meta__dot" aria-hidden="true"></span>' +
      "<span>" +
      UI.readingTime(post.content) +
      "阅读</span>" +
      (post.tags && post.tags.length
        ? '<span class="meta__dot" aria-hidden="true"></span><span>' +
          post.tags.map(UI.escapeHtml).join(" · ") +
          "</span>"
        : "") +
      "</div>"
    );
  }

  function arrowSvg() {
    return (
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12 6l6 6-6 6"/></svg>'
    );
  }

  function renderFeatured(post) {
    if (!featuredEl || !featuredSection) return;
    if (!post) {
      featuredSection.hidden = true;
      return;
    }
    var url = UI.postUrl(post);
    featuredEl.innerHTML =
      '<article class="featured">' +
      '<a class="entry__thumb-link" href="' +
      url +
      '" tabindex="-1" aria-hidden="true">' +
      UI.coverMarkup(post, 0, "cover--featured", true) +
      "</a>" +
      '<div class="featured__body">' +
      '<span class="featured__badge">置顶 · 精选</span>' +
      '<h2 class="featured__title"><a href="' +
      url +
      '">' +
      highlight(post.title) +
      "</a></h2>" +
      '<p class="featured__excerpt">' +
      highlight(post.excerpt) +
      "</p>" +
      metaHtml(post) +
      "</div>" +
      "</article>";
  }

  function renderList(list) {
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var groups = new Map();
    list.forEach(function (p) {
      var y = String(p.date).slice(0, 4);
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(p);
    });

    var filtering = Boolean(state.q) || state.tag !== "全部";
    var html = [
      '<div class="section-label"><span>全部手记 · ' +
        list.length +
        (filtering ? " 篇结果" : " 篇") +
        "</span></div>"
    ];

    Array.from(groups.keys()).forEach(function (year) {
      var items = groups.get(year);
      html.push('<div class="year-group">');
      html.push(
        '<div class="year"><span class="year__num">' +
          year +
          '</span><span class="year__line"></span><span class="year__count">' +
          items.length +
          " 篇</span></div>"
      );
      items.forEach(function (post) {
        var url = UI.postUrl(post);
        var idx = posts.indexOf(post);
        html.push(
          '<article class="entry">' +
            '<a class="entry__thumb-link" href="' +
            url +
            '" tabindex="-1" aria-hidden="true">' +
            UI.coverMarkup(post, idx, "cover--thumb") +
            "</a>" +
            '<div class="entry__body">' +
            '<h3 class="entry__title"><a href="' +
            url +
            '">' +
            highlight(post.title) +
            "</a></h3>" +
            '<p class="entry__excerpt">' +
            highlight(post.excerpt) +
            "</p>" +
            '<div class="entry__foot">' +
            '<time datetime="' +
            post.date +
            '">' +
            UI.formatShort(post.date) +
            "</time>" +
            '<span class="meta__dot" aria-hidden="true"></span>' +
            "<span>" +
            UI.readingTime(post.content) +
            "</span>" +
            (post.tags || [])
              .map(function (t) {
                return (
                  '<button class="tag" type="button" data-tag="' +
                  UI.escapeHtml(t) +
                  '">' +
                  UI.escapeHtml(t) +
                  "</button>"
                );
              })
              .join("") +
            "</div>" +
            "</div>" +
            '<a class="entry__arrow" href="' +
            url +
            '" aria-label="阅读《' +
            UI.escapeHtml(post.title) +
            '》">' +
            arrowSvg() +
            "</a>" +
            "</article>"
        );
      });
      html.push("</div>");
    });

    listEl.innerHTML = html.join("");

    listEl.querySelectorAll("[data-tag]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTag(btn.getAttribute("data-tag"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function renderNote(list) {
    if (!noteEl) return;
    if (!state.q && state.tag === "全部") {
      noteEl.textContent = "共 " + posts.length + " 篇";
    } else {
      noteEl.textContent = "找到 " + list.length + " 篇";
    }
  }

  function render() {
    var list = posts.filter(matches);
    var filtering = Boolean(state.q) || state.tag !== "全部";

    if (featuredSection) featuredSection.hidden = filtering;
    if (!filtering) {
      var featured =
        posts.filter(function (p) {
          return p.featured;
        })[0] || posts[0];
      renderFeatured(featured);
    }

    renderList(list);
    renderNote(list);
    syncChips();
  }

  /* ---------- 状态变更 ---------- */
  function setTag(tag) {
    state.tag = tag || "全部";
    render();
    updateUrl();
  }

  function updateUrl() {
    try {
      var params = new URLSearchParams();
      if (state.tag !== "全部") params.set("tag", state.tag);
      if (state.q) params.set("q", state.q);
      var qs = params.toString();
      history.replaceState(null, "", qs ? "?" + qs : window.location.pathname);
    } catch (e) {
      /* file:// 下可能被拒绝，忽略即可 */
    }
  }

  /* ---------- 事件 ---------- */
  function bind() {
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.q = searchInput.value.trim();
        if (searchWrap) searchWrap.classList.toggle("is-filled", Boolean(searchInput.value));
        render();
        updateUrl();
      });
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          searchInput.value = "";
          state.q = "";
          if (searchWrap) searchWrap.classList.remove("is-filled");
          render();
          updateUrl();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (searchInput) searchInput.value = "";
        state.q = "";
        if (searchWrap) searchWrap.classList.remove("is-filled");
        render();
        updateUrl();
        if (searchInput) searchInput.focus();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (searchInput) searchInput.value = "";
        state.q = "";
        state.tag = "全部";
        if (searchWrap) searchWrap.classList.remove("is-filled");
        render();
        updateUrl();
      });
    }

    var latest = document.querySelector("[data-latest-link]");
    if (latest && posts[0]) latest.setAttribute("href", UI.postUrl(posts[0]));
  }

  /* ---------- 初始化 ---------- */
  function init() {
    fillSite();
    fillStats();
    renderFilters();
    bind();

    try {
      var params = new URLSearchParams(window.location.search);
      var tag = params.get("tag");
      var q = params.get("q");
      if (tag) state.tag = tag;
      if (q) {
        state.q = q;
        if (searchInput) {
          searchInput.value = q;
          if (searchWrap) searchWrap.classList.add("is-filled");
        }
      }
    } catch (e) {}

    var valid = allTags().map(function (p) {
      return p[0];
    });
    if (state.tag !== "全部" && valid.indexOf(state.tag) === -1) state.tag = "全部";

    render();
  }

  init();
})();
