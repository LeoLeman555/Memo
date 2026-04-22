document.addEventListener("DOMContentLoaded", async () => {
  await loadComponent("header", "components/header.html");
  await loadComponent("footer", "components/footer.html");

  setActiveNav();
  initTOC();
  initObserver();
});

/* =========================
   COMPONENT LOADER
========================= */
async function loadComponent(id, file) {
  const element = document.getElementById(id);
  if (!element) return;

  const response = await fetch(file);
  element.innerHTML = await response.text();
}

/* =========================
   ACTIVE NAV HEADER
========================= */
function setActiveNav() {
  const links = document.querySelectorAll(".navigation a");
  const current = window.location.pathname.split("/").pop();

  links.forEach(link => {
    const href = link.getAttribute("href");
    if (href === current) {
      link.classList.add("active");
    }
  });
}

/* =========================
   TABLE OF CONTENT (TOC)
========================= */
function initTOC() {
  const toc = document.getElementById("toc");
  const content = document.querySelector(".content"); // FIX IMPORTANT

  if (!toc || !content) return;

  const headings = content.querySelectorAll("h2, h3");

  toc.innerHTML = ""; // évite duplication si reload

  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = `section-${index}`;
    }

    const li = document.createElement("li");
    const a = document.createElement("a");

    a.href = `#${heading.id}`;
    a.textContent = heading.textContent;

    li.appendChild(a);

    if (heading.tagName === "H3") {
      li.classList.add("toc-sub");
    }

    toc.appendChild(li);
  });

  toc.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;

      const offset = 80;

      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - offset,
        behavior: "smooth"
      });
    });
  });
}

/* =========================
   ACTIVE SECTION OBSERVER
========================= */
function initObserver() {
  const sections = document.querySelectorAll(".content h2, .content h3");

  if (!sections.length) return;

  const links = document.querySelectorAll("#toc a");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const id = entry.target.id;

      links.forEach(link => {
        link.classList.remove("active");
      });

      const activeLink = document.querySelector(`#toc a[href="#${id}"]`);
      if (activeLink) {
        activeLink.classList.add("active");
      }
    });
  }, {
    root: null,
    rootMargin: "-100px 0px -70% 0px",
    threshold: 0
  });

  sections.forEach(section => observer.observe(section));
}
function initDecisionTables() {
  document.querySelectorAll(".decision-table").forEach(table => {
    computeTableAverage(table);
  });
}

function computeTableAverage(table) {
  const rows = table.querySelectorAll("tbody tr");
  const colCount = table.querySelectorAll("thead th").length - 1;

  let sums = Array(colCount).fill(0);
  let weights = Array(colCount).fill(0);

  rows.forEach(row => {
    const weight = parseFloat(row.dataset.weight || "1");
    const cells = row.querySelectorAll("td");

    for (let i = 1; i <= colCount; i++) {
      const dot = cells[i].querySelector(".score-dot");

      if (dot && dot.dataset.score) {
        const score = parseFloat(dot.dataset.score);

        sums[i - 1] += score * weight;
        weights[i - 1] += weight;
      }
    }
  });

  const averages = sums.map((s, i) => weights[i] ? (s / weights[i]) : 0);

  const avgCells = table.querySelectorAll("tfoot .avg-cell");

  avgCells.forEach((cell, i) => {
    const avg = averages[i];

    cell.innerHTML = renderAverage(avg);
  });
}

function renderAverage(avg) {
  return `
    <div class="score avg-cell-inner">
      <span class="score-dot ${getScoreClass(avg)}"></span>
      <span class="score-text">${avg.toFixed(2)} / 5</span>
    </div>
  `;
}

function getScoreClass(score) {
  if (score >= 4) return "score-green-dark";
  if (score >= 3.5) return "score-green-light";
  if (score >= 3) return "score-yellow";
  if (score >= 2) return "score-orange";
  if (score >= 1) return "score-red";
  return "score-black";
}

document.addEventListener("DOMContentLoaded", initDecisionTables);