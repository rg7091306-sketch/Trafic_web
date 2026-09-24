// =====================================================
// ESTADÍSTICAS — audiencia, tecnología y eventos
// =====================================================

const PESTANAS_ESTADISTICAS = ["audiencia", "tecnologia", "interaccion"];
let ultimoDetalleEstadisticas = null;
let pestanaEstadisticas = "audiencia";

function cambiarPestanaEstadisticas(pestana) {
    pestanaEstadisticas = pestana;

    document.querySelectorAll("#tabsEstadisticas .tab-btn").forEach(boton => {
        boton.classList.toggle("active", boton.dataset.tab === pestana);
    });
    PESTANAS_ESTADISTICAS.forEach(nombre => {
        const panel = document.getElementById(`tab-${nombre}`);
        if (panel) panel.hidden = nombre !== pestana;
    });

    // Se vuelve a dibujar para que las barras y líneas animen al mostrarse.
    if (ultimoDetalleEstadisticas) {
        renderizarPestana(pestana, ultimoDetalleEstadisticas);
    }
}

function renderizarAudiencia({ filas, metricas, filtrado }) {
    const paises = agregarLista(filas, "PAISES");
    const ciudades = agregarLista(filas, "CIUDADES");
    const totalPaises = paises.reduce((suma, item) => suma + item.valor, 0);

    colocarTexto("audUsuarios", fmt(metricas.usuarios));
    colocarTexto("audUsuariosSub", filtrado ? "Suma por dashboard (aprox.)" : "Usuarios únicos");
    colocarTexto("audNuevos", fmt(metricas.nuevos));
    colocarTexto("audRecurrentes", fmt(metricas.recurrentes));
    colocarTexto("audRecurrentesSub", metricas.nuevos + metricas.recurrentes
        ? `${fmtPct(metricas.recurrentes / (metricas.nuevos + metricas.recurrentes), 0)} regresaron`
        : "Regresaron");
    colocarTexto("audPaises", fmt(paises.length));
    colocarTexto("audPaisesSub", paises[0] ? `Principal: ${paises[0].nombre}` : "—");
    colocarTexto("audCiudades", fmt(ciudades.length));
    colocarTexto("audCiudadesSub", ciudades[0] ? `Principal: ${ciudades[0].nombre}` : "—");

    renderRanking("rankPaises", paises, { columnas: ["País", "Usuarios activos"], total: totalPaises });
    renderDona("donaRecurrencia", [
        { nombre: "Recurrentes", valor: metricas.recurrentes },
        { nombre: "Nuevos", valor: metricas.nuevos }
    ], { etiqueta: "Usuarios", colores: [COLORES[4], COLORES[1]] });
    renderRanking("rankCiudades", ciudades, { columnas: ["Ciudad", "Usuarios activos"] });
    renderRanking("rankRegiones", agregarLista(filas, "REGIONES"), { columnas: ["Región", "Usuarios activos"] });
    renderRanking(
        "rankUsuariosDashboard",
        filas.map(fila => ({ nombre: fila._titulo, valor: fila._usuarios })).sort((a, b) => b.valor - a.valor),
        { columnas: ["Título de página", "Usuarios activos"], limite: 10 }
    );
}

function renderizarTecnologia({ filas, metricas }) {
    renderRanking("rankSistemas", agregarLista(filas, "SISTEMAS_OPERATIVOS"), { columnas: ["Sistema operativo", "Usuarios activos"] });
    renderDona("donaDispositivos", agregarLista(filas, "CATEGORIAS_DISPOSITIVO"), {
        etiqueta: "Usuarios",
        centro: fmt(metricas.usuarios),
        mostrarValor: false
    });
    renderRanking("rankNavegadores", agregarLista(filas, "NAVEGADORES"), { columnas: ["Navegador", "Usuarios activos"] });
    renderRanking("rankFuentes", agregarLista(filas, "FUENTES_SESION"), { columnas: ["Fuente", "Sesiones"] });
}

function renderizarInteraccion({ filas, metricas }) {
    colocarTexto("intEventos", fmt(metricas.eventos));
    colocarTexto("intEventosSub", `${fmt(metricas.eventosPorSesion, 1)} por sesión`);
    colocarTexto("intVistas", fmt(metricas.vistas));
    colocarTexto("intVistasSub", `${fmt(metricas.vistasPorSesion, 1)} por sesión`);
    colocarTexto("intTasa", fmtPct(metricas.tasaInteraccion));
    colocarTexto("intTasaSub", `≈ ${fmt(metricas.sesionesInteraccion)} sesiones con interacción`);
    colocarTexto("intTiempo", fmtDuracion(metricas.tiempoPorSesion));
    colocarTexto("intTiempoSub", `${fmtDuracion(metricas.tiempoPorUsuario)} por usuario activo`);

    const dias = serieDiaria(filas, "_ultimaActividad", {
        eventos: fila => fila._eventos,
        vistas: fila => fila._vistas
    });

    renderLinea("chartEventos", [
        { nombre: "Eventos", color: COLORES[3], puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.eventos })) },
        { nombre: "Vistas", color: COLORES[2], puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.vistas })) }
    ]);

    renderColumnas("columnasEventos", agregarLista(filas, "EVENTOS"));

    renderRanking(
        "rankTiempo",
        filas
            .filter(fila => fila._sesiones > 0)
            .map(fila => ({ nombre: fila._titulo, valor: fila._segundosSesion }))
            .sort((a, b) => b.valor - a.valor),
        { columnas: ["Título de página", "Tiempo medio"], formato: fmtDuracion, limite: 8 }
    );

    const cuerpo = document.getElementById("tablaInteraccion");

    if (!cuerpo) {
        return;
    }

    const ordenadas = [...filas].sort((a, b) => b._sesiones - a._sesiones || b._vistas - a._vistas);

    cuerpo.innerHTML = ordenadas.length
        ? ordenadas.map(fila => {
            const tasa = fila._tasaInteraccion;
            const claseTasa = tasa >= .7 ? "pill-ok" : tasa >= .4 ? "pill-warn" : "pill-error";
            return `
                <tr>
                    <td><div class="cell-main">${escaparHTML(fila._empresa)}</div>${fila.CLAVE_ANALYTICS && fila.CLAVE_ANALYTICS !== "-" ? `<div class="cell-sub">${escaparHTML(fila.CLAVE_ANALYTICS)}</div>` : ""}</td>
                    <td class="nowrap">${escaparHTML(fila._area)}</td>
                    <td class="num">${fmt(fila._usuarios)}</td>
                    <td class="num">${fmt(fila._sesiones)}</td>
                    <td class="num">${fmt(fila._sesionesInteraccion)}</td>
                    <td class="num">${fila._sesiones ? `<span class="pill ${claseTasa}">${fmtPct(tasa, 0)}</span>` : '<span class="pill pill-muted">—</span>'}</td>
                    <td class="num">${fmtDuracion(fila._segundosSesion)}</td>
                    <td class="num">${fmt(fila._vistas)}</td>
                    <td class="num">${fmt(fila._eventos)}</td>
                    <td class="nowrap">${fmtFecha(fila._ultimaActividad, true)}</td>
                </tr>`;
        }).join("")
        : '<tr><td colspan="10" class="empty-cell">Sin dashboards para el filtro seleccionado.</td></tr>';
}

function renderizarPestana(pestana, detalle) {
    if (pestana === "audiencia") renderizarAudiencia(detalle);
    if (pestana === "tecnologia") renderizarTecnologia(detalle);
    if (pestana === "interaccion") renderizarInteraccion(detalle);
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tabsEstadisticas")?.addEventListener("click", evento => {
        const boton = evento.target.closest(".tab-btn");
        if (boton) cambiarPestanaEstadisticas(boton.dataset.tab);
    });
});

document.addEventListener("analytics:actualizado", ({ detail }) => {
    ultimoDetalleEstadisticas = detail;
    renderizarPestana(pestanaEstadisticas, detail);
});
