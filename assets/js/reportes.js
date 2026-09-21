let datosReportes = [];
let paginaActualReportes = 1;
const registrosPorPaginaReportes = 6;
let filtrosTablaReportes = {};

document.addEventListener("analytics:loaded", evento => {
    datosReportes = evento.detail.datos;
    cargarEmpresasReportes(datosReportes);
    cargarAreasReportes(datosReportes);
});

const columnasReportes = [
    ["ID", "ID"],
    ["EMPRESA", "EMPRESA"],
    ["CLAVE_ANALYTICS", "CLAVE_ANALYTICS"],
    ["TITULO_ANALYTICS", "TITULO_ANALYTICS"],
    ["TIPO_DASHBOARD", "TIPO_DASHBOARD"],
    ["ACTIVO", "ACTIVO"],
    ["USUARIOS_ACTIVOS", "USUARIOS_ACTIVOS"],
    ["SESIONES", "SESIONES"],
    ["VISTAS", "VISTAS"],
    ["TIEMPO_INTERACCION_MEDIO_POR_SESION", "TIEMPO_INTERACCION_MEDIO_POR_SESION"],
    ["SESIONES_CON_INTERACCION", "SESIONES_CON_INTERACCION"],
    ["PORCENTAJE_INTERACCIONES", "PORCENTAJE_INTERACCIONES"],
    ["USUARIOS_RECURRENTES", "USUARIOS_RECURRENTES"],
    ["TOTAL_USUARIOS", "TOTAL_USUARIOS"],
    ["TOTAL_EVENTOS", "TOTAL_EVENTOS"],
    ["PRIMER_ACCESO", "PRIMER_ACCESO"],
    ["ULTIMO_ACCESO", "ULTIMO_ACCESO"],
    ["ULTIMA_ACTIVIDAD", "ULTIMA_ACTIVIDAD"],
    ["NAVEGADORES", "NAVEGADORES"],
    ["SISTEMAS_OPERATIVOS", "SISTEMAS_OPERATIVOS"],
    ["CATEGORIAS_DISPOSITIVO", "CATEGORIAS_DISPOSITIVO"],
    ["PLATAFORMAS", "PLATAFORMAS"],
    ["CIUDADES", "CIUDADES"],
    ["PAISES", "PAISES"],
    ["REGIONES", "REGIONES"],
    ["FUENTES_SESION", "FUENTES_SESION"],
    ["URL_PAGINAS", "URL_PAGINAS"]
];

const columnasNumericasReportes = new Set([
    "ID",
    "USUARIOS_ACTIVOS",
    "SESIONES",
    "VISTAS",
    "SESIONES_CON_INTERACCION",
    "USUARIOS_RECURRENTES",
    "TOTAL_USUARIOS",
    "TOTAL_EVENTOS"
]);

function numeroSesiones(valor) {
    const texto = String(valor ?? "");
    const fecha = new Date(texto);
    const valorNormalizado = /^(1899|1900)-/.test(texto) && !Number.isNaN(fecha.getTime())
        ? Math.round((fecha.getTime() - Date.UTC(1899, 11, 30)) / 86400000)
        : texto.replace(/,/g, "");
    const numero = Number(valorNormalizado);
    return Number.isFinite(numero) ? numero : 0;
}

function fechaActividad(valor) {
    if (!valor) {
        return null;
    }

    const texto = String(valor).trim();
    const partes = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);

    if (partes) {
        const [, dia, mes, anio] = partes;
        return new Date(Number(anio), Number(mes) - 1, Number(dia));
    }

    const fecha = new Date(texto);

    if (!Number.isNaN(fecha.getTime())) {
        return fecha;
    }

    return null;
}

function claveFecha(fecha) {
    return [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0")
    ].join("-");
}

function textoFecha(fecha) {
    return fecha.toLocaleDateString("es-GT", {
        day: "2-digit",
        month: "short"
    });
}

function escaparTexto(texto) {
    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function formatearFechaAnalytics(valor) {
    const texto = String(valor);
    const fecha = new Date(texto);

    if (!Number.isNaN(fecha.getTime()) && /^(1899|1900)-/.test(texto)) {
        const inicio = Date.UTC(1899, 11, 30);
        const transcurrido = Math.max(fecha.getTime() - inicio, 0);
        const segundos = Math.floor(transcurrido / 1000);
        const horas = Math.floor(segundos / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);
        const segundosRestantes = segundos % 60;

        return [horas, minutos, segundosRestantes]
            .map(valor => String(valor).padStart(2, "0"))
            .join(":");
    }

    return valor;
}

const mesesCalendario = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function valorFechaLocal(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function textoFechaCalendario(valor) {
    if (!valor) {
        return "Seleccionar";
    }

    const fecha = new Date(`${valor}T00:00:00`);
    return Number.isNaN(fecha.getTime())
        ? "Seleccionar"
        : `${fecha.getDate()} ${mesesCalendario[fecha.getMonth()].slice(0, 3)} ${fecha.getFullYear()}`;
}

function inicializarCalendario(campoFecha, trigger, texto, calendario) {
    let vista = campoFecha.value
        ? new Date(`${campoFecha.value}T00:00:00`)
        : new Date();

    const cerrar = () => {
        calendario.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    };

    const dibujar = () => {
        const seleccionado = campoFecha.value;
        const primerDia = new Date(vista.getFullYear(), vista.getMonth(), 1);
        const diasMes = new Date(vista.getFullYear(), vista.getMonth() + 1, 0).getDate();
        const desplazamiento = (primerDia.getDay() + 6) % 7;
        const hoy = valorFechaLocal(new Date());
        const dias = [];

        for (let indice = 0; indice < desplazamiento; indice += 1) {
            dias.push('<span class="reportes-calendario-dia vacio"></span>');
        }

        for (let dia = 1; dia <= diasMes; dia += 1) {
            const fecha = new Date(vista.getFullYear(), vista.getMonth(), dia);
            const valor = valorFechaLocal(fecha);
            const clases = ["reportes-calendario-dia"];
            if (valor === seleccionado) clases.push("seleccionado");
            if (valor === hoy) clases.push("hoy");
            dias.push(`<button type="button" class="${clases.join(" ")}" data-fecha="${valor}">${dia}</button>`);
        }

        calendario.innerHTML = `<div class="reportes-calendario-cabecera">
            <strong>${mesesCalendario[vista.getMonth()]} ${vista.getFullYear()}</strong>
            <div><button type="button" class="reportes-calendario-nav" data-mes="anterior" aria-label="Mes anterior">‹</button><button type="button" class="reportes-calendario-nav" data-mes="siguiente" aria-label="Mes siguiente">›</button></div>
        </div><div class="reportes-calendario-semana"><span>LU</span><span>MA</span><span>MI</span><span>JU</span><span>VI</span><span>SA</span><span>DO</span></div><div class="reportes-calendario-dias">${dias.join("")}</div>`;
    };

    trigger.addEventListener("click", evento => {
        evento.stopPropagation();
        document.querySelectorAll(".reportes-calendario").forEach(otro => {
            if (otro !== calendario) otro.hidden = true;
        });
        vista = campoFecha.value ? new Date(`${campoFecha.value}T00:00:00`) : new Date();
        calendario.hidden = !calendario.hidden;
        trigger.setAttribute("aria-expanded", String(!calendario.hidden));
        if (!calendario.hidden) dibujar();
    });

    calendario.addEventListener("click", evento => {
        evento.stopPropagation();
        const navegacion = evento.target.closest("[data-mes]");
        if (navegacion) {
            vista.setMonth(vista.getMonth() + (navegacion.dataset.mes === "anterior" ? -1 : 1));
            dibujar();
            return;
        }

        const dia = evento.target.closest("[data-fecha]");
        if (dia) {
            campoFecha.value = dia.dataset.fecha;
            texto.textContent = textoFechaCalendario(campoFecha.value);
            cerrar();
            campoFecha.dispatchEvent(new Event("change", { bubbles: true }));
        }
    });

    texto.textContent = textoFechaCalendario(campoFecha.value);
}

function filtrarDatosReportes(empresas, area, desde = "", hasta = "") {
    const empresasActivas = Array.isArray(empresas) ? empresas : (empresas ? [empresas] : []);
    const fechaDesde = desde ? new Date(`${desde}T00:00:00`) : null;
    const fechaHasta = hasta ? new Date(`${hasta}T23:59:59`) : null;

    return datosReportes.filter(item => {
        const nombreEmpresa = String(item.EMPRESA || "").trim();
        const coincideEmpresa = !empresasActivas.length || empresasActivas.includes(nombreEmpresa);
        const coincideArea = !area || String(item.TIPO_DASHBOARD || "").trim() === area;
        const fecha = fechaActividad(
            item.ULTIMA_ACTIVIDAD || item.ULTIMO_ACCESO || item.PRIMER_ACCESO
        );
        const coincideDesde = !fechaDesde || (fecha && fecha >= fechaDesde);
        const coincideHasta = !fechaHasta || (fecha && fecha <= fechaHasta);
        return coincideEmpresa && coincideArea && coincideDesde && coincideHasta;
    });
}

function renderizarTablaReportes(empresa, area, textoBusqueda = "", columna = "", desde = "", hasta = "", mantenerPagina = false) {
    const cuerpo = document.getElementById("tablaReportesBody");
    const contador = document.getElementById("contadorReportes");
    const paginacion = document.getElementById("paginacionReportes");

    if (!cuerpo) {
        return;
    }

    if (!mantenerPagina) {
        paginaActualReportes = 1;
    }

    filtrosTablaReportes = { empresa, area, textoBusqueda, columna, desde, hasta };

    const datos = filtrarDatosReportes(empresa, area, desde, hasta).filter(item => {
        if (!textoBusqueda) {
            return true;
        }

        const valores = columna
            ? [item[columna]]
            : columnasReportes.map(([clave]) => item[clave]);

        return valores.some(valor =>
            String(valor ?? "").toLowerCase().includes(textoBusqueda.toLowerCase())
        );
    });

    const totalPaginas = Math.max(Math.ceil(datos.length / registrosPorPaginaReportes), 1);
    paginaActualReportes = Math.min(paginaActualReportes, totalPaginas);
    const inicio = (paginaActualReportes - 1) * registrosPorPaginaReportes;
    const datosPagina = datos.slice(inicio, inicio + registrosPorPaginaReportes);
    const filasPagina = datosPagina.map(item => `<tr>${columnasReportes.map(([clave]) => {
        const valor = item[clave] === null || item[clave] === undefined
            ? "-"
            : columnasNumericasReportes.has(clave)
                ? numeroSesiones(item[clave]).toLocaleString("es-GT")
            : ["PRIMER_ACCESO", "ULTIMO_ACCESO", "ULTIMA_ACTIVIDAD"].includes(clave)
                ? formatearFechaAnalytics(item[clave])
                : String(item[clave]);
        return `<td>${escaparTexto(valor)}</td>`;
    }).join("")}</tr>`);

    if (datosPagina.length) {
        while (filasPagina.length < registrosPorPaginaReportes) {
            filasPagina.push(`<tr class="paginacion-fila-vacia"><td colspan="${columnasReportes.length}"></td></tr>`);
        }
    }

    cuerpo.innerHTML = datosPagina.length
        ? filasPagina.join("")
        : `<tr><td colspan="${columnasReportes.length}" class="sin-datos">No hay información para mostrar.</td></tr>`;

    marcarColumnaReportes(columna);

    if (contador) {
        contador.textContent = datos.length
            ? `${inicio + 1}-${Math.min(inicio + registrosPorPaginaReportes, datos.length)} de ${datos.length} registros`
            : "0 registros";
    }

    if (paginacion) {
        paginacion.innerHTML = datos.length > registrosPorPaginaReportes
            ? `<button type="button" class="paginacion-reportes-boton" data-pagina="${paginaActualReportes - 1}" ${paginaActualReportes === 1 ? "disabled" : ""}>Anterior</button><span>Página ${paginaActualReportes} de ${totalPaginas}</span><button type="button" class="paginacion-reportes-boton" data-pagina="${paginaActualReportes + 1}" ${paginaActualReportes === totalPaginas ? "disabled" : ""}>Siguiente</button>`
            : "";
    }
}

function marcarColumnaReportes(columna) {
    const tabla = document.getElementById("tablaReportes");

    if (!tabla) {
        return;
    }

    tabla.querySelectorAll(".columna-seleccionada, .columna-oculta").forEach(celda => {
        celda.classList.remove("columna-seleccionada");
        celda.classList.remove("columna-oculta");
    });

    if (!columna) {
        return;
    }

    const indice = columnasReportes.findIndex(([clave]) => clave === columna);

    if (indice < 0) {
        return;
    }

    tabla.querySelectorAll("thead th, tbody td").forEach(celda => {
        if (celda.hasAttribute("colspan")) {
            return;
        }

        const esEmpresa = celda.cellIndex === 1;

        if (celda.cellIndex === indice) {
            celda.classList.add("columna-seleccionada");
        } else if (!esEmpresa) {
            celda.classList.add("columna-oculta");
        }
    });
}

function cambiarPaginaReportes(pagina) {
    paginaActualReportes = pagina;
    renderizarTablaReportes(
        filtrosTablaReportes.empresa,
        filtrosTablaReportes.area,
        filtrosTablaReportes.textoBusqueda,
        filtrosTablaReportes.columna,
        filtrosTablaReportes.desde,
        filtrosTablaReportes.hasta,
        true
    );
}

function cargarEmpresasReportes(datos) {
    const menu = document.getElementById("reportesEmpresaOpciones");
    const empresas = [...new Set(
        datos
            .map(item => String(item.EMPRESA || "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "es"));

    menu.innerHTML = empresas.map(empresa => `<label class="reportes-opcion-empresa"><input type="checkbox" value="${escaparTexto(empresa)}"><span>${escaparTexto(empresa)}</span></label>`).join("");
    establecerSelectorPersonalizado("reportesArea", "", "Todas las áreas");
    dibujarGraficaSesiones([], "");
    renderizarTablaReportes([], "");
}

function empresasSeleccionadas() {
    return [...document.querySelectorAll("#reportesEmpresaOpciones input:checked")].map(input => input.value);
}

function actualizarResumenEmpresas() {
    const seleccionadas = empresasSeleccionadas();
    const resumen = document.getElementById("reportesEmpresaResumen");
    resumen.textContent = seleccionadas.length
        ? `${seleccionadas.length} empresa${seleccionadas.length === 1 ? "" : "s"} seleccionada${seleccionadas.length === 1 ? "" : "s"}`
        : "Todas las empresas";
}

function establecerSelectorPersonalizado(nombre, valor, texto) {
    const resumen = document.getElementById(`${nombre}Resumen`);
    const opciones = document.getElementById(`${nombre}Opciones`);

    if (resumen) {
        resumen.textContent = texto;
    }

    opciones?.querySelectorAll(".reportes-opcion-simple").forEach(opcion => {
        opcion.classList.toggle("seleccionada", opcion.dataset.value === valor);
    });
}

function valorSelectorPersonalizado(nombre) {
    const opcion = document.querySelector(`#${nombre}Opciones .reportes-opcion-simple.seleccionada`);
    return opcion ? opcion.dataset.value : "";
}

function cargarAreasReportes(datos) {
    const menu = document.getElementById("reportesAreaOpciones");
    const areas = [...new Set(
        datos
            .map(item => String(item.TIPO_DASHBOARD || "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "es"));

    menu.innerHTML = [
        '<button type="button" class="reportes-opcion-simple seleccionada" data-value="">Todas las áreas</button>',
        ...areas.map(area => `<button type="button" class="reportes-opcion-simple" data-value="${escaparTexto(area)}">${escaparTexto(area)}</button>`)
    ].join("");
}

function mostrarBaseGrafica(mensaje) {
    const contenedor = document.getElementById("graficaSesiones");

    contenedor.innerHTML = `<svg viewBox="0 0 900 340" role="img" aria-label="Gráfica sin datos">
        <line x1="52" y1="292" x2="876" y2="292" class="line-chart-grid line-chart-base" />
        <line x1="52" y1="26" x2="52" y2="292" class="line-chart-axis-line" />
        <text x="52" y="320" class="line-chart-axis">Sin actividad</text>
        <text x="18" y="160" class="line-chart-axis-title" text-anchor="middle" transform="rotate(-90 18 160)">Sesiones</text>
        <text x="464" y="336" class="line-chart-axis-title" text-anchor="middle">Fechas</text>
        <text x="450" y="168" class="line-chart-empty-text" text-anchor="middle">${mensaje}</text>
    </svg>`;
}

function obtenerPuntosEmpresa(empresa, datos) {
    const sesionesPorFecha = {};

    datos
        .filter(item => String(item.EMPRESA || "").trim() === empresa)
        .forEach(item => {
            const fecha = fechaActividad(
                item.ULTIMA_ACTIVIDAD || item.ULTIMO_ACCESO || item.PRIMER_ACCESO
            );

            if (!fecha) {
                return;
            }

            const clave = claveFecha(fecha);
            sesionesPorFecha[clave] = {
                fecha,
                sesiones: (sesionesPorFecha[clave]?.sesiones || 0) + numeroSesiones(item.SESIONES)
            };
        });

    return sesionesPorFecha;
}

function construirRangoFechas(sesionesPorEmpresa) {
    const fechas = Object.values(sesionesPorEmpresa)
        .flatMap(registros => Object.values(registros))
        .sort((a, b) => a.fecha - b.fecha);

    if (!fechas.length) {
        return [];
    }

    const puntos = [];
    const primeraFecha = new Date(fechas[0].fecha);
    const ultimaFecha = new Date(fechas.at(-1).fecha);

    for (const fecha = primeraFecha; fecha <= ultimaFecha; fecha.setDate(fecha.getDate() + 1)) {
        puntos.push(new Date(fecha));
    }

    return puntos;
}

function dibujarGraficaSesiones(empresa, area, desde = "", hasta = "") {
    const contenedor = document.getElementById("graficaSesiones");
    const estado = document.getElementById("reportesEstado");
    const datosFiltrados = filtrarDatosReportes(empresa, area, desde, hasta);
    const empresasSeleccionadasActivas = Array.isArray(empresa)
        ? empresa
        : (empresa ? [empresa] : []);
    const sesionesPorEmpresa = {};

    datosFiltrados.forEach(item => {
        const nombre = String(item.EMPRESA || "").trim();

        if (nombre) {
            sesionesPorEmpresa[nombre] = (sesionesPorEmpresa[nombre] || 0) + numeroSesiones(item.SESIONES);
        }
    });

    const paleta = ["#011C3D", "#03254D", "#053161", "#074279", "#095392", "#0E76C0", "#34A9ED", "#9DE3F9"];
    const nombresEmpresas = empresasSeleccionadasActivas.length
        ? empresasSeleccionadasActivas
        : Object.keys(sesionesPorEmpresa);
    const empresas = nombresEmpresas
        .map(nombre => ({
            nombre,
            sesiones: sesionesPorEmpresa[nombre] || 0
        }))
        .sort((empresaA, empresaB) => empresaB.sesiones - empresaA.sesiones)
        .map((item, indice) => ({ ...item, color: paleta[indice % paleta.length] }));
    const totalSesiones = empresas.reduce((total, item) => total + item.sesiones, 0);

    if (!totalSesiones) {
        contenedor.innerHTML = `<div class="donut-vacio">No hay sesiones disponibles para mostrar.</div>`;
        if (estado) {
            estado.textContent = "No hay sesiones disponibles para mostrar.";
        }
        renderizarTablaReportes(empresa, area, "", "", desde, hasta);
        return;
    }

    const radio = 112;
    const circunferencia = 2 * Math.PI * radio;
    let acumulado = 0;
    const segmentos = empresas.map(item => {
        const longitud = item.sesiones / totalSesiones * circunferencia;
        const segmento = `<circle class="donut-segment" cx="180" cy="180" r="${radio}" stroke="${item.color}" stroke-dasharray="${longitud} ${circunferencia - longitud}" stroke-dashoffset="${-acumulado}" />`;
        acumulado += longitud;
        return segmento;
    }).join("");
    const leyenda = empresas.map(item => {
        const porcentaje = (item.sesiones / totalSesiones * 100).toFixed(1);
        return `<div class="donut-leyenda-item"><i style="background:${item.color}"></i><span class="donut-empresa">${escaparTexto(item.nombre)}</span><strong>${item.sesiones.toLocaleString("es-GT")}</strong><small>${porcentaje}%</small></div>`;
    }).join("");

    contenedor.innerHTML = `<div class="donut-contenido"><svg class="donut-grafica" viewBox="0 0 360 360" role="img" aria-label="Sesiones acumuladas por empresa">
        <circle class="donut-base" cx="180" cy="180" r="${radio}" />
        ${segmentos}
        <text x="180" y="174" class="donut-total">${totalSesiones.toLocaleString("es-GT")}</text>
        <text x="180" y="198" class="donut-total-label">SESIONES</text>
    </svg><div class="donut-leyenda">${leyenda}</div></div>`;
    if (estado) {
        estado.textContent = `${totalSesiones.toLocaleString("es-GT")} sesiones distribuidas entre ${empresas.length} empresa${empresas.length === 1 ? "" : "s"}.`;
    }
    renderizarTablaReportes(empresa, area, "", "", desde, hasta);
}

document.addEventListener("DOMContentLoaded", () => {
    const selector = document.getElementById("reportesEmpresaTrigger");
    const selectorArea = document.getElementById("reportesAreaTrigger");
    const buscador = document.getElementById("reportesBuscar");
    const selectorColumna = document.getElementById("reportesColumnaTrigger");
    const limpiarFiltros = document.getElementById("reportesLimpiarFiltros");
    const paginacion = document.getElementById("paginacionReportes");
    const fechaDesde = document.getElementById("reportesDesde");
    const fechaHasta = document.getElementById("reportesHasta");

    if (!selector || !selectorArea) {
        return;
    }

    const actualizarReportes = () => {
        const desde = fechaDesde.value;
        const hasta = fechaHasta.value;
        const empresas = empresasSeleccionadas();
        const area = valorSelectorPersonalizado("reportesArea");
        const columna = valorSelectorPersonalizado("reportesColumna");
        dibujarGraficaSesiones(empresas, area, desde, hasta);
        renderizarTablaReportes(
            empresas,
            area,
            buscador ? buscador.value.trim() : "",
            columna,
            desde,
            hasta
        );
    };

    selector.addEventListener("click", () => {
        const menu = document.getElementById("reportesEmpresaOpciones");
        const abierto = !menu.hidden;
        menu.hidden = abierto;
        selector.setAttribute("aria-expanded", String(!abierto));
    });
    [
        [selectorArea, "reportesArea"],
        [selectorColumna, "reportesColumna"]
    ].forEach(([trigger, nombre]) => {
        trigger.addEventListener("click", () => {
            const menu = document.getElementById(`${nombre}Opciones`);
            const abierto = !menu.hidden;

            ["reportesEmpresa", "reportesArea", "reportesColumna"].forEach(otroNombre => {
                const otroMenu = document.getElementById(`${otroNombre}Opciones`);
                const otroTrigger = document.getElementById(`${otroNombre}Trigger`);

                if (otroMenu && otroNombre !== nombre) {
                    otroMenu.hidden = true;
                    otroTrigger?.setAttribute("aria-expanded", "false");
                }
            });

            menu.hidden = abierto;
            trigger.setAttribute("aria-expanded", String(!abierto));
        });

        document.getElementById(`${nombre}Opciones`).addEventListener("click", evento => {
            const opcion = evento.target.closest(".reportes-opcion-simple");

            if (!opcion) {
                return;
            }

            establecerSelectorPersonalizado(nombre, opcion.dataset.value, opcion.textContent);
            const menu = document.getElementById(`${nombre}Opciones`);
            menu.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            actualizarReportes();
        });
    });
    document.getElementById("reportesEmpresaOpciones").addEventListener("change", () => {
        actualizarResumenEmpresas();
        actualizarReportes();
    });
    limpiarFiltros?.addEventListener("click", () => {
        document.querySelectorAll("#reportesEmpresaOpciones input[type=checkbox]").forEach(casilla => {
            casilla.checked = false;
        });
        actualizarResumenEmpresas();
        establecerSelectorPersonalizado("reportesArea", "", "Todas las áreas");
        establecerSelectorPersonalizado("reportesColumna", "", "Todas las columnas");
        fechaDesde.value = "";
        fechaHasta.value = "";
        document.getElementById("reportesDesdeTexto").textContent = "Seleccionar";
        document.getElementById("reportesHastaTexto").textContent = "Seleccionar";
        actualizarReportes();
    });
    paginacion?.addEventListener("click", evento => {
        const boton = evento.target.closest("[data-pagina]");

        if (boton && !boton.disabled) {
            cambiarPaginaReportes(Number(boton.dataset.pagina));
        }
    });
    document.addEventListener("click", evento => {
        const selectores = document.querySelectorAll(".reportes-selector-multiple, .reportes-selector-custom");
        const clicDentro = [...selectores].some(selectorPersonalizado => selectorPersonalizado.contains(evento.target));

        if (!clicDentro) {
            ["reportesEmpresa", "reportesArea", "reportesColumna"].forEach(nombre => {
                const menu = document.getElementById(`${nombre}Opciones`);
                const trigger = document.getElementById(`${nombre}Trigger`);

                if (menu) {
                    menu.hidden = true;
                    trigger?.setAttribute("aria-expanded", "false");
                }
            });
        }
    });
    fechaDesde.addEventListener("change", actualizarReportes);
    fechaHasta.addEventListener("change", actualizarReportes);
    inicializarCalendario(
        fechaDesde,
        document.getElementById("reportesDesdeTrigger"),
        document.getElementById("reportesDesdeTexto"),
        document.getElementById("reportesDesdeCalendario")
    );
    inicializarCalendario(
        fechaHasta,
        document.getElementById("reportesHastaTrigger"),
        document.getElementById("reportesHastaTexto"),
        document.getElementById("reportesHastaCalendario")
    );
    document.addEventListener("click", () => {
        document.querySelectorAll(".reportes-calendario").forEach(calendario => {
            calendario.hidden = true;
        });
        document.querySelectorAll(".reportes-fecha-trigger").forEach(trigger => {
            trigger.setAttribute("aria-expanded", "false");
        });
    });
    if (buscador) {
        buscador.addEventListener("input", () => {
            renderizarTablaReportes(
                empresasSeleccionadas(),
                valorSelectorPersonalizado("reportesArea"),
                buscador.value.trim(),
                valorSelectorPersonalizado("reportesColumna"),
                fechaDesde.value,
                fechaHasta.value
            );
        });
    }
    selectorColumna.addEventListener("change", () => {
        renderizarTablaReportes(
            empresasSeleccionadas(),
            valorSelectorPersonalizado("reportesArea"),
            buscador ? buscador.value.trim() : "",
            valorSelectorPersonalizado("reportesColumna"),
            fechaDesde.value,
            fechaHasta.value
        );
    });
});