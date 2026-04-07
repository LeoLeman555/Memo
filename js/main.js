document.addEventListener("DOMContentLoaded", async () => {
  await loadComponent("header", "components/header.html");
  await loadComponent("footer", "components/footer.html");
  setActiveNav();
  initTOC();
  initObserver();

});

async function loadComponent(id, file) {
  const element = document.getElementById(id);
  if (!element) return;
  const response = await fetch(file);
  element.innerHTML = await response.text();
}

function setActiveNav() {
  const links = document.querySelectorAll(".navigation a");
  const current = window.location.pathname.split("/").pop();
  links.forEach(link => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    }
  });
}

function initTOC() {
  const toc = document.getElementById("toc");
  const content = document.querySelector(".doc-content");
  if (!toc || !content) return;
  const headings = content.querySelectorAll("h2, h3");
  headings.forEach((heading, index) => {
		if (!heading.id) {
      heading.id = "section-" + index;
    }
		const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + heading.id;
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
        top: target.offsetTop - offset,
        behavior: "smooth"
      });
    });
  });
}

function initObserver() {
  const sections = document.querySelectorAll(".doc-content h2, .doc-content h3");
  if (!sections.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      const link = document.querySelector(`.sidebar a[href="#${id}"]`);
      if (!link) return;
      document.querySelectorAll(".sidebar a").forEach(a => {
        a.classList.remove("active");
      });
      link.classList.add("active");
    });
  }, {
    rootMargin: "-80px 0px -80% 0px",
    threshold: 0
  });
  sections.forEach(section => observer.observe(section));
}

// import { initComponents } from "./components.js";
// import { initTOC } from "./toc";

// document.addEventListener("DOMContentLoaded", async () => {
//   await initComponents();   // header + footer + nav active
//   initTOC();                // sommaire + observer + scroll
// });
