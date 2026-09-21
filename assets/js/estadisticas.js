const coloresEstadisticas = ["#011C3D", "#053161", "#074279", "#095392", "#0E76C0", "#34A9ED", "#9DE3F9"];

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

function textoCorto(valor, limite = 30) {
    const texto = String(valor || "Sin nombre");
    return texto.length > limite ? `${texto.slice(0, limite - 1)}...` : texto;
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
        const segmento = `<circle class="estadistica-donut-segment" cx="100" cy="100" r="${radio}" stroke="${coloresEstadisticas[indice % coloresEstadisticas.length]}" stroke-dasharray="${longitud} ${circunferencia - longitud}" stroke-dashoffset="${-acumulado}" />`;
        acumulado += longitud;
        return segmento;
    }).join("");
    const leyenda = items.map((item, indice) => `<div class="estadistica-leyenda-item"><i style="background:${coloresEstadisticas[indice % coloresEstadisticas.length]}"></i><span>${escaparEstadistica(item.nombre)}</span><strong>${(item.valor / total * 100).toFixed(1)}%</strong></div>`).join("");

    contenedor.innerHTML = `<div class="estadistica-donut-layout"><svg class="estadistica-donut" viewBox="0 0 200 200" role="img" aria-label="Distribución de usuarios activos por país"><circle class="estadistica-donut-base" cx="100" cy="100" r="${radio}" />${segmentos}<text x="100" y="104" class="estadistica-donut-total">${total.toLocaleString("es-GT")}</text></svg><div class="estadistica-leyenda">${leyenda}</div></div>`;
}

function renderizarLineaEstadistica(id, series, maximo, unidad = "", seriesSecundaria = []) {
    const contenedor = document.getElementById(id);

    if (!contenedor || !series.length) {
        if (contenedor) contenedor.innerHTML = '<p class="estadistica-vacia">Sin datos disponibles</p>';
        return;
    }

    const ancho = 620;
    const alto = 190;
    const crearPuntos = valores => valores.map((item, indice) => {
        const x = series.length === 1 ? ancho / 2 : 12 + indice / (series.length - 1) * (ancho - 24);
        const y = alto - 28 - (item.valor / maximo) * (alto - 50);
        return { ...item, x, y };
    });
    const puntos = crearPuntos(series);
    const puntosSecundarios = crearPuntos(seriesSecundaria);
    const construirRuta = valores => valores.map((punto, indice) => `${indice ? "L" : "M"} ${punto.x.toFixed(1)} ${punto.y.toFixed(1)}`).join(" ");
    const construirPuntosSvg = (valores, clase) => valores.map(punto => `<circle cx="${punto.x}" cy="${punto.y}" r="3.5" class="estadistica-linea-punto ${clase}"><title>${escaparEstadistica(punto.etiqueta)}: ${punto.valor.toLocaleString("es-GT")} ${unidad}</title></circle>`).join("");
    const etiquetas = puntos.filter((_, indice) => indice === 0 || indice === puntos.length - 1 || indice % 3 === 0).map(punto => `<text x="${punto.x}" y="${alto - 5}" class="estadistica-linea-etiqueta" text-anchor="middle">${punto.etiqueta}</text>`).join("");

    const segundaLinea = seriesSecundaria.length ? `<path d="${construirRuta(puntosSecundarios)}" class="estadistica-svg-linea estadistica-svg-linea-secundaria" />${construirPuntosSvg(puntosSecundarios, "estadistica-linea-punto-secundario")}` : "";
    const leyenda = seriesSecundaria.length ? `<div class="estadistica-mini-series"><span><i class="serie-nueva"></i>Nuevos</span><span><i class="serie-recurrente"></i>Recurrentes</span></div>` : "";

    contenedor.innerHTML = `${leyenda}<svg class="estadistica-linea-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Gráfica de actividad"><line x1="12" y1="${alto - 28}" x2="${ancho - 12}" y2="${alto - 28}" class="estadistica-svg-eje" /><line x1="12" y1="65" x2="${ancho - 12}" y2="65" class="estadistica-svg-guia" /><line x1="12" y1="20" x2="${ancho - 12}" y2="20" class="estadistica-svg-guia" /><path d="${construirRuta(puntos)}" class="estadistica-svg-linea" />${segundaLinea}${construirPuntosSvg(puntos, "")}${etiquetas}</svg>`;
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
        const pais = String(item.PAISES || "Sin país").trim();
        const sesiones = numeroEstadistica(item.SESIONES);
        const usuarios = numeroEstadistica(item.USUARIOS_ACTIVOS);
        const fecha = fechaEstadistica(item.ULTIMA_ACTIVIDAD || item.ULTIMO_ACCESO || item.PRIMER_ACCESO);
        const recurrentesItem = numeroEstadistica(item.USUARIOS_RECURRENTES);
        const fechaClave = fecha ? fecha.toISOString().slice(5, 10) : "";

        titulos[titulo] = (titulos[titulo] || 0) + sesiones;
        paises[pais] = (paises[pais] || 0) + usuarios;
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
    document.getElementById("estadisticaTitulos").innerHTML = titulosOrdenados.length
        ? `<div class="estadistica-tabla">${titulosOrdenados.map(([nombre, valor]) => `<div class="estadistica-fila"><span title="${escaparEstadistica(nombre)}">${escaparEstadistica(textoCorto(nombre, 32))}</span><strong>${valor.toLocaleString("es-GT")}</strong><i><b style="width:${valor / tituloMaximo * 100}%"></b></i></div>`).join("")}</div>`
        : '<p class="estadistica-vacia">Sin datos disponibles</p>';

    const paisesOrdenados = Object.entries(paises).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nombre, valor]) => ({ nombre, valor }));
    const totalPaises = paisesOrdenados.reduce((total, item) => total + item.valor, 0);
    donutEstadistica(paisesOrdenados, totalPaises, "estadisticaPaisesDonut");
    const paisMaximo = Math.max(...paisesOrdenados.map(item => item.valor), 1);
    document.getElementById("estadisticaPaises").innerHTML = paisesOrdenados.length
        ? `<div class="estadistica-barras">${paisesOrdenados.map(item => `<div class="estadistica-barra-fila"><span>${escaparEstadistica(item.nombre)}</span><i><b style="width:${item.valor / paisMaximo * 100}%"></b></i><strong>${item.valor.toLocaleString("es-GT")}</strong></div>`).join("")}</div>`
        : '<p class="estadistica-vacia">Sin datos disponibles</p>';

    const actividadOrdenada = Object.entries(actividad).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    const actividadMaxima = Math.max(...actividadOrdenada.map(([, valor]) => valor), 1);
    document.getElementById("estadisticaActividad").innerHTML = actividadOrdenada.length
        ? `<div class="estadistica-linea">${actividadOrdenada.map(([fecha, valor], indice) => `<div class="estadistica-punto" style="left:${actividadOrdenada.length === 1 ? 50 : indice / (actividadOrdenada.length - 1) * 100}%; bottom:${Math.max(valor / actividadMaxima * 86, 8)}%"><b>${valor.toLocaleString("es-GT")}</b><span>${fecha.slice(5)}</span></div>`).join("")}<div class="estadistica-linea-trazo"></div></div>`
        : '<p class="estadistica-vacia">Sin fechas disponibles</p>';

    const interaccionOrdenada = Object.entries(interaccion).filter(([, valor]) => valor > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const interaccionMaxima = Math.max(...interaccionOrdenada.map(([, valor]) => valor), 1);
    document.getElementById("estadisticaInteraccion").innerHTML = interaccionOrdenada.length
        ? `<div class="estadistica-barras">${interaccionOrdenada.map(([nombre, valor]) => `<div class="estadistica-barra-fila"><span>${escaparEstadistica(textoCorto(nombre, 28))}</span><i><b style="width:${valor / interaccionMaxima * 100}%"></b></i><strong>${valor.toLocaleString("es-GT")} s</strong></div>`).join("")}</div>`
        : '<p class="estadistica-vacia">Sin tiempos disponibles</p>';

    const recurrentesTotal = Math.min(usuariosRecurrentes, usuariosTotales);
    donutEstadistica([
        { nombre: "Recurrentes", valor: recurrentesTotal },
        { nombre: "Nuevos", valor: Math.max(usuariosTotales - recurrentesTotal, 0) }
    ], usuariosTotales, "estadisticaFidelizacion");

    const fechasInteraccion = Object.entries(interaccionPorFecha).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([etiqueta, valor]) => ({ etiqueta, valor }));
    renderizarLineaEstadistica("estadisticaTiempoFecha", fechasInteraccion, Math.max(...fechasInteraccion.map(item => item.valor), 1), "segundos");

    const fechasNuevos = Object.keys({ ...nuevosPorFecha, ...recurrentesPorFecha }).sort().slice(-12);
    const nuevos = fechasNuevos.map(etiqueta => ({ etiqueta, valor: nuevosPorFecha[etiqueta] || 0 }));
    const recurrentes = fechasNuevos.map(etiqueta => ({ etiqueta, valor: recurrentesPorFecha[etiqueta] || 0 }));
    const maxNuevos = Math.max(...nuevos.map(item => item.valor), ...recurrentes.map(item => item.valor), 1);
    renderizarLineaEstadistica("estadisticaNuevosRecurrentes", nuevos, maxNuevos, "usuarios", recurrentes);

    document.getElementById("estadisticaTotales").innerHTML = [
        ["Total de usuarios", usuariosTotales],
        ["Vistas", vistasTotales],
        ["Número de eventos", eventosTotales]
    ].map(([nombre, valor]) => `<div class="estadistica-metrica"><span>${nombre}</span><strong>${valor.toLocaleString("es-GT")}</strong></div>`).join("");

    const usuariosTitulo = Object.entries(usuariosPorTitulo).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const usuariosTituloMaximo = Math.max(...usuariosTitulo.map(([, valor]) => valor), 1);
    document.getElementById("estadisticaUsuariosTitulo").innerHTML = `<div class="estadistica-barras">${usuariosTitulo.map(([nombre, valor]) => `<div class="estadistica-barra-fila"><span>${escaparEstadistica(textoCorto(nombre, 38))}</span><i><b style="width:${valor / usuariosTituloMaximo * 100}%"></b></i><strong>${valor.toLocaleString("es-GT")}</strong></div>`).join("")}</div>`;

    const sistemasOrdenados = Object.entries(sistemas).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const sistemaMaximo = Math.max(...sistemasOrdenados.map(([, valor]) => valor), 1);
    document.getElementById("estadisticaSistemas").innerHTML = `<div class="estadistica-barras">${sistemasOrdenados.map(([nombre, valor]) => `<div class="estadistica-barra-fila"><span>${escaparEstadistica(nombre)}</span><i><b style="width:${valor / sistemaMaximo * 100}%"></b></i><strong>${valor.toLocaleString("es-GT")}</strong></div>`).join("")}</div>`;
}

document.addEventListener("analytics:loaded", evento => renderizarEstadisticas(evento.detail.datos));