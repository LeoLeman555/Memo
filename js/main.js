document.addEventListener("DOMContentLoaded", async () => {
  const basePath = getBasePath();

  await Promise.all([
    loadComponent("header", `${basePath}components/header.html`),
    loadComponent("footer", `${basePath}components/footer.html`)
  ]);

  normalizeInjectedPaths();

  requestAnimationFrame(() => {
    setActiveNav();
    initTOC();
    initObserver();
    initDecisionTables();
    initCarousel();
    initHeroZoom();
    initProjectGallery();
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

    element.innerHTML = await response.text();
  } catch (error) {
    console.error(`Component loading error for ${file}:`, error);
  }
}

/* =========================
   NORMALIZE INJECTED PATHS
========================= */
function normalizeInjectedPaths() {
  const basePath = getBasePath();

  document.querySelectorAll("[data-link]").forEach((element) => {
    const target = element.dataset.link;
    element.setAttribute("href", `${basePath}${target}`);
  });

  document.querySelectorAll("[data-src]").forEach((element) => {
    const target = element.dataset.src;
    element.setAttribute("src", `${basePath}${target}`);
  });
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

    if (!href) {
      return;
    }

    const cleanHref = href.split("/").pop();

    if (cleanHref === current) {
      link.classList.add("active");
    }
  });
}

/* =========================
   TABLE OF CONTENT
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

  sections.forEach((section) => {
    observer.observe(section);
  });
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

  const sums = Array(colCount).fill(0);
  const weights = Array(colCount).fill(0);

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

  const averages = sums.map((sum, index) => (
    weights[index] ? sum / weights[index] : 0
  ));

  const avgCells = table.querySelectorAll("tfoot .avg-cell");

  avgCells.forEach((cell, index) => {
    cell.innerHTML = renderAverage(averages[index]);
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
  const items = document.querySelectorAll(".gallery-item");
  const nextBtn = document.querySelector(".gallery-btn.next");
  const prevBtn = document.querySelector(".gallery-btn.prev");

  if (!items.length || !nextBtn || !prevBtn) {
    return;
  }

  let currentIndex = 0;
  let intervalId = null;

  function showItem(index) {
    items.forEach((item, i) => {
      item.classList.toggle("active", i === index);
    });
  }

  function next() {
    currentIndex = (currentIndex + 1) % items.length;
    showItem(currentIndex);
  }

  function prev() {
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    showItem(currentIndex);
  }

  function startAutoplay() {
    stopAutoplay();

    intervalId = setInterval(() => {
      next();
    }, 5000);
  }

  function stopAutoplay() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  nextBtn.addEventListener("click", () => {
    next();
    startAutoplay();
  });

  prevBtn.addEventListener("click", () => {
    prev();
    startAutoplay();
  });

  const carousel = document.querySelector(".gallery-carousel");

  if (carousel) {
    carousel.addEventListener("mouseenter", stopAutoplay);
    carousel.addEventListener("mouseleave", startAutoplay);
  }

  showItem(currentIndex);
  startAutoplay();
}

function initHeroZoom() {
  const hero = document.querySelector(".hero");
  const button = document.querySelector(".hero-btn");

  if (!hero || !button) {
    return;
  }

  button.addEventListener("mouseenter", () => {
    hero.classList.add("zoom");
  });

  button.addEventListener("mouseleave", () => {
    hero.classList.remove("zoom");
  });
}

function initProjectGallery() {
  const medias = document.querySelectorAll(".project-media");

  if (!medias.length) {
    return;
  }

  const galleries = {};

  document
    .querySelectorAll("[data-gallery-item]")
    .forEach((item) => {
      const gallery = item.dataset.galleryItem;

      if (!galleries[gallery]) {
        galleries[gallery] = [];
      }

      galleries[gallery].push({
        type: item.tagName.toLowerCase(),
        src: item.getAttribute("src")
      });
    });

  createLightbox();

  const lightbox = document.getElementById("lightbox");
  const content = document.getElementById("lightbox-media");
  const counter = document.getElementById("lightbox-counter");

  let currentGallery = [];
  let currentIndex = 0;

  medias.forEach((media) => {
    const galleryName = media.dataset.gallery;

    if (!galleryName || !galleries[galleryName]) {
      return;
    }

    media.style.cursor = "pointer";

    media.addEventListener("click", () => {
      currentGallery = galleries[galleryName];
      currentIndex = 0;

      openLightbox();
    });
  });

  function renderSlide() {
    const item = currentGallery[currentIndex];

    content.innerHTML = "";

    let element;

    if (item.type === "video") {
      element = document.createElement("video");

      element.src = item.src;
      element.controls = true;
      element.autoplay = true;
      element.className = "lightbox-video";
    } else {
      element = document.createElement("img");

      element.src = item.src;
      element.className = "lightbox-image";
    }

    content.appendChild(element);

    counter.textContent =
      `${currentIndex + 1} / ${currentGallery.length}`;
  }

  function openLightbox() {
    lightbox.classList.add("active");

    document.body.style.overflow = "hidden";

    renderSlide();
  }

  function closeLightbox() {
    lightbox.classList.remove("active");

    document.body.style.overflow = "";

    content.innerHTML = "";
  }

  function nextSlide() {
    currentIndex =
      (currentIndex + 1) % currentGallery.length;

    renderSlide();
  }

  function prevSlide() {
    currentIndex =
      (currentIndex - 1 + currentGallery.length)
      % currentGallery.length;

    renderSlide();
  }

  document
    .querySelector(".lightbox-next")
    .addEventListener("click", nextSlide);

  document
    .querySelector(".lightbox-prev")
    .addEventListener("click", prevSlide);

  document
    .querySelector(".lightbox-close")
    .addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("active")) {
      return;
    }

    switch (event.key) {
      case "ArrowRight":
        nextSlide();
        break;

      case "ArrowLeft":
        prevSlide();
        break;

      case "Escape":
        closeLightbox();
        break;
    }
  });
}

function createLightbox() {
  if (document.getElementById("lightbox")) {
    return;
  }

  const lightbox = document.createElement("div");

  lightbox.id = "lightbox";

  lightbox.innerHTML = `
    <div class="lightbox-overlay"></div>

    <button class="lightbox-close">
      ×
    </button>

    <button class="lightbox-prev">
      ⟨
    </button>

    <div class="lightbox-container">
      <div id="lightbox-media"></div>

      <div id="lightbox-counter"></div>
    </div>

    <button class="lightbox-next">
      ⟩
    </button>
  `;

  document.body.appendChild(lightbox);
}