/* AllSoft.asia 中英双语切换核心库
 * 用法：
 *   1. <head> 先加载词典 js/lang/en.core.js（+ 博客页另加 en.blog.js），再加载本文件
 *   2. 页面文本加 data-i18n="key"（普通文本/标题，支持内部 HTML）
 *      大段内容加 data-i18n-html="key"（整块替换 innerHTML）
 *      input 占位符加 data-i18n-ph="key"
 *      meta 标签加 data-i18n-meta="key"（替换 content）
 *   3. 语言切换按钮自动注入导航栏；也可用 ?lang=en / ?lang=zh 强制切换
 * 语言记忆：localStorage 'allsoft_lang'，默认中文（HTML 直出中文，SEO 友好）
 */
(function () {
  "use strict";

  var STORAGE_KEY = "allsoft_lang";
  var DICT = window.I18N_EN || {};
  var lang = "zh";
  var zhCache = {}; // key -> 中文原文（innerHTML 快照）
  var applied = false;

  function detect() {
    try {
      var p = new URLSearchParams(window.location.search);
      var forced = p.get("lang");
      if (forced === "en" || forced === "zh") {
        lang = forced;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
        return;
      }
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh") lang = saved;
    } catch (e) { /* 隐私模式等场景忽略 */ }
  }

  function t(key) {
    return DICT[key];
  }

  function apply() {
    if (!applied) applied = true;
    var isEn = lang === "en";
    document.documentElement.lang = isEn ? "en" : "zh-CN";
    document.documentElement.classList.toggle("lang-en", isEn);

    // 普通文本（data-i18n），支持元素内 HTML（如 <a>）
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute("data-i18n");
      if (!key) continue;
      if (!zhCache[key]) zhCache[key] = el.innerHTML;
      var trans = t(key);
      el.innerHTML = isEn && trans ? trans : zhCache[key];
    }

    // 大段 HTML（data-i18n-html）
    var bigs = document.querySelectorAll("[data-i18n-html]");
    for (var j = 0; j < bigs.length; j++) {
      var b = bigs[j];
      var bk = b.getAttribute("data-i18n-html");
      if (!bk) continue;
      var cacheKey = "html:" + bk;
      if (!zhCache[cacheKey]) zhCache[cacheKey] = b.innerHTML;
      var bt = t(bk);
      b.innerHTML = isEn && bt ? bt : zhCache[cacheKey];
    }

    // 占位符（data-i18n-ph）
    var phs = document.querySelectorAll("[data-i18n-ph]");
    for (var m = 0; m < phs.length; m++) {
      var ph = phs[m];
      var pk = ph.getAttribute("data-i18n-ph");
      if (pk && isEn && t(pk)) ph.setAttribute("placeholder", t(pk));
    }

    // meta content（data-i18n-meta，用于 description 等）
    var metas = document.querySelectorAll("meta[data-i18n-meta]");
    for (var n = 0; n < metas.length; n++) {
      var meta = metas[n];
      var mk = meta.getAttribute("data-i18n-meta");
      if (mk && isEn && t(mk)) meta.setAttribute("content", t(mk));
    }

    // 切换按钮文案
    var btn = document.getElementById("langSwitch");
    if (btn) btn.textContent = isEn ? "中" : "EN";
  }

  function toggle() {
    lang = lang === "en" ? "zh" : "en";
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    apply();
    // 通知页面（游戏/应用页的 JS 动态文本监听此事件刷新）
    try { window.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: lang } })); } catch (e) {}
  }

  window.AllSoftI18n = {
    toggle: toggle,
    current: function () { return lang; },
    isEn: function () { return lang === "en"; },
    // JS 动态文本取词：en 时返回词典值（无则 fallback），zh 时返回 fallback（页面直出的中文原文）
    t: function (key, fallback) {
      return (lang === "en" && DICT[key]) ? DICT[key] : (fallback !== undefined ? fallback : "");
    },
    apply: apply,
    dict: DICT
  };

  document.addEventListener("DOMContentLoaded", function () {
    detect();
    apply();

    // 自动注入语言切换按钮到导航栏（若页面未手工放置）
    if (!document.getElementById("langSwitch")) {
      var nav = document.getElementById("navLinks");
      if (nav) {
        var li = document.createElement("li");
        li.className = "nav-lang";
        var a = document.createElement("a");
        a.id = "langSwitch";
        a.href = "javascript:void(0)";
        a.className = "nav-lang-btn";
        a.title = "Language / 语言";
        a.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
        li.appendChild(a);
        nav.appendChild(li);
        apply();
      }
    } else {
      var btn = document.getElementById("langSwitch");
      if (btn) {
        btn.href = "javascript:void(0)";
        btn.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
      }
    }
  });
})();
