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

// Dona o ranking con un desglose exacto; si no existe, aviso de no disponible.
// total = usuarios (o sesiones) únicos. Si las filas suman más, es porque Analytics
// cuenta a un usuario en más de una fila (ej. visitas desde dos ciudades);
// entonces se muestran barras con % sobre el total y una nota, como en Analytics.
function mostrarDesglose(id, items, tipo, opciones, total = null) {
    if (!items) {
        noDisponible(id);
        return;
    }

    const suma = items.reduce((acumulado, item) => acumulado + item.valor, 0);
    const seRepite = Number.isFinite(total) && total > 0 && suma > total;

    if (tipo === "dona" && !seRepite) {
        renderDona(id, items, opciones);
        return;
    }

    renderRanking(id, items, { ...opciones, total: Number.isFinite(total) && total > 0 ? total : opciones.total });

    if (seRepite) {
        document.getElementById(id)?.insertAdjacentHTML("beforeend",
            `<p class="rank-note">Un usuario puede aparecer en más de una fila si Analytics lo registró con valores distintos (por ejemplo, visitas desde dos ciudades). Usuarios únicos en total: <b>${fmt(total)}</b>.</p>`);
    }
}

function renderizarAudiencia({ filas, metricas, filtrado }) {
    const paises = desglose("paises", filas, "PAISES", filtrado);
    const ciudades = desglose("ciudades", filas, "CIUDADES", filtrado);
    const regiones = desglose("regiones", filas, "REGIONES", filtrado);
    const total = metricas.totalUsuarios;

    colocarTexto("audUsuarios", dato(metricas.usuarios));
    colocarTexto("audUsuariosSub", metricas.usuarios !== null ? "Usuarios únicos" : "No disponible con este filtro");
    colocarTexto("audNuevos", dato(metricas.nuevos));
    colocarTexto("audRecurrentes", dato(metricas.recurrentes));
    colocarTexto("audRecurrentesSub", metricas.recurrentes !== null && total
        ? `${fmtPct(metricas.recurrentes / total, 0)} de los usuarios regresaron`
        : "Regresaron");
    // "Sin identificar" no se cuenta como país ni ciudad
    const identificados = lista => lista?.filter(item => item.nombre !== "Sin identificar") ?? null;
    const paisesReales = identificados(paises);
    const ciudadesReales = identificados(ciudades);

    colocarTexto("audPaises", paisesReales ? fmt(paisesReales.length) : NO_DISPONIBLE);
    colocarTexto("audPaisesSub", paisesReales?.[0] ? `Principal: ${paisesReales[0].nombre}` : "—");
    colocarTexto("audCiudades", ciudadesReales ? fmt(ciudadesReales.length) : NO_DISPONIBLE);
    colocarTexto("audCiudadesSub", ciudadesReales?.[0] ? `Principal: ${ciudadesReales[0].nombre}` : "—");

    mostrarDesglose("donaPaisesAudiencia", paises, "dona", { etiqueta: "Usuarios", columnas: ["País", "Usuarios activos"] }, metricas.usuarios);
    // No es dona: un usuario nuevo que regresó cuenta en las dos filas, igual que en Analytics
    mostrarDesglose("donaRecurrencia", metricas.nuevos !== null && metricas.recurrentes !== null && total
        ? [{ nombre: "Nuevos en el periodo", valor: metricas.nuevos }, { nombre: "Regresaron (recurrentes)", valor: metricas.recurrentes }]
        : null, "ranking", { columnas: ["Tipo de usuario", "Usuarios"], total });
    mostrarDesglose("rankCiudades", ciudades, "ranking", { columnas: ["Ciudad", "Usuarios activos"] }, metricas.usuarios);
    mostrarDesglose("rankRegiones", regiones, "ranking", { columnas: ["Región", "Usuarios activos"] }, metricas.usuarios);

    // Usuarios de cada título de página: dato exacto de Analytics por fila
    renderRanking(
        "rankUsuariosDashboard",
        filas.map(fila => ({ nombre: fila._titulo, valor: fila._usuarios })).sort((a, b) => b.valor - a.valor),
        { columnas: ["Título de página", "Usuarios activos"], limite: 10 }
    );
}

function renderizarTecnologia({ filas, metricas, filtrado }) {
    mostrarDesglose("donaSistemas", desglose("sistemas", filas, "SISTEMAS_OPERATIVOS", filtrado), "dona",
        { etiqueta: "Usuarios", columnas: ["Sistema operativo", "Usuarios activos"] }, metricas.usuarios);
    mostrarDesglose("donaDispositivos", desglose("dispositivos", filas, "CATEGORIAS_DISPOSITIVO", filtrado), "dona",
        { etiqueta: "Usuarios", columnas: ["Dispositivo", "Usuarios activos"] }, metricas.usuarios);
    mostrarDesglose("rankNavegadores", desglose("navegadores", filas, "NAVEGADORES", filtrado), "ranking",
        { columnas: ["Navegador", "Usuarios activos"] }, metricas.usuarios);
    mostrarDesglose("rankFuentes", desglose("fuentes", filas, "FUENTES_SESION", filtrado), "ranking",
        { columnas: ["Fuente", "Sesiones"] }, metricas.sesiones);
}

function renderizarInteraccion({ filas, metricas, filtrado }) {
    colocarTexto("intEventos", fmt(metricas.eventos));
    colocarTexto("intEventosSub", metricas.eventosPorSesion !== null ? `${fmt(metricas.eventosPorSesion, 1)} por sesión` : "Total registrado");
    colocarTexto("intVistas", fmt(metricas.vistas));
    colocarTexto("intVistasSub", metricas.vistasPorSesion !== null ? `${fmt(metricas.vistasPorSesion, 1)} por sesión` : "Páginas vistas");
    colocarTexto("intTasa", dato(metricas.tasaInteraccion, fmtPct));
    colocarTexto("intTasaSub", metricas.sesionesInteraccion !== null
        ? `${fmt(metricas.sesionesInteraccion)} de ${fmt(metricas.sesiones)} sesiones`
        : "No disponible con este filtro");
    colocarTexto("intTiempo", dato(metricas.tiempoPorSesion, fmtDuracion));
    colocarTexto("intTiempoSub", metricas.tiempoPorUsuario !== null
        ? `${fmtDuracion(metricas.tiempoPorUsuario)} por usuario activo`
        : "No disponible con este filtro");

    const dias = serieDiariaExacta(filtrado);

    if (dias) {
        renderLinea("chartEventos", [
            { nombre: "Eventos", color: COLORES[3], puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.eventos })) },
            { nombre: "Vistas", color: COLORES[2], puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.vistas })) }
        ]);
    } else {
        noDisponible("chartEventos", MENSAJE_SOLO_SIN_FILTRO);
    }

    // Los eventos se pueden sumar entre dashboards; sin filtro se usan los de Analytics
    renderColumnas("columnasEventos", desgloseExacto("eventos", filtrado) || agregarLista(filas, "EVENTOS"));

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
