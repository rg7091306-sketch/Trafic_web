// =====================================================
// REPORTES — filtros por empresa, área y fecha de actividad,
// distribución de sesiones y tabla completa con exportación CSV.
// =====================================================

const REGISTROS_POR_PAGINA = 10;

const COLUMNAS_REPORTE = [
    { clave: "ID", titulo: "ID", tipo: "numero" },
    { clave: "EMPRESA", titulo: "Empresa", tipo: "empresa" },
    { clave: "CLAVE_ANALYTICS", titulo: "Clave Analytics", tipo: "clave" },
    { clave: "TITULO_ANALYTICS", titulo: "Título Analytics", tipo: "largo" },
    { clave: "TIPO_DASHBOARD", titulo: "Tipo de dashboard", tipo: "texto" },
    { clave: "ACTIVO", titulo: "Activo", tipo: "activo" },
    { clave: "USUARIOS_ACTIVOS", titulo: "Usuarios activos", tipo: "numero" },
    { clave: "SESIONES", titulo: "Sesiones", tipo: "numero" },
    { clave: "VISTAS", titulo: "Vistas", tipo: "numero" },
    { clave: "TIEMPO_INTERACCION_MEDIO_POR_SESION", titulo: "Tiempo medio por sesión", tipo: "duracion" },
    { clave: "SESIONES_CON_INTERACCION", titulo: "Sesiones con interacción", tipo: "numero" },
    { clave: "PORCENTAJE_INTERACCIONES", titulo: "% interacción", tipo: "porcentaje" },
    { clave: "USUARIOS_RECURRENTES", titulo: "Usuarios recurrentes", tipo: "numero" },
    { clave: "TOTAL_USUARIOS", titulo: "Total usuarios", tipo: "numero" },
    { clave: "TOTAL_EVENTOS", titulo: "Total eventos", tipo: "numero" },
    { clave: "PRIMER_ACCESO", titulo: "Primer acceso", tipo: "fecha" },
    { clave: "ULTIMO_ACCESO", titulo: "Último acceso", tipo: "fecha" },
    { clave: "ULTIMA_ACTIVIDAD", titulo: "Última actividad", tipo: "fecha" },
    { clave: "NAVEGADORES", titulo: "Navegadores", tipo: "largo" },
    { clave: "SISTEMAS_OPERATIVOS", titulo: "Sistemas operativos", tipo: "largo" },
    { clave: "CATEGORIAS_DISPOSITIVO", titulo: "Dispositivos", tipo: "largo" },
    { clave: "PLATAFORMAS", titulo: "Plataformas", tipo: "largo" },
    { clave: "CIUDADES", titulo: "Ciudades", tipo: "largo" },
    { clave: "PAISES", titulo: "Países", tipo: "largo" },
    { clave: "REGIONES", titulo: "Regiones", tipo: "largo" },
    { clave: "FUENTES_SESION", titulo: "Fuentes de sesión", tipo: "largo" },
    { clave: "EVENTOS", titulo: "Eventos", tipo: "largo" },
    { clave: "URL_PAGINAS", titulo: "URL de páginas", tipo: "largo" }
];

// Columnas que siempre acompañan a la columna elegida
const COLUMNAS_FIJAS = ["EMPRESA", "TIPO_DASHBOARD"];

const Reportes = {
    empresas: new Set(),
    area: "",
    desde: "",
    hasta: "",
    columna: "",
    busqueda: "",
    pagina: 1
};


// =====================================================
// VALORES DE CELDA
// =====================================================

function textoCelda(fila, columna) {
    const valor = fila[columna.clave];

    if (valor === null || valor === undefined || valor === "") {
        return "-";
    }

    switch (columna.tipo) {
        case "numero": return fmt(numeroSeguro(valor));
        case "porcentaje": return fmtPct(proporcionSegura(valor));
        case "duracion": return fmtDuracion(duracionEnSegundos(valor));
        case "fecha": return fmtFecha(fechaSegura(valor), true);
        default: return String(valor);
    }
}

function celdaHTML(fila, columna) {
    const texto = textoCelda(fila, columna);
    const seguro = escaparHTML(texto);

    switch (columna.tipo) {
        case "numero":
        case "porcentaje":
        case "duracion":
            return `<td class="num">${seguro}</td>`;
        case "activo":
            return `<td><span class="pill ${fila._activo ? "pill-ok" : "pill-muted"}">${seguro}</span></td>`;
        case "clave":
            return `<td class="nowrap">${texto === "-" ? "-" : `<span class="pill pill-blue">${seguro}</span>`}</td>`;
        case "empresa":
            return `<td class="col-empresa"><div class="cell-main">${seguro}</div></td>`;
        case "fecha":
            return `<td class="nowrap">${seguro}</td>`;
        case "largo":
            return `<td class="trunc" title="${seguro}">${seguro}</td>`;
        default:
            return `<td class="nowrap">${seguro}</td>`;
    }
}

function columnasVisibles() {
    return Reportes.columna
        ? COLUMNAS_REPORTE.filter(columna => COLUMNAS_FIJAS.includes(columna.clave) || columna.clave === Reportes.columna)
        : COLUMNAS_REPORTE;
}


// =====================================================
// FILTRADO
// =====================================================

function filasReporte() {
    const desde = Reportes.desde ? new Date(`${Reportes.desde}T00:00:00`) : null;
    const hasta = Reportes.hasta ? new Date(`${Reportes.hasta}T23:59:59`) : null;

    return Analytics.todas.filter(fila => {
        const fecha = fila._ultimaActividad;
        return (!Reportes.empresas.size || Reportes.empresas.has(fila._empresa))
            && (!Reportes.area || fila._area === Reportes.area)
            && (!desde || (fecha && fecha >= desde))
            && (!hasta || (fecha && fecha <= hasta));
    });
}

function filasTabla(base) {
    const busqueda = normalizarTexto(Reportes.busqueda);

    if (!busqueda) {
        return base;
    }

    const columnas = columnasVisibles();
    return base.filter(fila => columnas.some(columna => normalizarTexto(textoCelda(fila, columna)).includes(busqueda)));
}


// =====================================================
// FILTROS: EMPRESA (múltiple), ÁREA, FECHAS
// =====================================================

function dibujarEmpresasReporte() {
    const lista = document.getElementById("repEmpresaLista");
    const busqueda = normalizarTexto(document.getElementById("repEmpresaBuscar")?.value);
    const empresas = valoresUnicos(Analytics.todas, "_empresa");
    const coincidencias = empresas.filter(empresa => !busqueda || normalizarTexto(empresa).includes(busqueda));

    lista.innerHTML = [
        `<button type="button" class="drop-opt${Reportes.empresas.size ? "" : " active"}" data-rep-todas><span class="drop-name">Todas las empresas</span></button>`,
        ...coincidencias.map(empresa => {
            const cantidad = Analytics.todas.filter(fila => fila._empresa === empresa).length;
            return `<label class="drop-opt${Reportes.empresas.has(empresa) ? " active" : ""}">
                <input type="checkbox" value="${escaparHTML(empresa)}"${Reportes.empresas.has(empresa) ? " checked" : ""}>
                <span class="drop-name" title="${escaparHTML(empresa)}">${escaparHTML(empresa)}</span>
                <span class="drop-count">${cantidad}</span>
            </label>`;
        })
    ].join("") + (coincidencias.length ? "" : '<div class="drop-empty">No hay empresas con esa búsqueda.</div>');

    colocarTexto("repEmpresaMeta", `${Reportes.empresas.size} seleccionadas · ${empresas.length} empresas`);

    const seleccion = [...Reportes.empresas];
    colocarTexto("repEmpresaLabel", !seleccion.length
        ? "Todas las empresas"
        : seleccion.length === 1 ? seleccion[0] : `${seleccion.length} empresas`);
    document.getElementById("repEmpresaTrigger").classList.toggle("has-value", seleccion.length > 0);
}

function dibujarAreasReporte() {
    const areas = valoresUnicos(Analytics.todas, "_area");

    document.getElementById("repAreaLista").innerHTML = [
        `<button type="button" class="drop-opt${Reportes.area ? "" : " active"}" data-rep-area=""><span class="drop-name">Todas las áreas</span></button>`,
        ...areas.map(area => {
            const cantidad = Analytics.todas.filter(fila => fila._area === area).length;
            return `<button type="button" class="drop-opt${Reportes.area === area ? " active" : ""}" data-rep-area="${escaparHTML(area)}"><span class="drop-name">${escaparHTML(area)}</span><span class="drop-count">${cantidad}</span></button>`;
        })
    ].join("");

    colocarTexto("repAreaLabel", Reportes.area || "Todas las áreas");
    document.getElementById("repAreaTrigger").classList.toggle("has-value", Boolean(Reportes.area));
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const vistasCalendario = { desde: new Date(), hasta: new Date() };

function fechaDesdeClave(clave) {
    const [anio, mes, dia] = clave.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
}

function textoFechaFiltro(clave, vacioTexto) {
    if (!clave) {
        return vacioTexto;
    }

    const fecha = fechaDesdeClave(clave);
    return `${fecha.getDate()} ${MESES[fecha.getMonth()].slice(0, 3)} ${fecha.getFullYear()}`;
}

function dibujarCalendario(tipo) {
    const panel = document.getElementById(tipo === "desde" ? "repDesdePanel" : "repHastaPanel");
    const vista = vistasCalendario[tipo];
    const seleccionado = Reportes[tipo];
    const minimo = tipo === "hasta" ? Reportes.desde : "";
    const maximo = tipo === "desde" ? Reportes.hasta : "";
    const hoy = claveDia(new Date());
    const primerDia = new Date(vista.getFullYear(), vista.getMonth(), 1);
    const diasMes = new Date(vista.getFullYear(), vista.getMonth() + 1, 0).getDate();
    const dias = Array.from({ length: (primerDia.getDay() + 6) % 7 }, () => "<span></span>");

    for (let dia = 1; dia <= diasMes; dia += 1) {
        const clave = claveDia(new Date(vista.getFullYear(), vista.getMonth(), dia));
        const clases = ["calendar-day"];
        if (clave === seleccionado) clases.push("selected");
        if (clave === hoy) clases.push("today");
        const fuera = (minimo && clave < minimo) || (maximo && clave > maximo);
        dias.push(`<button type="button" class="${clases.join(" ")}" data-fecha="${clave}"${fuera ? " disabled" : ""}>${dia}</button>`);
    }

    panel.innerHTML = `
        <div class="calendar-head">
            <strong>${MESES[vista.getMonth()]} ${vista.getFullYear()}</strong>
            <div>
                <button type="button" class="calendar-nav" data-mes="-1" aria-label="Mes anterior">‹</button>
                <button type="button" class="calendar-nav" data-mes="1" aria-label="Mes siguiente">›</button>
            </div>
        </div>
        <div class="calendar-week"><span>LU</span><span>MA</span><span>MI</span><span>JU</span><span>VI</span><span>SA</span><span>DO</span></div>
        <div class="calendar-days">${dias.join("")}</div>
        <div class="calendar-foot"><button type="button" class="filter-chip ghost" data-limpiar-fecha>Quitar fecha</button></div>`;
}

function actualizarEtiquetasFecha() {
    colocarTexto("repDesdeLabel", textoFechaFiltro(Reportes.desde, "Desde"));
    colocarTexto("repHastaLabel", textoFechaFiltro(Reportes.hasta, "Hasta"));
    document.getElementById("repDesdeTrigger").classList.toggle("has-value", Boolean(Reportes.desde));
    document.getElementById("repHastaTrigger").classList.toggle("has-value", Boolean(Reportes.hasta));
}

function inicializarCalendario(tipo) {
    const sufijo = tipo === "desde" ? "Desde" : "Hasta";
    const trigger = document.getElementById(`rep${sufijo}Trigger`);
    const panel = document.getElementById(`rep${sufijo}Panel`);

    trigger.addEventListener("click", () => {
        vistasCalendario[tipo] = Reportes[tipo] ? fechaDesdeClave(Reportes[tipo]) : new Date();
        dibujarCalendario(tipo);
        alternarPanel(trigger, panel);
    });

    panel.addEventListener("click", evento => {
        const navegacion = evento.target.closest("[data-mes]");

        if (navegacion) {
            const vista = vistasCalendario[tipo];
            vistasCalendario[tipo] = new Date(vista.getFullYear(), vista.getMonth() + Number(navegacion.dataset.mes), 1);
            dibujarCalendario(tipo);
            return;
        }

        const dia = evento.target.closest("[data-fecha]");
        const limpiar = evento.target.closest("[data-limpiar-fecha]");

        if (dia || limpiar) {
            Reportes[tipo] = dia ? dia.dataset.fecha : "";
            alternarPanel(trigger, panel, false);
            actualizarEtiquetasFecha();
            actualizarReportes();
        }
    });
}


// =====================================================
// RENDER
// =====================================================

function renderizarResumenReporte(filas) {
    // Sin filtros se usan los totales exactos de la API (sin usuarios ni sesiones repetidos)
    const sinFiltros = !Reportes.empresas.size && !Reportes.area && !Reportes.desde && !Reportes.hasta;
    const metricas = calcularMetricas(filas, sinFiltros);

    colocarTexto("repKpiDashboards", fmt(metricas.dashboards));
    colocarTexto("repKpiDashboardsSub", `${fmt(metricas.dashboardsUsados)} con sesiones`);
    colocarTexto("repKpiEmpresas", fmt(metricas.empresas));
    colocarTexto("repKpiSesiones", fmt(metricas.sesiones));
    colocarTexto("repKpiSesionesSub", `${fmtPct(metricas.tasaInteraccion, 0)} con interacción`);
    colocarTexto("repKpiVistas", fmt(metricas.vistas));
    colocarTexto("repKpiVistasSub", `${fmt(metricas.vistasPorSesion, 1)} por sesión`);
    colocarTexto("repKpiEventos", fmt(metricas.eventos));

    colocarTexto("repDonaCaption", Reportes.empresas.size
        ? `Sesiones sumadas de los dashboards de ${Reportes.empresas.size === 1 ? "la empresa seleccionada" : `${fmt(Reportes.empresas.size)} empresas seleccionadas`}`
        : "Sesiones sumadas de los dashboards de cada empresa");

    renderDona("repDona", agruparPor(filas, "_empresa", "_sesiones"), {
        etiqueta: "Empresas",
        centro: fmt(metricas.empresas),
        limite: 8
    });
}

function renderizarTablaReporte(base) {
    const columnas = columnasVisibles();
    const filas = filasTabla(base);
    const totalPaginas = Math.max(1, Math.ceil(filas.length / REGISTROS_POR_PAGINA));

    Reportes.pagina = Math.min(Math.max(Reportes.pagina, 1), totalPaginas);

    const inicio = (Reportes.pagina - 1) * REGISTROS_POR_PAGINA;
    const pagina = filas.slice(inicio, inicio + REGISTROS_POR_PAGINA);

    document.getElementById("repTablaWrap").classList.toggle("single-col", Boolean(Reportes.columna));
    document.getElementById("repTablaHead").innerHTML = columnas
        .map(columna => {
            const clases = [["numero", "porcentaje", "duracion"].includes(columna.tipo) ? "num" : "", columna.clave === Reportes.columna ? "col-focus" : ""]
                .filter(Boolean).join(" ");
            return `<th${clases ? ` class="${clases}"` : ""}>${escaparHTML(columna.titulo)}</th>`;
        })
        .join("");

    document.getElementById("repTablaBody").innerHTML = pagina.length
        ? pagina.map(fila => `<tr>${columnas.map(columna => celdaHTML(fila, columna)).join("")}</tr>`).join("")
        : `<tr><td colspan="${columnas.length}" class="empty-cell">No hay información para los filtros seleccionados.</td></tr>`;

    colocarTexto("repContador", filas.length
        ? `${fmt(filas.length)} registros${filas.length !== Analytics.todas.length ? ` de ${fmt(Analytics.todas.length)}` : ""}`
        : "0 registros");

    document.getElementById("repPaginacion").innerHTML = `
        <button type="button" class="filter-chip" data-pagina="${Reportes.pagina - 1}"${Reportes.pagina === 1 ? " disabled" : ""}>‹ Anterior</button>
        <button type="button" class="filter-chip" data-pagina="${Reportes.pagina + 1}"${Reportes.pagina === totalPaginas ? " disabled" : ""}>Siguiente ›</button>
        <span class="pag-info">${filas.length ? `<b>${fmt(inicio + 1)}–${fmt(inicio + pagina.length)}</b> de <b>${fmt(filas.length)}</b> · página ${Reportes.pagina} de ${totalPaginas}` : "Sin registros"}</span>`;
}

function actualizarReportes({ reiniciarPagina = true } = {}) {
    if (reiniciarPagina) {
        Reportes.pagina = 1;
    }

    const base = filasReporte();
    renderizarResumenReporte(base);
    renderizarTablaReporte(base);
}


// =====================================================
// EXPORTAR CSV (lo que se ve en la tabla, sin paginar)
// =====================================================

function exportarCSV() {
    const columnas = columnasVisibles();
    const filas = filasTabla(filasReporte());
    const celda = valor => `"${String(valor).replaceAll('"', '""')}"`;
    const lineas = [
        columnas.map(columna => celda(columna.titulo)).join(","),
        ...filas.map(fila => columnas.map(columna => celda(textoCelda(fila, columna))).join(","))
    ];

    const archivo = new Blob([`\ufeff${lineas.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = `trafico-web-reporte-${claveDia(new Date())}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(enlace.href);
}


// =====================================================
// EVENTOS
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    const barra = document.getElementById("filtrosReportes");

    if (!barra) {
        return;
    }

    const selectColumna = document.getElementById("repColumna");
    selectColumna.innerHTML = [
        '<option value="">Todas las columnas</option>',
        ...COLUMNAS_REPORTE
            .filter(columna => !COLUMNAS_FIJAS.includes(columna.clave))
            .map(columna => `<option value="${columna.clave}">${escaparHTML(columna.titulo)}</option>`)
    ].join("");

    const empresaTrigger = document.getElementById("repEmpresaTrigger");
    const empresaPanel = document.getElementById("repEmpresaPanel");
    const empresaBuscar = document.getElementById("repEmpresaBuscar");
    const areaTrigger = document.getElementById("repAreaTrigger");
    const areaPanel = document.getElementById("repAreaPanel");

    empresaTrigger.addEventListener("click", () => {
        alternarPanel(empresaTrigger, empresaPanel);
        if (!empresaPanel.hidden) empresaBuscar.focus();
    });
    empresaBuscar.addEventListener("input", dibujarEmpresasReporte);

    empresaPanel.addEventListener("change", evento => {
        const casilla = evento.target.closest("input[type=checkbox]");
        if (!casilla) return;

        if (casilla.checked) {
            Reportes.empresas.add(casilla.value);
        } else {
            Reportes.empresas.delete(casilla.value);
        }

        dibujarEmpresasReporte();
        actualizarReportes();
    });

    empresaPanel.addEventListener("click", evento => {
        if (evento.target.closest("[data-rep-todas]")) {
            Reportes.empresas.clear();
            dibujarEmpresasReporte();
            actualizarReportes();
        }
    });

    areaTrigger.addEventListener("click", () => alternarPanel(areaTrigger, areaPanel));
    areaPanel.addEventListener("click", evento => {
        const opcion = evento.target.closest("[data-rep-area]");
        if (!opcion) return;

        Reportes.area = opcion.dataset.repArea;
        alternarPanel(areaTrigger, areaPanel, false);
        dibujarAreasReporte();
        actualizarReportes();
    });

    inicializarCalendario("desde");
    inicializarCalendario("hasta");

    document.getElementById("repLimpiar").addEventListener("click", () => {
        Object.assign(Reportes, { area: "", desde: "", hasta: "", columna: "", busqueda: "" });
        Reportes.empresas.clear();
        empresaBuscar.value = "";
        selectColumna.value = "";
        document.getElementById("repBuscar").value = "";
        dibujarEmpresasReporte();
        dibujarAreasReporte();
        actualizarEtiquetasFecha();
        actualizarReportes();
    });

    document.getElementById("repBuscar").addEventListener("input", evento => {
        Reportes.busqueda = evento.target.value.trim();
        Reportes.pagina = 1;
        renderizarTablaReporte(filasReporte());
    });

    selectColumna.addEventListener("change", () => {
        Reportes.columna = selectColumna.value;
        Reportes.pagina = 1;
        renderizarTablaReporte(filasReporte());
    });

    document.getElementById("repPaginacion").addEventListener("click", evento => {
        const boton = evento.target.closest("[data-pagina]");
        if (!boton || boton.disabled) return;

        Reportes.pagina = Number(boton.dataset.pagina);
        renderizarTablaReporte(filasReporte());
    });

    document.getElementById("repExportar").addEventListener("click", exportarCSV);
});

document.addEventListener("analytics:actualizado", () => {
    if (!document.getElementById("filtrosReportes")) {
        return;
    }

    // Al refrescar se conservan los filtros que siguen existiendo.
    const empresas = new Set(valoresUnicos(Analytics.todas, "_empresa"));
    [...Reportes.empresas].forEach(empresa => {
        if (!empresas.has(empresa)) Reportes.empresas.delete(empresa);
    });
    if (Reportes.area && !Analytics.todas.some(fila => fila._area === Reportes.area)) {
        Reportes.area = "";
    }

    dibujarEmpresasReporte();
    dibujarAreasReporte();
    actualizarEtiquetasFecha();
    actualizarReportes({ reiniciarPagina: false });
});
