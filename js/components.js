/** Load HTML component into a container */
async function loadComponent(id, file) {
  const element = document.getElementById(id);
  const response = await fetch(file);
  const html = await response.text();
  element.innerHTML = html;
}

/** Highlight active navigation link */
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

document.addEventListener("DOMContentLoaded", async () => {

  await loadComponent("header", "components/header.html");
  await loadComponent("footer", "components/footer.html");

  setActiveNav();

});