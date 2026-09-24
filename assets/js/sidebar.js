// =====================================================
// SIDEBAR — mismo comportamiento que el dashboard centralizado:
// en escritorio se colapsa, en tablet/celular se abre como panel.
// =====================================================

const ANCHO_MENU_MOVIL = 1024;

function menuEsMovil() {
    return window.innerWidth <= ANCHO_MENU_MOVIL;
}

function alternarSidebar() {
    if (menuEsMovil()) {
        document.body.classList.toggle("sidebar-open");
    } else {
        document.body.classList.toggle("sidebar-collapsed");
    }
}

function cerrarSidebarMovil() {
    document.body.classList.remove("sidebar-open");
}

document.addEventListener("click", evento => {
    if (evento.target.closest("[data-sidebar-toggle]")) {
        alternarSidebar();
        return;
    }

    if (evento.target.closest("#sidebarBackdrop")) {
        cerrarSidebarMovil();
        return;
    }

    const cabecera = evento.target.closest(".nav-section-header");
    if (cabecera) {
        cabecera.closest(".nav-section").classList.toggle("expanded");
    }
});

document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
        cerrarSidebarMovil();
    }
});

// El menú se escribe aquí (y no con fetch a un .html) para que también
// funcione al abrir las páginas con doble clic (file://), donde fetch está bloqueado.
const SIDEBAR_HTML = `
<aside class="sidebar" id="sidebar">
    <div class="brand">
        <img class="brand-mark" src="../img/logo.png" alt="Logo de Red Intelfon">
        <div class="brand-text">
            <span class="brand-name">Red Intelfon</span>
            <small>CONECTAMOS TU MUNDO</small>
        </div>
    </div>

    <nav class="sidebar-menu">
        <a class="nav-item" href="index.html">
            <span class="nav-icon"><img src="../img/general.png" alt=""></span>
            <span>Control General</span>
        </a>
        <a class="nav-item" href="reportes.html">
            <span class="nav-icon"><img src="../img/reportes.png" alt=""></span>
            <span>Reportes</span>
        </a>
        <a class="nav-item" href="estadisticas.html">
            <span class="nav-icon"><img src="../img/grafica.png" alt=""></span>
            <span>Estadísticas</span>
        </a>
    </nav>

    <div class="sidebar-footer">
        <div class="ga-status" id="gaStatus"><i></i><span>Conectando con Google Analytics…</span></div>
        <div class="footer-copy">© 2026 Red Intelfon</div>
        <div class="footer-copy">Todos los derechos reservados.</div>
    </div>
</aside>
<div class="sidebar-backdrop" id="sidebarBackdrop" aria-hidden="true"></div>`;

document.addEventListener("DOMContentLoaded", () => {
    const contenedor = document.getElementById("sidebar-container");

    if (!contenedor) {
        return;
    }

    contenedor.innerHTML = SIDEBAR_HTML;

    const paginaActual = window.location.pathname.split("/").pop() || "index.html";
    contenedor.querySelectorAll(".nav-item").forEach(enlace => {
        enlace.classList.toggle("active", enlace.getAttribute("href") === paginaActual);
    });

    document.dispatchEvent(new Event("sidebar:loaded"));
});
