/* AllSoft.asia 夜间主题切换
 * 用法：页面引入本文件即可（建议放在 i18n.js 之后）
 * - 导航栏自动注入 🌙/☀️ 切换按钮（页面无 #navLinks 时不注入，可手工放 #themeSwitch）
 * - localStorage 'allsoft_theme' 记忆（'dark'/'light'）；未设置时跟随系统 prefers-color-scheme
 * - html.dark 类控制暗色变量（见 css/style.css）
 */
(function () {
  "use strict";

  var STORAGE_KEY = "allsoft_theme";

  function systemPrefersDark() {
    try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
    catch (e) { return false; }
  }

  function detect() {
    try {
      var p = new URLSearchParams(location.search);
      var t = p.get("theme");
      if (t === "dark" || t === "light") return t;
    } catch (e) {}
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === "dark") return "dark";
    if (saved === "light") return "light";
    return systemPrefersDark() ? "dark" : "light";
  }

  function apply(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    var btn = document.getElementById("themeSwitch");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    var icon = document.getElementById("themeIcon");
    if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  function toggle() {
    var next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    apply(next);
  }

  window.AllSoftTheme = {
    toggle: toggle,
    current: function () { return document.documentElement.classList.contains("dark") ? "dark" : "light"; }
  };

  // 尽量早应用（防闪烁）：在 head 里内联调用或此处立即执行
  apply(detect());

  document.addEventListener("DOMContentLoaded", function () {
    apply(detect());
    var btn = document.getElementById("themeSwitch");
    if (!btn) {
      var nav = document.getElementById("navLinks");
      if (nav) {
        var li = document.createElement("li");
        li.className = "nav-lang";
        var a = document.createElement("a");
        a.id = "themeSwitch";
        a.href = "javascript:void(0)";
        a.className = "nav-lang-btn";
        a.title = "Theme / 主题";
        a.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
        li.appendChild(a);
        nav.appendChild(li);
        apply(detect());
      }
    } else {
      btn.href = "javascript:void(0)";
      btn.addEventListener("click", function (e) { e.preventDefault(); toggle(); });
    }
  });
})();
