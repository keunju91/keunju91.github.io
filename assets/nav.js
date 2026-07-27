// ============================================================================
// 심플 네비 렌더러 (백엔드 없이 정적, 상대경로 대응)
// 로컬 프리뷰 (localhost:9100/) 와 subpath 배포 (username.github.io/eunju-space/)
// 모두에서 동작.
// ============================================================================

const NAV_ITEMS = [
  { file: "index",   label: "Home" },
  { file: "about",   label: "About" },
  { file: "blog",    label: "Blog" },
  { file: "hobbies", label: "Hobbies" },
  { file: "mahjong", label: "Mahjong", href: "mahjong/" },
];

// 현재 페이지 파일명 (예: "index", "about", "blog", "hobbies")
function currentKey() {
  const p = location.pathname.replace(/\/$/, "");
  const last = p.split("/").pop() || "index";
  return last.replace(/\.html$/, "") || "index";
}

function href(item) {
  if (item.href) return item.href;
  return item.file === "index" ? "./" : `${item.file}.html`;
}

export function renderNav(rootId = "navRoot", brand = "eunju kang") {
  const root = document.getElementById(rootId);
  if (!root) return;

  const key = currentKey();
  const links = NAV_ITEMS.map((item) => {
    const active = item.file === key || location.pathname.includes(`/${item.file}/`) ? " active" : "";
    return `<a href="${href(item)}" class="${active.trim()}">${item.label}</a>`;
  }).join("");

  root.innerHTML = `
    <div class="container nav-inner">
      <a href="./" class="brand">${brand}</a>
      <div class="nav-links">${links}</div>
    </div>
  `;
  root.classList.add("nav");
}
