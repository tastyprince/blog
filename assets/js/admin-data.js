/* =============================================================
   写作台的“生成 data.js”模块（纯字符串拼接，不依赖 DOM）
   单独成文件，方便在 Node 里直接测试输出是否合法
   ============================================================= */

(function (global) {
  "use strict";

  function escapeTemplate(str) {
    return String(str == null ? "" : str)
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$\{/g, "\\${");
  }

  /* 去掉统一缩进，避免生成的文件里正文越缩越深 */
  function dedent(text) {
    var lines = String(text || "").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

    var widths = lines
      .filter(function (line) {
        return line.trim();
      })
      .map(function (line) {
        return line.match(/^[ \t]*/)[0].length;
      });
    var min = widths.length ? Math.min.apply(null, widths) : 0;

    return lines
      .map(function (line) {
        return line.slice(min).replace(/\s+$/, "");
      })
      .join("\n");
  }

  function serializeSite(site) {
    var out = ["  site: {"];
    Object.keys(site || {}).forEach(function (key) {
      var value = site[key];
      if (Array.isArray(value)) {
        out.push("    " + key + ": [");
        value.forEach(function (item, i) {
          var comma = i < value.length - 1 ? "," : "";
          if (item && typeof item === "object") {
            var parts = Object.keys(item).map(function (k) {
              return k + ": " + JSON.stringify(item[k]);
            });
            out.push("      { " + parts.join(", ") + " }" + comma);
          } else {
            out.push("      " + JSON.stringify(item) + comma);
          }
        });
        out.push("    ],");
      } else {
        out.push("    " + key + ": " + JSON.stringify(value) + ",");
      }
    });
    out.push("  },");
    return out.join("\n");
  }

  function serializePost(post) {
    var lines = [
      "    {",
      "      id: " + JSON.stringify(post.id || "") + ",",
      "      title: " + JSON.stringify(post.title || "") + ",",
      "      date: " + JSON.stringify(post.date || "") + ",",
      "      tags: [" +
        (post.tags || [])
          .map(function (t) {
            return JSON.stringify(t);
          })
          .join(", ") +
        "],",
      "      featured: " + (post.featured ? "true" : "false") + ",",
      "      cover: " + JSON.stringify(post.cover || "") + ",",
      "      bg: " + JSON.stringify(post.bg || "") + ",",
      "      excerpt: " + JSON.stringify(post.excerpt || "") + ","
    ];

    var content = dedent(String(post.content || ""));
    if (!content) {
      lines.push("      content: ``");
    } else {
      lines.push("      content: `");
      escapeTemplate(dedent(content))
        .split("\n")
        .forEach(function (line) {
          lines.push(line ? "        " + line : "");
        });
      lines.push("      `");
    }

    lines.push("    },");
    return lines.join("\n");
  }

  function buildDataFile(site, posts, stamp) {
    var time = stamp || new Date().toLocaleString("zh-CN", { hour12: false });
    var header = [
      "/* =============================================================",
      "   博客内容数据 —— 由写作台生成（" + time + "）",
      "   字段说明见 README.md；也可以直接手动编辑这个文件",
      "   ============================================================= */",
      ""
    ];
    var body = (posts || []).map(serializePost).join("\n\n");
    return (
      header.join("\n") +
      "\nwindow.BLOG = {\n" +
      serializeSite(site) +
      "\n  posts: [\n" +
      body +
      "\n  ]\n};\n"
    );
  }

  global.ArticleData = {
    escapeTemplate: escapeTemplate,
    dedent: dedent,
    serializeSite: serializeSite,
    serializePost: serializePost,
    buildDataFile: buildDataFile
  };
})(typeof window !== "undefined" ? window : globalThis);
