export type Theme = "dark" | "light";

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("pmp_theme", theme);
}

export function initTheme() {
  const saved: Theme = localStorage.getItem("pmp_theme") === "dark" ? "dark" : "light";
  setTheme(saved);
}

export function toggleTheme() {
  const cur = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
  setTheme(cur === "dark" ? "light" : "dark");
}
