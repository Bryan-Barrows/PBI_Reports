// Shared data loading + small helpers used by every page.

async function loadLeagueData() {
  const res = await fetch("data/league-data.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load league data (${res.status})`);
  return res.json();
}

function formatDate(iso) {
  if (!iso) return "never (not yet fetched)";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function winPct(wins, losses, ties) {
  const games = wins + losses + ties;
  if (games === 0) return "0.000";
  return ((wins + ties * 0.5) / games).toFixed(3).replace(/^0/, "0");
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function emptyState(message) {
  return el("div", { class: "empty-state" }, [
    el("p", {}, message),
  ]);
}

function setActiveNav() {
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav.site-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === path) a.classList.add("active");
  });
}

function setLastUpdated(data) {
  const target = document.getElementById("last-updated");
  if (target) target.textContent = `Data last updated: ${formatDate(data.lastUpdated)}`;
}

document.addEventListener("DOMContentLoaded", setActiveNav);
