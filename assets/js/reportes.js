let datosReportes = [];

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

function numeroSesiones(valor) {
    const numero = Number(String(valor ?? "").replace(/,/g, ""));
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

function filtrarDatosReportes(empresa, area, desde = "", hasta = "") {
    const fechaDesde = desde ? new Date(`${desde}T00:00:00`) : null;
    const fechaHasta = hasta ? new Date(`${hasta}T23:59:59`) : null;

    return datosReportes.filter(item => {
        const coincideEmpresa = !empresa || String(item.EMPRESA || "").trim() === empresa;
        const coincideArea = !area || String(item.TIPO_DASHBOARD || "").trim() === area;
        const fecha = fechaActividad(
            item.ULTIMA_ACTIVIDAD || item.ULTIMO_ACCESO || item.PRIMER_ACCESO
        );
        const coincideDesde = !fechaDesde || (fecha && fecha >= fechaDesde);
        const coincideHasta = !fechaHasta || (fecha && fecha <= fechaHasta);
        return coincideEmpresa && coincideArea && coincideDesde && coincideHasta;
    });
}

function renderizarTablaReportes(empresa, area, textoBusqueda = "", columna = "", desde = "", hasta = "") {
    const cuerpo = document.getElementById("tablaReportesBody");
    const contador = document.getElementById("contadorReportes");

    if (!cuerpo) {
        return;
    }

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

    cuerpo.innerHTML = datos.length
        ? datos.map(item => `<tr>${columnasReportes.map(([clave]) => {
            const valor = item[clave] === null || item[clave] === undefined
                ? "-"
                : String(item[clave]);
            return `<td>${escaparTexto(valor)}</td>`;
        }).join("")}</tr>`).join("")
        : `<tr><td colspan="${columnasReportes.length}" class="sin-datos">No hay información para mostrar.</td></tr>`;

    if (contador) {
        contador.textContent = `${datos.length} registro${datos.length === 1 ? "" : "s"}`;
    }
}

function cargarEmpresasReportes(datos) {
    const selector = document.getElementById("reportesEmpresa");
    const empresas = [...new Set(
        datos
            .map(item => String(item.EMPRESA || "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "es"));

    selector.innerHTML = '<option value="">Todas las empresas</option>';

    empresas.forEach(empresa => {
        const opcion = document.createElement("option");
        opcion.value = empresa;
        opcion.textContent = empresa;
        selector.appendChild(opcion);
    });

    selector.value = "";
    document.getElementById("reportesArea").value = "";
    dibujarGraficaSesiones("", "");
    renderizarTablaReportes("", "");
}

function cargarAreasReportes(datos) {
    const selector = document.getElementById("reportesArea");
    const areas = [...new Set(
        datos
            .map(item => String(item.TIPO_DASHBOARD || "").trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "es"));

    selector.innerHTML = '<option value="">Todas las áreas</option>';

    areas.forEach(area => {
        const opcion = document.createElement("option");
        opcion.value = area;
        opcion.textContent = area;
        selector.appendChild(opcion);
    });
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
    const sesionesPorEmpresa = {};

    datosFiltrados.forEach(item => {
        const nombre = String(item.EMPRESA || "").trim();

        if (nombre) {
            sesionesPorEmpresa[nombre] = (sesionesPorEmpresa[nombre] || 0) + numeroSesiones(item.SESIONES);
        }
    });

    const paleta = ["#011C3D", "#03254D", "#053161", "#074279", "#095392", "#0E76C0", "#34A9ED", "#9DE3F9"];
    const empresas = Object.entries(sesionesPorEmpresa)
        .filter(([, sesiones]) => sesiones > 0)
        .sort(([, sesionesA], [, sesionesB]) => sesionesB - sesionesA)
        .map(([nombre, sesiones], indice) => ({ nombre, sesiones, color: paleta[indice % paleta.length] }));
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
    const selector = document.getElementById("reportesEmpresa");
    const selectorArea = document.getElementById("reportesArea");
    const buscador = document.getElementById("reportesBuscar");
    const selectorColumna = document.getElementById("reportesColumna");
    const fechaDesde = document.getElementById("reportesDesde");
    const fechaHasta = document.getElementById("reportesHasta");

    if (!selector || !selectorArea) {
        return;
    }

    const actualizarReportes = () => {
        const desde = fechaDesde.value;
        const hasta = fechaHasta.value;
        dibujarGraficaSesiones(selector.value, selectorArea.value, desde, hasta);
        renderizarTablaReportes(
            selector.value,
            selectorArea.value,
            buscador ? buscador.value.trim() : "",
            selectorColumna.value,
            desde,
            hasta
        );
    };

    selector.addEventListener("change", actualizarReportes);
    selectorArea.addEventListener("change", actualizarReportes);
    fechaDesde.addEventListener("change", actualizarReportes);
    fechaHasta.addEventListener("change", actualizarReportes);
    if (buscador) {
        buscador.addEventListener("input", () => {
            renderizarTablaReportes(
                selector.value,
                selectorArea.value,
                buscador.value.trim(),
                selectorColumna.value,
                fechaDesde.value,
                fechaHasta.value
            );
        });
    }
    selectorColumna.addEventListener("change", () => {
        renderizarTablaReportes(
            selector.value,
            selectorArea.value,
            buscador ? buscador.value.trim() : "",
            selectorColumna.value,
            fechaDesde.value,
            fechaHasta.value
        );
    });
});