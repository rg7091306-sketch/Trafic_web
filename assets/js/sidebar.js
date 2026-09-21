document.addEventListener("DOMContentLoaded", async () => {
    const contenedor = document.getElementById("sidebar-container");

    if (!contenedor) {
        return;
    }

    try {
        const respuesta = await fetch("../components/sidebar.html");

        if (!respuesta.ok) {
            throw new Error(`No se pudo cargar el sidebar: ${respuesta.status}`);
        }

        contenedor.innerHTML = await respuesta.text();

        const paginaActual = window.location.pathname.split("/").pop() || "index.html";
        contenedor.querySelectorAll(".nav-btn").forEach(enlace => {
            enlace.classList.toggle("active", enlace.getAttribute("href") === paginaActual);
        });

        document.dispatchEvent(new Event("sidebar:loaded"));
    } catch (error) {
        console.error(error);
    }
});
