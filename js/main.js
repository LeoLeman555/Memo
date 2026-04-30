document.addEventListener("DOMContentLoaded", async () => {
  const basePath = getBasePath();

  await Promise.all([
    loadComponent("header", `${basePath}components/header.html`),
    loadComponent("footer", `${basePath}components/footer.html`)
  ]);

  requestAnimationFrame(() => {
    setActiveNav();
    initTOC();
    initObserver();
    initDecisionTables();
    initCarousel();
  });
});

/* =========================
   BASE PATH DETECTOR
========================= */
function getBasePath() {
  const path = window.location.pathname;

  if (path.includes("/pages/")) {
    return "../";
  }

  return "";
}

/* =========================
   COMPONENT LOADER
========================= */
async function loadComponent(id, file) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  try {
    const response = await fetch(file);

    if (!response.ok) {
      throw new Error(`Failed to load ${file} (${response.status})`);
    }

    const html = await response.text();
    element.innerHTML = html;
  } catch (error) {
    console.error(`Component loading error for ${file}:`, error);
  }
}

/* =========================
   ACTIVE NAV HEADER
========================= */
function setActiveNav() {
  const links = document.querySelectorAll(".navigation a");

  if (!links.length) {
    return;
  }

  const current = window.location.pathname.split("/").pop() || "index.html";

  links.forEach((link) => {
    const href = link.getAttribute("href");
    const cleanHref = href.split("/").pop();

    if (cleanHref === current) {
      link.classList.add("active");
    }
  });
}

/* =========================
   TABLE OF CONTENT (TOC)
========================= */
function initTOC() {
  const toc = document.getElementById("toc");
  const content = document.querySelector(".content");

  if (!toc || !content) {
    return;
  }

  const headings = content.querySelectorAll("h2, h3");

  toc.innerHTML = "";

  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = `section-${index}`;
    }

    const li = document.createElement("li");
    const link = document.createElement("a");

    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;

    if (heading.tagName === "H3") {
      li.classList.add("toc-sub");
    }

    li.appendChild(link);
    toc.appendChild(li);
  });

  toc.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      const target = document.querySelector(link.getAttribute("href"));

      if (!target) {
        return;
      }

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
  const links = document.querySelectorAll("#toc a");

  if (!sections.length || !links.length) {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const id = entry.target.id;

      links.forEach((link) => {
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

  sections.forEach((section) => observer.observe(section));
}

/* =========================
   DECISION TABLES
========================= */
function initDecisionTables() {
  const tables = document.querySelectorAll(".decision-table");

  if (!tables.length) {
    return;
  }

  tables.forEach((table) => {
    computeTableAverage(table);
  });
}

function computeTableAverage(table) {
  const rows = table.querySelectorAll("tbody tr");
  const colCount = table.querySelectorAll("thead th").length - 1;

  let sums = Array(colCount).fill(0);
  let weights = Array(colCount).fill(0);

  rows.forEach((row) => {
    const weight = parseFloat(row.dataset.weight || "1");
    const cells = row.querySelectorAll("td");

    for (let i = 1; i <= colCount; i++) {
      const dot = cells[i]?.querySelector(".score-dot");

      if (dot && dot.dataset.score) {
        const score = parseFloat(dot.dataset.score);

        sums[i - 1] += score * weight;
        weights[i - 1] += weight;
      }
    }
  });

  const averages = sums.map((sum, i) => (weights[i] ? sum / weights[i] : 0));
  const avgCells = table.querySelectorAll("tfoot .avg-cell");

  avgCells.forEach((cell, i) => {
    cell.innerHTML = renderAverage(averages[i]);
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
  if (score >= 4) {
    return "score-green-dark";
  }

  if (score >= 3.5) {
    return "score-green-light";
  }

  if (score >= 3) {
    return "score-yellow";
  }

  if (score >= 2) {
    return "score-orange";
  }

  if (score >= 1) {
    return "score-red";
  }

  return "score-black";
}

/* =========================
   IMAGE CAROUSEL
========================= */
function initCarousel() {
  const slides = document.querySelectorAll(".slide");
  const nextBtn = document.querySelector(".next");
  const prevBtn = document.querySelector(".prev");

  if (!slides.length || !nextBtn || !prevBtn) {
    return;
  }

  let currentIndex = 0;

  function showSlide(index) {
    slides.forEach((slide) => {
      slide.classList.remove("active");
    });

    slides[index].classList.add("active");
  }

  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % slides.length;
    showSlide(currentIndex);
  });

  prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    showSlide(currentIndex);
  });

  setInterval(() => {
    currentIndex = (currentIndex + 1) % slides.length;
    showSlide(currentIndex);
  }, 3000);
}