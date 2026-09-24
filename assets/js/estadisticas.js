const coloresEstadisticas = ["#2E8BC0", "#3FA7D6", "#55B7E8", "#247BA0", "#6BBDE3", "#4FA9D1", "#86CBE8"];

function numeroEstadistica(valor) {
    const numero = Number(String(valor ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(numero) ? numero : 0;
}

function escaparEstadistica(valor) {
    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function fechaEstadistica(valor) {
    const texto = String(valor || "").trim();
    const partes = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);

    if (partes) {
        return new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]));
    }

    const fecha = new Date(texto);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function barraEstadistica(porcentaje) {
    return `<i><b data-ancho="${porcentaje}"></b></i>`;
}

function animarBarras(contenedor) {
    requestAnimationFrame(() => {
        contenedor.querySelectorAll("[data-ancho]").forEach(barra => {
            barra.style.width = `${barra.dataset.ancho}%`;
        });
    });
}

function textoCorto(valor, limite = 30) {
    const texto = String(valor || "Sin nombre");
    return texto.length > limite ? `${texto.slice(0, limite - 1)}...` : texto;
}

function normalizarPaisEstadistica(valor) {
    const pais = String(valor || "Sin país")
        .replace(/\s*\(\d+\)/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const paisNormalizado = pais.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    if (paisNormalizado === "guatemala") {
        return "Guatemala";
    }

    if (paisNormalizado === "el salvador") {
        return "El Salvador";
    }

    return pais || "Sin país";
}

function donutEstadistica(items, total, id) {
    const contenedor = document.getElementById(id);

    if (!contenedor || !total) {
        if (contenedor) contenedor.innerHTML = '<p class="estadistica-vacia">Sin datos disponibles</p>';
        return;
    }

    const radio = 74;
    const circunferencia = 2 * Math.PI * radio;
    let acumulado = 0;
    const segmentos = items.map((item, indice) => {
        const longitud = item.valor / total * circunferencia;
        const segmento = `<circle class="estadistica-donut-segment" cx="100" cy="100" r="${radio}" stroke="${coloresEstadisticas[indice % coloresEstadisticas.length]}" stroke-dasharray="0 ${circunferencia}" data-longitud="${longitud}" data-hueco="${circunferencia - longitud}" stroke-dashoffset="${-acumulado}"><title>${escaparEstadistica(item.nombre)}: ${item.valor.toLocaleString("es-GT")} (${(item.valor / total * 100).toFixed(1)}%)</title></circle>`;
        acumulado += longitud;
        return segmento;
    }).join("");
    const leyenda = items.map((item, indice) => `<div class="estadistica-leyenda-item"><i style="background:${coloresEstadisticas[indice % coloresEstadisticas.length]}"></i><span>${escaparEstadistica(item.nombre)}</span><strong>${(item.valor / total * 100).toFixed(1)}%</strong></div>`).join("");

    contenedor.innerHTML = `<div class="estadistica-donut-layout"><svg class="estadistica-donut" viewBox="0 0 200 200" role="img" aria-label="Distribución de usuarios activos por país"><circle class="estadistica-donut-base" cx="100" cy="100" r="${radio}" />${segmentos}<text x="100" y="104" class="estadistica-donut-total">${total.toLocaleString("es-GT")}</text></svg><div class="estadistica-leyenda">${leyenda}</div></div>`;

    requestAnimationFrame(() => {
        contenedor.querySelectorAll(".estadistica-donut-segment").forEach(segmento => {
            segmento.style.strokeDasharray = `${segmento.dataset.longitud} ${segmento.dataset.hueco}`;
        });
    });
}

function rutaSuavizadaEstadistica(puntos) {
    if (puntos.length < 3) {
        return puntos.map((punto, indice) => `${indice ? "L" : "M"} ${punto.x.toFixed(1)} ${punto.y.toFixed(1)}`).join(" ");
    }

    let ruta = `M ${puntos[0].x.toFixed(1)} ${puntos[0].y.toFixed(1)}`;
    for (let indice = 0; indice < puntos.length - 1; indice++) {
        const actual = puntos[indice];
        const siguiente = puntos[indice + 1];
        const puntoMedioX = (actual.x + siguiente.x) / 2;
        ruta += ` C ${puntoMedioX.toFixed(1)} ${actual.y.toFixed(1)}, ${puntoMedioX.toFixed(1)} ${siguiente.y.toFixed(1)}, ${siguiente.x.toFixed(1)} ${siguiente.y.toFixed(1)}`;
    }
    return ruta;
}

function renderizarLineaEstadistica(id, series, maximo, unidad = "", seriesSecundaria = []) {
    const contenedor = document.getElementById(id);

    if (!contenedor || !series.length) {
        if (contenedor) contenedor.innerHTML = '<p class="estadistica-vacia">Sin datos disponibles</p>';
        return;
    }

    const ancho = 620;
    const alto = 190;
    const base = alto - 28;
    const crearPuntos = valores => valores.map((item, indice) => {
        const x = series.length === 1 ? ancho / 2 : 12 + indice / (series.length - 1) * (ancho - 24);
        const y = base - (item.valor / maximo) * (alto - 50);
        return { ...item, x, y };
    });
    const puntos = crearPuntos(series);
    const puntosSecundarios = crearPuntos(seriesSecundaria);
    const construirPuntosSvg = (valores, clase) => valores.map(punto => `<circle cx="${punto.x}" cy="${punto.y}" r="3.5" class="estadistica-linea-punto ${clase}"><title>${escaparEstadistica(punto.etiqueta)}: ${punto.valor.toLocaleString("es-GT")} ${unidad}</title></circle>`).join("");
    const etiquetas = puntos.filter((_, indice) => indice === 0 || indice === puntos.length - 1 || indice % 3 === 0).map(punto => `<text x="${punto.x}" y="${alto - 5}" class="estadistica-linea-etiqueta" text-anchor="middle">${punto.etiqueta}</text>`).join("");

    const trazoPrincipal = rutaSuavizadaEstadistica(puntos);
    const areaPrincipal = puntos.length > 1 ? `${trazoPrincipal} L ${puntos[puntos.length - 1].x.toFixed(1)} ${base} L ${puntos[0].x.toFixed(1)} ${base} Z` : "";

    const segundaLinea = seriesSecundaria.length
        ? `<path d="${rutaSuavizadaEstadistica(puntosSecundarios)}" class="estadistica-svg-linea estadistica-svg-linea-secundaria" />${construirPuntosSvg(puntosSecundarios, "estadistica-linea-punto-secundario")}`
        : "";
    const leyenda = seriesSecundaria.length ? `<div class="estadistica-mini-series"><span><i class="serie-nueva"></i>Nuevos</span><span><i class="serie-recurrente"></i>Recurrentes</span></div>` : "";
    const idGradiente = `gradiente-${id}`;

    contenedor.innerHTML = `${leyenda}<svg class="estadistica-linea-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Gráfica de actividad"><defs><linearGradient id="${idGradiente}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.55" /><stop offset="100%" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs><line x1="12" y1="${base}" x2="${ancho - 12}" y2="${base}" class="estadistica-svg-eje" /><line x1="12" y1="65" x2="${ancho - 12}" y2="65" class="estadistica-svg-guia" /><line x1="12" y1="20" x2="${ancho - 12}" y2="20" class="estadistica-svg-guia" />${areaPrincipal ? `<path d="${areaPrincipal}" class="estadistica-svg-area estadistica-svg-linea" fill="url(#${idGradiente})" stroke="none" />` : ""}<path d="${trazoPrincipal}" class="estadistica-svg-linea" />${segundaLinea}${construirPuntosSvg(puntos, "")}${etiquetas}</svg>`;
}

function renderizarEstadisticas(datos) {
    const titulos = {};
    const paises = {};
    const actividad = {};
    const interaccion = {};
    const interaccionPorFecha = {};
    const nuevosPorFecha = {};
    const recurrentesPorFecha = {};
    const usuariosPorTitulo = {};
    const sistemas = {};
    let usuariosTotales = 0;
    let usuariosRecurrentes = 0;
    let vistasTotales = 0;
    let eventosTotales = 0;

    datos.forEach(item => {
        const titulo = String(item.TITULO_ANALYTICS || item.TIPO_DASHBOARD || "Sin título").trim();
        const pais = normalizarPaisEstadistica(item.PAISES);
        const sesiones = numeroEstadistica(item.SESIONES);
        const usuarios = numeroEstadistica(item.USUARIOS_ACTIVOS);
        const fecha = fechaEstadistica(item.ULTIMA_ACTIVIDAD || item.ULTIMO_ACCESO || item.PRIMER_ACCESO);
        const recurrentesItem = numeroEstadistica(item.USUARIOS_RECURRENTES);
        const fechaClave = fecha ? fecha.toISOString().slice(5, 10) : "";

        titulos[titulo] = (titulos[titulo] || 0) + sesiones;
        paises[pais] = Math.max(paises[pais] || 0, usuarios);
        usuariosTotales += numeroEstadistica(item.TOTAL_USUARIOS || item.USUARIOS_ACTIVOS);
        usuariosRecurrentes += recurrentesItem;
        vistasTotales += numeroEstadistica(item.VISTAS);
        eventosTotales += numeroEstadistica(item.TOTAL_EVENTOS);
        usuariosPorTitulo[titulo] = (usuariosPorTitulo[titulo] || 0) + usuarios;
        const sistema = String(item.SISTEMAS_OPERATIVOS || "Sin sistema").trim();
        sistemas[sistema] = (sistemas[sistema] || 0) + usuarios;

        if (fecha) {
            const clave = fecha.toISOString().slice(0, 10);
            actividad[clave] = (actividad[clave] || 0) + sesiones;
            interaccionPorFecha[fechaClave] = (interaccionPorFecha[fechaClave] || 0) + numeroEstadistica(item.TIEMPO_INTERACCION_MEDIO_POR_SESION);
            nuevosPorFecha[fechaClave] = (nuevosPorFecha[fechaClave] || 0) + Math.max(usuarios - recurrentesItem, 0);
            recurrentesPorFecha[fechaClave] = (recurrentesPorFecha[fechaClave] || 0) + recurrentesItem;
        }

        interaccion[titulo] = numeroEstadistica(item.TIEMPO_INTERACCION_MEDIO_POR_SESION);
    });

    const titulosOrdenados = Object.entries(titulos).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const tituloMaximo = Math.max(...titulosOrdenados.map(([, valor]) => valor), 1);
    const contenedorTitulos = document.getElementById("estadisticaTitulos");
    contenedorTitulos.innerHTML = titulosOrdenados.length
        ? `<div class="estadistica-tabla">${titulosOrdenados.map(([nombre, valor]) => `<div class="estadistica-fila"><span title="${escaparEstadistica(nombre)}">${escaparEstadistica(textoCorto(nombre, 32))}</span><strong>${valor.toLocaleString("es-GT")}</strong>${barraEstadistica(valor / tituloMaximo * 100)}</div>`).join("")}</div>`
        : '<p class="estadistica-vacia">Sin datos disponibles</p>';
    animarBarras(contenedorTitulos);

    const paisesOrdenadosTodos = Object.entries(paises)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, valor]) => ({ nombre, valor }));
    const totalPaises = paisesOrdenadosTodos.reduce((total, item) => total + item.valor, 0);
    const paisesOrdenados = paisesOrdenadosTodos.slice(0, 6);
    donutEstadistica(paisesOrdenados, totalPaises, "estadisticaPaisesDonut");
    const paisMaximo = Math.max(...paisesOrdenados.map(item => item.valor), 1);
    const contenedorPaises = document.getElementById("estadisticaPaises");
    contenedorPaises.innerHTML = paisesOrdenados.length
        ? `<div class="estadistica-barras">${paisesOrdenados.map(item => `<div class="estadistica-barra-fila"><span>${escaparEstadistica(item.nombre)}</span>${barraEstadistica(item.valor / paisMaximo * 100)}<strong>${item.valor.toLocaleString("es-GT")}</strong></div>`).join("")}</div>`
        : '<p class="estadistica-vacia">Sin datos disponibles</p>';
    animarBarras(contenedorPaises);

    const actividadOrdenada = Object.entries(actividad).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    const actividadMaxima = Math.max(...actividadOrdenada.map(([, valor]) => valor), 1);
    renderizarLineaEstadistica(
        "estadisticaActividad",
        actividadOrdenada.map(([fecha, valor]) => ({
            etiqueta: fecha.slice(5),
            valor
        })),
        actividadMaxima,
        "sesiones"
    );

    const interaccionOrdenada = Object.entries(interaccion).filter(([, valor]) => valor > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const interaccionMaxima = Math.max(...interaccionOrdenada.map(([, valor]) => valor), 1);
    const contenedorInteraccion = document.getElementById("estadisticaInteraccion");
    contenedorInteraccion.innerHTML = interaccionOrdenada.length
        ? `<div class="estadistica-barras">${interaccionOrdenada.map(([nombre, valor]) => `<div class="estadistica-barra-fila"><span>${escaparEstadistica(textoCorto(nombre, 28))}</span>${barraEstadistica(valor / interaccionMaxima * 100)}<strong>${valor.toLocaleString("es-GT")} s</strong></div>`).join("")}</div>`
        : '<p class="estadistica-vacia">Sin tiempos disponibles</p>';
    animarBarras(contenedorInteraccion);

    const fechasInteraccion = Object.entries(interaccionPorFecha).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([etiqueta, valor]) => ({ etiqueta, valor }));
    renderizarLineaEstadistica("estadisticaTiempoFecha", fechasInteraccion, Math.max(...fechasInteraccion.map(item => item.valor), 1), "segundos");

    const fechasNuevos = Object.keys({ ...nuevosPorFecha, ...recurrentesPorFecha }).sort().slice(-12);
    const nuevos = fechasNuevos.map(etiqueta => ({ etiqueta, valor: nuevosPorFecha[etiqueta] || 0 }));
    const recurrentes = fechasNuevos.map(etiqueta => ({ etiqueta, valor: recurrentesPorFecha[etiqueta] || 0 }));
    const maxNuevos = Math.max(...nuevos.map(item => item.valor), ...recurrentes.map(item => item.valor), 1);
    renderizarLineaEstadistica("estadisticaFidelizacion", nuevos, maxNuevos, "usuarios", recurrentes);

    document.getElementById("estadisticaTotales").innerHTML = [
        ["Total de usuarios", usuariosTotales],
        ["Vistas", vistasTotales],
        ["Número de eventos", eventosTotales]
    ].map(([nombre, valor]) => `<div class="estadistica-metrica"><span>${nombre}</span><strong>${valor.toLocaleString("es-GT")}</strong></div>`).join("");

    const usuariosTitulo = Object.entries(usuariosPorTitulo).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const usuariosTituloMaximo = Math.max(...usuariosTitulo.map(([, valor]) => valor), 1);
    const contenedorUsuariosTitulo = document.getElementById("estadisticaUsuariosTitulo");
    contenedorUsuariosTitulo.innerHTML = `<div class="estadistica-barras">${usuariosTitulo.map(([nombre, valor]) => `<div class="estadistica-barra-fila"><span>${escaparEstadistica(textoCorto(nombre, 38))}</span>${barraEstadistica(valor / usuariosTituloMaximo * 100)}<strong>${valor.toLocaleString("es-GT")}</strong></div>`).join("")}</div>`;
    animarBarras(contenedorUsuariosTitulo);

    const sistemasOrdenados = Object.entries(sistemas).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const sistemaMaximo = Math.max(...sistemasOrdenados.map(([, valor]) => valor), 1);
    const contenedorSistemas = document.getElementById("estadisticaSistemas");
    contenedorSistemas.innerHTML = `<div class="estadistica-barras">${sistemasOrdenados.map(([nombre, valor]) => `<div class="estadistica-barra-fila"><span>${escaparEstadistica(nombre)}</span>${barraEstadistica(valor / sistemaMaximo * 100)}<strong>${valor.toLocaleString("es-GT")}</strong></div>`).join("")}</div>`;
    animarBarras(contenedorSistemas);
}

document.addEventListener("analytics:loaded", evento => renderizarEstadisticas(evento.detail.datos));