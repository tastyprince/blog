/* =============================================================
   外观预设与颜色工具
   被 design-loader.js（应用）和 design-studio.js（编辑器）共用
   ============================================================= */

(function (global) {
  "use strict";

  var PRESETS = {
    terracotta: {
      label: "暖纸 · 陶土",
      hint: "米色纸面 + 陶土红",
      accent: "#a8573c",
      light: {
        bg: "#f3ebdd",
        bgDeep: "#ece1cf",
        paper: "#fbf5ea",
        paper2: "#f7efe1",
        ink: "#2f2a24",
        inkSoft: "#574d42",
        muted: "#8b7c69",
        line: "#e2d5c0",
        lineStrong: "#d3c3aa"
      },
      dark: {
        bg: "#14110e",
        bgDeep: "#0f0d0b",
        paper: "#1d1915",
        paper2: "#221d18",
        ink: "#ece1d1",
        inkSoft: "#c3b5a2",
        muted: "#998874",
        line: "#2e2821",
        lineStrong: "#3d352c"
      }
    },

    forest: {
      label: "苔痕 · 墨绿",
      hint: "植物感 + 深绿",
      accent: "#3f6b4f",
      light: {
        bg: "#eef0e7",
        bgDeep: "#e3e7d8",
        paper: "#f9faf3",
        paper2: "#f3f5ea",
        ink: "#29312a",
        inkSoft: "#4d564c",
        muted: "#7d8878",
        line: "#dbe0d0",
        lineStrong: "#c8d0ba"
      },
      dark: {
        bg: "#0f1411",
        bgDeep: "#0b100d",
        paper: "#182019",
        paper2: "#1d261e",
        ink: "#e3ead9",
        inkSoft: "#b7c2ad",
        muted: "#8b9884",
        line: "#28332a",
        lineStrong: "#38463a"
      }
    },

    navy: {
      label: "远山 · 藏蓝",
      hint: "冷静 + 旧纸感",
      accent: "#3f5f7f",
      light: {
        bg: "#eef0f4",
        bgDeep: "#e3e7ee",
        paper: "#f8fafc",
        paper2: "#f1f4f8",
        ink: "#232a33",
        inkSoft: "#48535f",
        muted: "#7b8794",
        line: "#dbe1e8",
        lineStrong: "#c6cfd9"
      },
      dark: {
        bg: "#0d1016",
        bgDeep: "#090c11",
        paper: "#161c24",
        paper2: "#1b222b",
        ink: "#e2e8ef",
        inkSoft: "#b3bdca",
        muted: "#8792a0",
        line: "#252d37",
        lineStrong: "#35404d"
      }
    },

    mauve: {
      label: "薄暮 · 藕紫",
      hint: "柔和 + 一点旧梦",
      accent: "#7a4a63",
      light: {
        bg: "#f1ebef",
        bgDeep: "#e8dfe5",
        paper: "#faf6f8",
        paper2: "#f4edf1",
        ink: "#2e2930",
        inkSoft: "#554d57",
        muted: "#8b7f8a",
        line: "#e2d6dd",
        lineStrong: "#d0c1ca"
      },
      dark: {
        bg: "#120f13",
        bgDeep: "#0d0a0e",
        paper: "#1c171e",
        paper2: "#221c24",
        ink: "#eae0e8",
        inkSoft: "#c4b6c0",
        muted: "#998b96",
        line: "#2d252f",
        lineStrong: "#3d3340"
      }
    }
  };

  function hexToRgb(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) {
      h = h
        .split("")
        .map(function (c) {
          return c + c;
        })
        .join("");
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function toHex(n) {
    var v = Math.max(0, Math.min(255, Math.round(n)));
    return ("0" + v.toString(16)).slice(-2);
  }

  /* 把 a 往 b 混 t（0-1），返回 #rrggbb */
  function mix(a, b, t) {
    var ca = hexToRgb(a);
    var cb = hexToRgb(b);
    var ratio = Math.max(0, Math.min(1, t));
    return (
      "#" +
      toHex(ca.r + (cb.r - ca.r) * ratio) +
      toHex(ca.g + (cb.g - ca.g) * ratio) +
      toHex(ca.b + (cb.b - ca.b) * ratio)
    );
  }

  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + alpha + ")";
  }

  function palette(presetName, accentOverride) {
    var preset = PRESETS[presetName] || PRESETS.terracotta;
    var accent = /^#[0-9a-fA-F]{6}$/.test(String(accentOverride || ""))
      ? accentOverride
      : preset.accent;

    var light = {};
    Object.keys(preset.light).forEach(function (key) {
      light[key] = preset.light[key];
    });
    light.accent = accent;
    light.accentDeep = mix(accent, "#000000", 0.16);
    light.accentSoft = mix(accent, "#ffffff", 0.3);
    light.accentWash = rgba(accent, 0.09);

    var darkAccent = mix(accent, "#ffffff", 0.24);
    var dark = {};
    Object.keys(preset.dark).forEach(function (key) {
      dark[key] = preset.dark[key];
    });
    dark.accent = darkAccent;
    dark.accentDeep = mix(accent, "#ffffff", 0.4);
    dark.accentSoft = mix(accent, "#000000", 0.1);
    dark.accentWash = rgba(darkAccent, 0.14);

    return { light: light, dark: dark };
  }

  var FONTS = {
    serif:
      '"Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", Georgia, "Times New Roman", serif',
    sans:
      'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    kai: '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif'
  };

  global.DESIGN_PRESETS = PRESETS;
  global.DesignColor = {
    hexToRgb: hexToRgb,
    mix: mix,
    rgba: rgba,
    palette: palette,
    FONTS: FONTS
  };
})(typeof window !== "undefined" ? window : globalThis);
