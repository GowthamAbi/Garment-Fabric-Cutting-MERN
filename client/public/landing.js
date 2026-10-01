const menu = document.getElementById("menu");
const links = document.getElementById("links");

menu.addEventListener("click", () => links.classList.toggle("open"));
links.addEventListener("click", () => links.classList.remove("open"));

if (window.location.pathname === "/pricing") {
  window.requestAnimationFrame(() =>
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }),
  );
}
