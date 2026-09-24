// =====================================================
// NÚCLEO DEL DASHBOARD DE TRÁFICO WEB
// Carga los datos de Analytics (Apps Script), los normaliza,
// aplica los filtros compartidos y ofrece las gráficas que usan
// todas las páginas. Cada página escucha "analytics:actualizado".
// =====================================================

const URL_API =
    "https://script.google.com/macros/s/AKfycbwV2FR9r5S2WNSzEy6kY86lcWsxmPvlWUa2Jr6G0cuCkBoytsWDjJ6I2Iq_AS83CteD/exec";

// Cada cuánto actualizar: 300000 ms = 5 minutos
const TIEMPO_ACTUALIZACION = 300000;

// Paleta de las gráficas: azules del diseño original + rojo de la marca
const COLORES = ["#0e76c0", "#d62828", "#34a9ed", "#053161", "#2a9d8f", "#f4a261", "#8e5ea2", "#9de3f9"];

const CLAVE_FILTROS = "trafico-web-filtros";

const Analytics = {
    todas: [],
    filas: [],
    resumen: null,
    actualizado: null,
    filtros: { area: "", empresa: "" }
};


// =====================================================
// UTILIDADES DE FORMATO
// =====================================================

function fmt(valor, decimales = 0) {
    return Number(valor || 0).toLocaleString("es-GT", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales
    });
}

function fmtPct(valor, decimales = 1) {
    return `${fmt((valor || 0) * 100, decimales)}%`;
}

// Mismo formato que Analytics: 11m 48s, 2m 35s, 45s, 1h 05m
function fmtDuracion(segundos) {
    const total = Math.round(segundos || 0);

    if (total < 60) {
        return `${total}s`;
    }

    if (total < 3600) {
        return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
    }

    return `${Math.floor(total / 3600)}h ${String(Math.floor(total % 3600 / 60)).padStart(2, "0")}m`;
}

function fmtFecha(fecha, conHora = false) {
    if (!fecha) {
        return "-";
    }

    return fecha.toLocaleString("es-GT", conHora
        ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
        : { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDiaCorto(fecha) {
    return fecha.toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
}

function escaparHTML(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function colocarTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function vacio(mensaje = "Sin datos para el filtro seleccionado.") {
    return `<div class="empty-box">${escaparHTML(mensaje)}</div>`;
}


// =====================================================
// LECTURA DE LOS VALORES QUE ENTREGA GOOGLE SHEETS
// =====================================================

// Sheets convierte algunos números pequeños en fechas seriales
// ("1899-12-31T06:02:04.000Z" = 1). Se regresan a número.
function convertirSerialAnalytics(valor) {
    const texto = String(valor ?? "");

    if (!/^(1899|1900)-/.test(texto)) {
        return valor;
    }

    const fecha = new Date(texto);

    if (Number.isNaN(fecha.getTime())) {
        return valor;
    }

    return Math.round((fecha.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
}

function numeroSeguro(valor) {
    const numero = Number(String(convertirSerialAnalytics(valor) ?? "").replace(/,/g, ""));
    return Number.isFinite(numero) ? numero : 0;
}

function proporcionSegura(valor) {
    const texto = String(valor ?? "").trim();

    if (texto.endsWith("%")) {
        return numeroSeguro(texto.slice(0, -1)) / 100;
    }

    const numero = numeroSeguro(texto);
    return numero > 1 ? numero / 100 : numero;
}

// "1 min y 11 s", "2 h y 3 min", "45 s", "00:01:11" -> segundos
function duracionEnSegundos(valor) {
    if (typeof valor === "number") {
        return valor;
    }

    const texto = normalizarTexto(valor);

    if (!texto || texto === "-") {
        return 0;
    }

    const reloj = texto.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (reloj) {
        return reloj[3] !== undefined
            ? Number(reloj[1]) * 3600 + Number(reloj[2]) * 60 + Number(reloj[3])
            : Number(reloj[1]) * 60 + Number(reloj[2]);
    }

    const parte = patron => Number((texto.match(patron) || [])[1] || 0);
    const horas = parte(/(\d+(?:\.\d+)?)\s*h/);
    const minutos = parte(/(\d+(?:\.\d+)?)\s*min/);
    const segundos = parte(/(\d+(?:\.\d+)?)\s*s(?:eg)?\b/);

    if (horas || minutos || segundos) {
        return horas * 3600 + minutos * 60 + segundos;
    }

    return numeroSeguro(texto);
}

// Fechas "dd/mm/aaaa hh:mm" o ISO. Cuando Sheets recibe "11/09/2026"
// lo interpreta como 9 de noviembre (mm/dd) y lo guarda como fecha;
// esas fechas quedan en el futuro y se corrigen intercambiando día y mes.
function fechaSegura(valor) {
    if (!valor || valor === "-") {
        return null;
    }

    const texto = String(valor).trim();
    const local = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);

    if (local) {
        return new Date(
            Number(local[3]), Number(local[2]) - 1, Number(local[1]),
            Number(local[4] || 0), Number(local[5] || 0), Number(local[6] || 0)
        );
    }

    const fecha = new Date(texto);

    if (Number.isNaN(fecha.getTime())) {
        return null;
    }

    const limite = Date.now() + 86400000;

    if (fecha.getTime() > limite && fecha.getDate() <= 12) {
        const corregida = new Date(
            fecha.getFullYear(), fecha.getDate() - 1, fecha.getMonth() + 1,
            fecha.getHours(), fecha.getMinutes(), fecha.getSeconds()
        );

        if (corregida.getTime() <= limite) {
            return corregida;
        }
    }

    return fecha;
}

// "Chrome (3), Firefox (1)" -> [{ nombre: "Chrome", valor: 3 }, ...]
function listaConConteo(valor) {
    const texto = String(valor ?? "").trim();

    if (!texto || texto === "-") {
        return [];
    }

    return texto
        .split(/,\s*(?![^()]*\))/)
        .map(parte => parte.trim())
        .filter(Boolean)
        .map(parte => {
            const coincidencia = parte.match(/^(.*?)\s*\((\d+)\)$/);
            return coincidencia
                ? { nombre: coincidencia[1].trim() || "(sin dato)", valor: Number(coincidencia[2]) }
                : { nombre: parte, valor: 1 };
        });
}

function normalizarRegistro(item) {
    const primerAcceso = fechaSegura(item.PRIMER_ACCESO);
    const ultimoAcceso = fechaSegura(item.ULTIMO_ACCESO);

    return {
        ...item,
        _empresa: String(item.EMPRESA || "Sin empresa").trim(),
        _area: String(item.TIPO_DASHBOARD || "Sin área").trim(),
        _titulo: String(item.TITULO_ANALYTICS || item.TIPO_DASHBOARD || "Sin título").trim(),
        _activo: normalizarTexto(item.ACTIVO) === "si",
        _usuarios: numeroSeguro(item.USUARIOS_ACTIVOS),
        _totalUsuarios: numeroSeguro(item.TOTAL_USUARIOS || item.USUARIOS_ACTIVOS),
        _recurrentes: numeroSeguro(item.USUARIOS_RECURRENTES),
        _sesiones: numeroSeguro(item.SESIONES),
        _sesionesInteraccion: numeroSeguro(item.SESIONES_CON_INTERACCION),
        _tasaInteraccion: proporcionSegura(item.PORCENTAJE_INTERACCIONES),
        _vistas: numeroSeguro(item.VISTAS),
        _eventos: numeroSeguro(item.TOTAL_EVENTOS),
        _segundosSesion: duracionEnSegundos(item.TIEMPO_INTERACCION_MEDIO_POR_SESION),
        _primerAcceso: primerAcceso,
        _ultimoAcceso: ultimoAcceso,
        _ultimaActividad: fechaSegura(item.ULTIMA_ACTIVIDAD) || ultimoAcceso || primerAcceso
    };
}


// =====================================================
// MÉTRICAS
// =====================================================

function sumar(filas, campo) {
    return filas.reduce((total, fila) => total + (fila[campo] || 0), 0);
}

function valoresUnicos(filas, campo) {
    return [...new Set(filas.map(fila => fila[campo]).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

// Sin filtros se usan los totales del resumen de la API, que no repiten
// usuarios que abrieron varios dashboards (coinciden con Analytics).
function calcularMetricas(filas, usarResumen) {
    const sesionesFilas = sumar(filas, "_sesiones");
    const segundosTotales = filas.reduce((total, fila) => total + fila._segundosSesion * fila._sesiones, 0);
    const sesionesInteraccion = sumar(filas, "_sesionesInteraccion");
    const recurrentes = sumar(filas, "_recurrentes");
    const resumen = usarResumen ? Analytics.resumen : null;

    // Con filtro, la suma por fila nunca puede superar el total real de la API.
    const tope = (valor, maximo) => (Number.isFinite(maximo) ? Math.min(valor, maximo) : valor);
    const general = Analytics.resumen || {};

    const usuarios = resumen?.usuariosActivos ?? tope(sumar(filas, "_usuarios"), general.usuariosActivos);
    const totalUsuarios = resumen?.usuariosTotales ?? tope(sumar(filas, "_totalUsuarios"), general.usuariosTotales);
    const sesiones = resumen?.sesiones ?? tope(sesionesFilas, general.sesiones);
    const vistas = resumen?.vistas ?? sumar(filas, "_vistas");
    const eventos = resumen?.eventos ?? sumar(filas, "_eventos");

    // Una sesión recorre varios dashboards, así que la suma por fila (sesionesFilas)
    // es mayor que las sesiones reales. La tasa se toma de las filas y se aplica
    // a las sesiones reales; el tiempo total sí es aditivo.
    const tasaInteraccion = sesionesFilas ? sesionesInteraccion / sesionesFilas : 0;
    const sesionesInteraccionEstimadas = tasaInteraccion * sesiones;

    // Misma idea para nuevos / recurrentes: proporción de las filas sobre el total real.
    const usuariosFilas = sumar(filas, "_totalUsuarios");
    const recurrentesAjustados = usuariosFilas
        ? Math.round(Math.min(recurrentes / usuariosFilas, 1) * totalUsuarios)
        : 0;

    return {
        exacto: Boolean(resumen),
        dashboards: filas.length,
        dashboardsUsados: filas.filter(fila => fila._sesiones > 0).length,
        empresas: valoresUnicos(filas, "_empresa").length,
        usuarios,
        totalUsuarios,
        sesiones,
        vistas,
        eventos,
        recurrentes: recurrentesAjustados,
        nuevos: Math.max(totalUsuarios - recurrentesAjustados, 0),
        sesionesInteraccion: sesionesInteraccionEstimadas,
        vistasPorSesion: sesiones ? vistas / sesiones : 0,
        eventosPorSesion: sesiones ? eventos / sesiones : 0,
        tasaInteraccion,
        tiempoPorSesion: sesiones ? segundosTotales / sesiones : 0,
        tiempoPorUsuario: usuarios ? segundosTotales / usuarios : 0,
        sesionesInteraccionPorUsuario: usuarios ? sesionesInteraccionEstimadas / usuarios : 0
    };
}

// Suma los conteos de un campo tipo "Chrome (3), Firefox (1)"
function agregarLista(filas, campo) {
    const mapa = new Map();

    filas.forEach(fila => {
        listaConConteo(fila[campo]).forEach(({ nombre, valor }) => {
            mapa.set(nombre, (mapa.get(nombre) || 0) + valor);
        });
    });

    return [...mapa]
        .map(([nombre, valor]) => ({ nombre, valor }))
        .sort((a, b) => b.valor - a.valor);
}

function agruparPor(filas, campo, campoValor) {
    const mapa = new Map();

    filas.forEach(fila => {
        mapa.set(fila[campo], (mapa.get(fila[campo]) || 0) + fila[campoValor]);
    });

    return [...mapa]
        .map(([nombre, valor]) => ({ nombre, valor }))
        .sort((a, b) => b.valor - a.valor);
}

function claveDia(fecha) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

// Serie día por día (con ceros en los días sin actividad) hasta hoy.
// metricas: { sesiones: fila => fila._sesiones, ... }
function serieDiaria(filas, campoFecha, metricas) {
    const mapa = new Map();

    filas.forEach(fila => {
        const fecha = fila[campoFecha];

        if (!fecha) {
            return;
        }

        const clave = claveDia(fecha);
        const acumulado = mapa.get(clave) || {};

        Object.entries(metricas).forEach(([nombre, obtener]) => {
            acumulado[nombre] = (acumulado[nombre] || 0) + obtener(fila);
        });

        mapa.set(clave, acumulado);
    });

    if (!mapa.size) {
        return [];
    }

    const claves = [...mapa.keys()].sort();
    const [anio, mes, dia] = claves[0].split("-").map(Number);
    const fin = new Date();
    fin.setHours(0, 0, 0, 0);
    const dias = [];

    for (const fecha = new Date(anio, mes - 1, dia); fecha <= fin; fecha.setDate(fecha.getDate() + 1)) {
        const valores = mapa.get(claveDia(fecha)) || {};
        const punto = { fecha: new Date(fecha) };

        Object.keys(metricas).forEach(nombre => {
            punto[nombre] = valores[nombre] || 0;
        });

        dias.push(punto);
    }

    return dias;
}


// =====================================================
// GRÁFICAS REUTILIZABLES
// =====================================================

function escalaEje(maximo, pasos = 4) {
    if (!maximo || maximo <= 0) {
        return { max: pasos, paso: 1 };
    }

    const crudo = maximo / pasos;
    const magnitud = 10 ** Math.floor(Math.log10(crudo));
    const normal = crudo / magnitud;
    const bonito = normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10;
    const paso = Math.max(bonito * magnitud, 1);

    return { max: Math.ceil(maximo / paso) * paso, paso };
}

// series: [{ nombre, color, puntos: [{ fecha, valor }] }]
// unidadEje: 60 para que un eje en segundos avance en minutos redondos
function renderLinea(id, series, { formato = valor => fmt(valor), mensajeVacio, unidadEje = 1, totales = true } = {}) {
    const contenedor = document.getElementById(id);

    if (!contenedor) {
        return;
    }

    const cantidad = series[0]?.puntos.length || 0;

    if (!cantidad || !series.some(serie => serie.puntos.some(punto => punto.valor > 0))) {
        contenedor.innerHTML = vacio(mensajeVacio || "Sin actividad para el filtro seleccionado.");
        return;
    }

    const ancho = 900;
    const alto = 250;
    const margen = { arriba: 14, derecha: 18, abajo: 30, izquierda: 58 };
    const anchoUtil = ancho - margen.izquierda - margen.derecha;
    const altoUtil = alto - margen.arriba - margen.abajo;
    const maximoSerie = Math.max(...series.flatMap(serie => serie.puntos.map(punto => punto.valor)));
    const unidad = maximoSerie >= unidadEje * 4 ? unidadEje : 1;
    const escalaBase = escalaEje(maximoSerie / unidad);
    const escala = { max: escalaBase.max * unidad, paso: escalaBase.paso * unidad };
    const x = indice => margen.izquierda + (cantidad === 1 ? anchoUtil / 2 : indice / (cantidad - 1) * anchoUtil);
    const y = valor => margen.arriba + altoUtil * (1 - valor / escala.max);

    let rejilla = "";
    for (let valor = 0; valor <= escala.max + 1e-9; valor += escala.paso) {
        rejilla += `<line class="chart-grid" x1="${margen.izquierda}" x2="${ancho - margen.derecha}" y1="${y(valor)}" y2="${y(valor)}"/>`
            + `<text class="chart-axis" x="${margen.izquierda - 8}" y="${y(valor) + 3}" text-anchor="end">${escaparHTML(formato(valor))}</text>`;
    }

    const salto = Math.max(1, Math.ceil(cantidad / 8));
    const fechas = series[0].puntos.map((punto, indice) => {
        const mostrar = indice % salto === 0 || (indice === cantidad - 1 && (cantidad - 1) % salto >= salto / 2);
        return mostrar
            ? `<text class="chart-axis" x="${x(indice)}" y="${alto - 8}" text-anchor="middle">${fmtDiaCorto(punto.fecha)}</text>`
            : "";
    }).join("");

    const trazos = series.map((serie, orden) => {
        const puntos = serie.puntos.map((punto, indice) => `${x(indice).toFixed(1)},${y(punto.valor).toFixed(1)}`).join(" ");
        const area = orden === 0
            ? `<polygon class="chart-area" fill="${serie.color}" points="${x(0)},${y(0)} ${puntos} ${x(cantidad - 1)},${y(0)}"/>`
            : "";
        const marcas = serie.puntos.map((punto, indice) =>
            `<circle class="chart-dot${indice === cantidad - 1 ? " last" : ""}" data-i="${indice}" cx="${x(indice).toFixed(1)}" cy="${y(punto.valor).toFixed(1)}" r="4" fill="${serie.color}"/>`
        ).join("");
        return `${area}<polyline class="chart-line" stroke="${serie.color}" points="${puntos}"/>${marcas}`;
    }).join("");

    const leyenda = series.map(serie => {
        const total = serie.total ?? serie.puntos.reduce((suma, punto) => suma + punto.valor, 0);
        return `<span><i style="background:${serie.color}"></i>${escaparHTML(serie.nombre)}${totales ? ` <b>${escaparHTML(formato(total))}</b>` : ""}</span>`;
    }).join("");

    contenedor.innerHTML = `
        <svg class="chart-play" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${escaparHTML(series.map(serie => serie.nombre).join(", "))} por día">
            ${rejilla}${fechas}
            <line class="chart-guide" x1="0" x2="0" y1="${margen.arriba}" y2="${margen.arriba + altoUtil}"/>
            ${trazos}
            <rect class="chart-hit" x="${margen.izquierda}" y="${margen.arriba}" width="${anchoUtil}" height="${altoUtil}"/>
        </svg>
        <div class="chart-tooltip"></div>
        <div class="chart-legend">${leyenda}</div>`;

    const svg = contenedor.querySelector("svg");
    const guia = svg.querySelector(".chart-guide");
    const tooltip = contenedor.querySelector(".chart-tooltip");
    const ocultar = () => {
        guia.classList.remove("on");
        svg.querySelectorAll(".chart-dot.on").forEach(punto => punto.classList.remove("on"));
        tooltip.classList.remove("open");
    };

    svg.querySelector(".chart-hit").addEventListener("mousemove", evento => {
        const caja = svg.getBoundingClientRect();
        const proporcion = caja.width / ancho;
        const posicion = (evento.clientX - caja.left) / proporcion;
        const indice = cantidad === 1
            ? 0
            : Math.min(cantidad - 1, Math.max(0, Math.round((posicion - margen.izquierda) / anchoUtil * (cantidad - 1))));

        ocultar();
        guia.setAttribute("x1", x(indice));
        guia.setAttribute("x2", x(indice));
        guia.classList.add("on");
        svg.querySelectorAll(`.chart-dot[data-i="${indice}"]`).forEach(punto => punto.classList.add("on"));

        tooltip.innerHTML = `<strong>${fmtFecha(series[0].puntos[indice].fecha)}</strong>`
            + series.map(serie => `<span><i style="background:${serie.color}"></i>${escaparHTML(serie.nombre)}<b>${escaparHTML(formato(serie.puntos[indice].valor))}</b></span>`).join("");
        tooltip.classList.add("open");

        const izquierda = x(indice) * proporcion;
        tooltip.style.left = `${izquierda + 190 > caja.width ? izquierda - 182 : izquierda + 12}px`;
        tooltip.style.top = "8px";
    });
    svg.addEventListener("mouseleave", ocultar);
}

// Lista tipo tabla de Analytics: nombre, valor y barra debajo
function renderRanking(id, items, { columnas = ["Nombre", "Valor"], formato = valor => fmt(valor), limite = 8, total = null } = {}) {
    const contenedor = document.getElementById(id);

    if (!contenedor) {
        return;
    }

    const visibles = items.filter(item => item.valor > 0).slice(0, limite);

    if (!visibles.length) {
        contenedor.innerHTML = vacio();
        return;
    }

    const maximo = Math.max(...visibles.map(item => item.valor), 1);

    contenedor.innerHTML = `
        <div class="rank-head"><span>${escaparHTML(columnas[0])}</span><span>${escaparHTML(columnas[1])}</span></div>
        ${visibles.map(item => `
            <div class="rank-row">
                <span class="rank-name" title="${escaparHTML(item.nombre)}">${escaparHTML(item.nombre)}</span>
                <span class="rank-value">${escaparHTML(formato(item.valor))}${total ? `<small>${fmtPct(item.valor / total)}</small>` : ""}</span>
                <div class="bar-track"><div class="bar-fill" data-ancho="${item.valor / maximo * 100}"></div></div>
            </div>`).join("")}`;

    requestAnimationFrame(() => {
        contenedor.querySelectorAll(".bar-fill").forEach(barra => {
            barra.style.width = `${barra.dataset.ancho}%`;
        });
    });
}

function limitarConOtros(items, limite) {
    const visibles = items.filter(item => item.valor > 0);

    if (visibles.length <= limite) {
        return visibles;
    }

    const resto = visibles.slice(limite - 1).reduce((suma, item) => suma + item.valor, 0);
    return [...visibles.slice(0, limite - 1), { nombre: "Otros", valor: resto }];
}

function renderDona(id, items, { etiqueta = "Total", formato = valor => fmt(valor), limite = 6, colores = COLORES, centro = null, mostrarValor = true } = {}) {
    const contenedor = document.getElementById(id);

    if (!contenedor) {
        return;
    }

    const visibles = limitarConOtros(items, limite);
    const total = visibles.reduce((suma, item) => suma + item.valor, 0);

    if (!total) {
        contenedor.innerHTML = vacio();
        return;
    }

    let acumulado = 0;
    const tramos = visibles.map((item, indice) => {
        const inicio = acumulado / total * 100;
        acumulado += item.valor;
        return `${colores[indice % colores.length]} ${inicio}% ${acumulado / total * 100}%`;
    });

    contenedor.innerHTML = `
        <div class="donut-wrap">
            <div class="donut" style="background:conic-gradient(${tramos.join(",")})" role="img" aria-label="${escaparHTML(etiqueta)}">
                <div class="donut-center"><span class="n">${escaparHTML(centro ?? formato(total))}</span><span class="t">${escaparHTML(etiqueta)}</span></div>
            </div>
            <div class="legend">
                ${visibles.map((item, indice) => `
                    <div class="legend-item">
                        <span class="dot" style="background:${colores[indice % colores.length]}"></span>
                        <span class="name" title="${escaparHTML(item.nombre)}">${escaparHTML(item.nombre)}</span>
                        ${mostrarValor ? `<span class="val">${escaparHTML(formato(item.valor))}</span>` : ""}
                        <span class="pct">${fmtPct(item.valor / total)}</span>
                    </div>`).join("")}
            </div>
        </div>`;
}

function renderColumnas(id, items, { formato = valor => fmt(valor), limite = 7 } = {}) {
    const contenedor = document.getElementById(id);

    if (!contenedor) {
        return;
    }

    const visibles = items.filter(item => item.valor > 0).slice(0, limite);

    if (!visibles.length) {
        contenedor.innerHTML = vacio();
        return;
    }

    const maximo = Math.max(...visibles.map(item => item.valor), 1);

    contenedor.innerHTML = `
        <div class="bar-chart-panel">
            <div class="vertical-bars">
                ${visibles.map(item => `
                    <div class="vertical-bar" title="${escaparHTML(item.nombre)}: ${escaparHTML(formato(item.valor))}">
                        <span class="bar-value">${escaparHTML(formato(item.valor))}</span>
                        <div class="bar-column"><span data-alto="${item.valor / maximo * 100}"></span></div>
                        <label>${escaparHTML(item.nombre)}</label>
                    </div>`).join("")}
            </div>
        </div>`;

    requestAnimationFrame(() => {
        contenedor.querySelectorAll("[data-alto]").forEach(barra => {
            barra.style.height = `${barra.dataset.alto}%`;
        });
    });
}


// =====================================================
// DROPDOWNS (cerrar al hacer clic fuera)
// =====================================================

function alternarPanel(trigger, panel, abrir = panel.hidden) {
    document.querySelectorAll(".drop-panel").forEach(otro => {
        if (otro !== panel) {
            otro.hidden = true;
        }
    });
    document.querySelectorAll(".drop-trigger").forEach(otro => {
        if (otro !== trigger) {
            otro.setAttribute("aria-expanded", "false");
        }
    });

    panel.hidden = !abrir;
    trigger.setAttribute("aria-expanded", String(abrir));
}

document.addEventListener("click", evento => {
    // composedPath conserva la ruta aunque el panel se haya redibujado (calendario)
    if (evento.composedPath().some(nodo => nodo.classList?.contains("drop"))) {
        return;
    }

    document.querySelectorAll(".drop-panel").forEach(panel => {
        panel.hidden = true;
    });
    document.querySelectorAll(".drop-trigger").forEach(trigger => {
        trigger.setAttribute("aria-expanded", "false");
    });
});


// =====================================================
// FILTROS COMPARTIDOS (Área + Empresa)
// Solo existen en las páginas que tienen #filtrosAnalytics.
// =====================================================

function leerFiltrosGuardados() {
    try {
        const guardados = JSON.parse(sessionStorage.getItem(CLAVE_FILTROS) || "{}");
        Analytics.filtros.area = String(guardados.area || "");
        Analytics.filtros.empresa = String(guardados.empresa || "");
    } catch (error) {
        Analytics.filtros = { area: "", empresa: "" };
    }
}

function guardarFiltros() {
    try {
        sessionStorage.setItem(CLAVE_FILTROS, JSON.stringify(Analytics.filtros));
    } catch (error) {
        // Sin almacenamiento disponible: los filtros solo duran en esta página.
    }
}

function hayFiltrosCompartidos() {
    return Boolean(document.getElementById("filtrosAnalytics"));
}

function filasFiltradas() {
    const { area, empresa } = Analytics.filtros;
    return Analytics.todas.filter(fila =>
        (!area || fila._area === area) && (!empresa || fila._empresa === empresa)
    );
}

function dibujarFiltros() {
    const chips = document.getElementById("filtroAreas");

    if (!chips) {
        return;
    }

    const areas = valoresUnicos(Analytics.todas, "_area");

    if (Analytics.filtros.area && !areas.includes(Analytics.filtros.area)) {
        Analytics.filtros.area = "";
    }

    chips.innerHTML = [
        `<button type="button" class="filter-chip${Analytics.filtros.area ? "" : " active"}" data-area="">Todas</button>`,
        ...areas.map(area => {
            const cantidad = Analytics.todas.filter(fila => fila._area === area).length;
            return `<button type="button" class="filter-chip${Analytics.filtros.area === area ? " active" : ""}" data-area="${escaparHTML(area)}">${escaparHTML(area)} <b class="chip-count">${cantidad}</b></button>`;
        })
    ].join("");

    dibujarOpcionesEmpresa();
}

function dibujarOpcionesEmpresa() {
    const lista = document.getElementById("empresaLista");

    if (!lista) {
        return;
    }

    const busqueda = normalizarTexto(document.getElementById("empresaBuscar")?.value);
    const base = Analytics.todas.filter(fila => !Analytics.filtros.area || fila._area === Analytics.filtros.area);
    const empresas = valoresUnicos(base, "_empresa");
    const coincidencias = empresas.filter(empresa => !busqueda || normalizarTexto(empresa).includes(busqueda));

    lista.innerHTML = [
        `<button type="button" class="drop-opt${Analytics.filtros.empresa ? "" : " active"}" data-empresa=""><span class="drop-name">Todas las empresas</span></button>`,
        ...coincidencias.map(empresa => {
            const cantidad = base.filter(fila => fila._empresa === empresa).length;
            return `<button type="button" class="drop-opt${Analytics.filtros.empresa === empresa ? " active" : ""}" data-empresa="${escaparHTML(empresa)}"><span class="drop-name" title="${escaparHTML(empresa)}">${escaparHTML(empresa)}</span><span class="drop-count">${cantidad}</span></button>`;
        })
    ].join("") + (coincidencias.length ? "" : '<div class="drop-empty">No hay empresas con esa búsqueda.</div>');

    colocarTexto("empresaMeta", `${coincidencias.length} de ${empresas.length} empresas`);
    colocarTexto("empresaLabel", Analytics.filtros.empresa || "Todas las empresas");
    document.getElementById("empresaTrigger")?.classList.toggle("has-value", Boolean(Analytics.filtros.empresa));
}

function inicializarFiltrosCompartidos() {
    const barra = document.getElementById("filtrosAnalytics");

    if (!barra) {
        return;
    }

    leerFiltrosGuardados();

    const trigger = document.getElementById("empresaTrigger");
    const panel = document.getElementById("empresaPanel");
    const buscador = document.getElementById("empresaBuscar");

    barra.addEventListener("click", evento => {
        const chip = evento.target.closest("[data-area]");

        if (chip) {
            Analytics.filtros.area = chip.dataset.area;
            const empresaEnArea = Analytics.todas.some(fila =>
                fila._empresa === Analytics.filtros.empresa && (!Analytics.filtros.area || fila._area === Analytics.filtros.area)
            );
            if (!empresaEnArea) {
                Analytics.filtros.empresa = "";
            }
            aplicarFiltros();
            return;
        }

        const opcion = evento.target.closest("[data-empresa]");

        if (opcion) {
            Analytics.filtros.empresa = opcion.dataset.empresa;
            alternarPanel(trigger, panel, false);
            aplicarFiltros();
            return;
        }

        if (evento.target.closest("#btnLimpiarFiltros")) {
            Analytics.filtros = { area: "", empresa: "" };
            if (buscador) buscador.value = "";
            aplicarFiltros();
        }
    });

    trigger?.addEventListener("click", () => {
        alternarPanel(trigger, panel);
        if (!panel.hidden) buscador?.focus();
    });

    buscador?.addEventListener("input", dibujarOpcionesEmpresa);
}

function aplicarFiltros() {
    const compartidos = hayFiltrosCompartidos();
    Analytics.filas = compartidos ? filasFiltradas() : Analytics.todas;

    const sinFiltro = !Analytics.filtros.area && !Analytics.filtros.empresa;
    const metricas = calcularMetricas(Analytics.filas, !compartidos || sinFiltro);

    if (compartidos) {
        guardarFiltros();
        dibujarFiltros();
    }

    document.dispatchEvent(new CustomEvent("analytics:actualizado", {
        detail: {
            filas: Analytics.filas,
            todas: Analytics.todas,
            metricas,
            filtrado: compartidos && !sinFiltro
        }
    }));
}


// =====================================================
// CARGA POR JSONP DESDE APPS SCRIPT
// =====================================================

function cargarAnalytics() {
    return new Promise((resolve, reject) => {
        const callback = `analyticsCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const script = document.createElement("script");
        let timeout = null;

        const limpiar = () => {
            clearTimeout(timeout);
            script.remove();
            delete window[callback];
        };

        window[callback] = respuesta => {
            limpiar();

            if (!respuesta) {
                reject(new Error("Apps Script no devolvió información."));
                return;
            }

            if (!respuesta.ok) {
                reject(new Error(respuesta.error || "Error desconocido en Apps Script."));
                return;
            }

            resolve(respuesta);
        };

        script.src = `${URL_API}?callback=${encodeURIComponent(callback)}&t=${Date.now()}`;
        script.async = true;
        script.onerror = () => {
            limpiar();
            reject(new Error("No se pudo conectar con Google Apps Script."));
        };

        document.body.appendChild(script);

        timeout = setTimeout(() => {
            limpiar();
            reject(new Error("La consulta tardó demasiado en responder."));
        }, 20000);
    });
}

function procesarAnalytics(respuesta) {
    const datos = Array.isArray(respuesta.datos) ? respuesta.datos : [];

    Analytics.todas = datos.map(normalizarRegistro);
    Analytics.resumen = respuesta.resumen || null;
    Analytics.actualizado = respuesta.actualizado ? new Date(respuesta.actualizado) : new Date();

    actualizarEncabezado();
    aplicarFiltros();
}


// =====================================================
// ENCABEZADO, ESTADO Y MENSAJES
// =====================================================

function actualizarEncabezado() {
    const fecha = fmtFecha(Analytics.actualizado, true);
    const sync = document.getElementById("pageSync");

    if (sync) {
        sync.classList.remove("sync-busy");
        sync.textContent = `Última sincronización: ${fecha} · ${fmt(Analytics.todas.length)} dashboards registrados`;
    }

    colocarTexto("currentDate", fecha);
    colocarTexto("footerTime", fecha);
    colocarTexto("heroDashboards", fmt(Analytics.todas.length));
    colocarTexto("heroEmpresas", fmt(valoresUnicos(Analytics.todas, "_empresa").length));
    colocarTexto("heroAreas", fmt(valoresUnicos(Analytics.todas, "_area").length));
}

let ultimoEstadoConexion = null;

function estadoConexion(ok, mensaje) {
    ultimoEstadoConexion = { ok, mensaje };
    pintarEstadoConexion();
}

// El sidebar se carga aparte; se repinta el estado cuando termina.
function pintarEstadoConexion() {
    const estado = document.getElementById("gaStatus");

    if (!estado || !ultimoEstadoConexion) {
        return;
    }

    estado.classList.toggle("ok", ultimoEstadoConexion.ok);
    estado.classList.toggle("error", !ultimoEstadoConexion.ok);
    estado.querySelector("span").textContent = ultimoEstadoConexion.mensaje;
}

document.addEventListener("sidebar:loaded", pintarEstadoConexion);

function mostrarError(mensaje) {
    console.error("Error cargando Analytics:", mensaje);

    const elemento = document.getElementById("errorAnalytics");

    if (elemento) {
        elemento.textContent = `${mensaje} Se muestran los últimos datos disponibles.`;
        elemento.hidden = false;
    }

    const sync = document.getElementById("pageSync");
    if (sync) {
        sync.classList.remove("sync-busy");
        if (!Analytics.todas.length) sync.textContent = "No se pudieron cargar los datos.";
    }

    estadoConexion(false, "Sin conexión con Google Analytics");
}

function limpiarError() {
    const elemento = document.getElementById("errorAnalytics");

    if (elemento) {
        elemento.hidden = true;
    }
}

function mostrarContenido() {
    const cargador = document.getElementById("globalLoader");
    const contenido = document.getElementById("mainContent");

    if (cargador) cargador.hidden = true;
    if (contenido) contenido.hidden = false;
}


// =====================================================
// ACTUALIZAR (manual y automático)
// =====================================================

let actualizando = false;

async function actualizarAnalytics() {
    if (actualizando) {
        return;
    }

    actualizando = true;

    const boton = document.getElementById("btnRefresh");
    const sync = document.getElementById("pageSync");

    boton?.classList.add("is-loading");
    if (sync) {
        sync.classList.add("sync-busy");
        sync.textContent = "Consultando Google Analytics…";
    }

    try {
        procesarAnalytics(await cargarAnalytics());
        limpiarError();
        estadoConexion(true, "Conectado a Google Analytics");
    } catch (error) {
        mostrarError(error.message);
        if (Analytics.todas.length) actualizarEncabezado();
    } finally {
        actualizando = false;
        boton?.classList.remove("is-loading");
        mostrarContenido();
    }
}


// =====================================================
// INICIO
// =====================================================

let dashboardIniciado = false;

function iniciarDashboard() {
    if (dashboardIniciado) {
        return;
    }

    dashboardIniciado = true;
    inicializarFiltrosCompartidos();
    document.getElementById("btnRefresh")?.addEventListener("click", actualizarAnalytics);
    actualizarAnalytics();
    setInterval(actualizarAnalytics, TIEMPO_ACTUALIZACION);
}

document.addEventListener("DOMContentLoaded", iniciarDashboard);
