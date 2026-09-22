// =====================================================
// CONFIGURACIÓN
// =====================================================

const URL_API =
    "https://script.google.com/macros/s/AKfycby8ZuM85TRry5eNmBGq5IjlmNdO2B3WPeHQb-AE77lcUYD8DKkVTkNm1cejVhzCW3LtOQ/exec";

// Cada cuánto actualizar: 300000 ms = 5 minutos
const TIEMPO_ACTUALIZACION = 300000;


// =====================================================
// COLUMNAS QUE RECIBIMOS DESDE GOOGLE SHEETS / APPS SCRIPT
// =====================================================

const COLUMNAS_ANALYTICS = [
    { key: "ID", tipo: "numero" },
    { key: "EMPRESA", tipo: "texto" },
    { key: "CLAVE_ANALYTICS", tipo: "texto" },
    { key: "TITULO_ANALYTICS", tipo: "texto" },
    { key: "TIPO_DASHBOARD", tipo: "texto" },
    { key: "ACTIVO", tipo: "texto" },
    { key: "USUARIOS_ACTIVOS", tipo: "numero" },
    { key: "SESIONES", tipo: "numero" },
    { key: "VISTAS", tipo: "numero" },
    { key: "TIEMPO_INTERACCION_MEDIO_POR_SESION", tipo: "texto" },
    { key: "SESIONES_CON_INTERACCION", tipo: "numero" },
    { key: "PORCENTAJE_INTERACCIONES", tipo: "porcentaje" },
    { key: "USUARIOS_RECURRENTES", tipo: "numero" },
    { key: "TOTAL_USUARIOS", tipo: "numero" },
    { key: "TOTAL_EVENTOS", tipo: "numero" },
    { key: "PRIMER_ACCESO", tipo: "texto" },
    { key: "ULTIMO_ACCESO", tipo: "texto" },
    { key: "ULTIMA_ACTIVIDAD", tipo: "texto" },
    { key: "NAVEGADORES", tipo: "texto" },
    { key: "SISTEMAS_OPERATIVOS", tipo: "texto" },
    { key: "CATEGORIAS_DISPOSITIVO", tipo: "texto" },
    { key: "PLATAFORMAS", tipo: "texto" },
    { key: "CIUDADES", tipo: "texto" },
    { key: "PAISES", tipo: "texto" },
    { key: "REGIONES", tipo: "texto" },
    { key: "FUENTES_SESION", tipo: "texto" },
    { key: "URL_PAGINAS", tipo: "texto" },
    { key: "EVENTOS", tipo: "texto" }
];


// =====================================================
// ESTADO LOCAL DEL DASHBOARD
// =====================================================

let datosOriginales = [];
let intervaloActualizacion = null;


// =====================================================
// CARGAR INFORMACIÓN DE ANALYTICS POR JSONP
// =====================================================

function cargarAnalytics() {

    return new Promise((resolve, reject) => {

        const callback =
            "analyticsCallback_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 100000);

        let script = null;
        let timeout = null;


        function limpiar() {

            if (timeout) {
                clearTimeout(timeout);
            }

            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }

            try {
                delete window[callback];
            } catch (error) {
                window[callback] = undefined;
            }
        }


        window[callback] = function (respuesta) {

            limpiar();

            console.log("Respuesta Analytics:", respuesta);

            if (!respuesta) {
                const error = new Error(
                    "Apps Script no devolvió información."
                );
                mostrarError(error.message);
                reject(error);
                return;
            }

            if (!respuesta.ok) {
                const error = new Error(
                    respuesta.error ||
                    "Error desconocido en Apps Script."
                );
                mostrarError(error.message);
                reject(error);
                return;
            }

            procesarAnalytics(respuesta);
            resolve(respuesta);
        };


        script = document.createElement("script");

        script.src =
            URL_API +
            "?callback=" +
            encodeURIComponent(callback) +
            "&t=" +
            Date.now();

        script.async = true;


        script.onerror = function () {

            limpiar();

            const error = new Error(
                "No se pudo conectar con Google Apps Script."
            );

            mostrarError(error.message);
            reject(error);
        };


        document.body.appendChild(script);


        timeout = setTimeout(() => {

            limpiar();

            const error = new Error(
                "La consulta tardó demasiado en responder."
            );

            mostrarError(error.message);
            reject(error);

        }, 20000);
    });
}


// =====================================================
// PROCESAR RESPUESTA
// =====================================================

function procesarAnalytics(respuesta) {

    const datos =
        Array.isArray(respuesta.datos)
            ? respuesta.datos
            : [];

    console.log("Total de registros:", respuesta.total);
    console.log("Datos recibidos:", datos);

    datosOriginales = datos;

    document.dispatchEvent(
        new CustomEvent("analytics:loaded", {
            detail: { datos }
        })
    );


    // ==========================================
    // ÚLTIMA ACTUALIZACIÓN
    // ==========================================

    const elementoFecha =
        document.getElementById("ultimaActualizacion");

    if (elementoFecha) {

        if (respuesta.actualizado) {

            const fecha =
                new Date(respuesta.actualizado);

            elementoFecha.textContent =
                fecha.toLocaleString("es-GT", {
                    dateStyle: "short",
                    timeStyle: "medium"
                });

        } else {
            elementoFecha.textContent = "-";
        }
    }


    // ==========================================
    // PREPARAR FILTROS Y MOSTRAR TODO
    // ==========================================

    cargarOpcionesTipoDashboard(datosOriginales);
    cargarOpcionesEmpresa(datosOriginales);
    renderizarGraficaGeneral(datosOriginales);
    renderizarGraficaUsoDashboards(datosOriginales);
    renderizarGraficaEmpresa(datosOriginales);
    actualizarGraficasGeneralesSeguras(datosOriginales);
    aplicarFiltros();
    limpiarError();
}


// =====================================================
// FILTRAR DATOS
// =====================================================

function aplicarFiltros() {

    const buscador =
        document.getElementById("buscarEmpresa");

    const filtroTipo =
        document.getElementById("filtroTipo");

    const textoBusqueda =
        buscador
            ? normalizarTexto(buscador.value)
            : "";

    const tipoSeleccionado =
        filtroTipo
            ? String(filtroTipo.value || "").trim()
            : "";

    const filtrados =
        datosOriginales.filter(item => {

            const coincideTexto =
                !textoBusqueda ||
                [
                    item.EMPRESA,
                    item.CLAVE_ANALYTICS,
                    item.TITULO_ANALYTICS,
                    item.TIPO_DASHBOARD,
                    item.CIUDADES,
                    item.PAISES
                ].some(valor =>
                    normalizarTexto(valor).includes(textoBusqueda)
                );

            const coincideTipo =
                !tipoSeleccionado ||
                String(item.TIPO_DASHBOARD || "") === tipoSeleccionado;

            return coincideTexto && coincideTipo;
        });

    renderizarTabla(filtrados);
    actualizarKPIs(filtrados);
    actualizarContador(filtrados.length, datosOriginales.length);
    renderizarGraficaGeneral(filtrados);
    renderizarGraficaUsoDashboards(filtrados);
    renderizarGraficaEmpresa(filtrados);
    actualizarGraficasGeneralesSeguras(filtrados);
}


// =====================================================
// CONSTRUIR / ACTUALIZAR OPCIONES DEL FILTRO DE TIPO
// =====================================================

function cargarOpcionesTipoDashboard(datos) {

    const select =
        document.getElementById("filtroTipo");

    if (!select) {
        return;
    }

    const valorActual = select.value;

    const tipos =
        [...new Set(
            datos
                .map(item => String(item.TIPO_DASHBOARD || "").trim())
                .filter(Boolean)
        )]
            .sort((a, b) =>
                a.localeCompare(b, "es", { sensitivity: "base" })
            );

    select.innerHTML =
        '<option value="">Todos los dashboards</option>';

    tipos.forEach(tipo => {
        const option = document.createElement("option");
        option.value = tipo;
        option.textContent = tipo;
        select.appendChild(option);
    });

    if (tipos.includes(valorActual)) {
        select.value = valorActual;
    }
}

function cargarOpcionesEmpresa(datos) {

    const select =
        document.getElementById("empresaSelect");

    if (!select) {
        return;
    }

    const valorActual = select.value;

    const empresas =
        [...new Set(
            datos
                .map(item => String(item.EMPRESA || "").trim())
                .filter(Boolean)
        )]
            .sort((a, b) =>
                a.localeCompare(b, "es", { sensitivity: "base" })
            );

    select.innerHTML =
        '<option value="">Seleccione una empresa</option>';

    empresas.forEach(empresa => {
        const option = document.createElement("option");
        option.value = empresa;
        option.textContent = empresa;
        select.appendChild(option);
    });

    if (empresas.includes(valorActual)) {
        select.value = valorActual;
    }
}


// =====================================================
// RENDERIZAR TABLA COMPLETA
// =====================================================

function renderizarTabla(datos) {

    const tabla =
        document.getElementById("tablaAnalytics");

    if (!tabla) {
        console.warn(
            'No existe un elemento con id="tablaAnalytics".'
        );
        return;
    }

    tabla.innerHTML = "";


    if (datos.length === 0) {

        const fila =
            document.createElement("tr");

        fila.innerHTML = `
            <td colspan="${COLUMNAS_ANALYTICS.length}" class="sin-datos">
                No hay información que coincida con los filtros.
            </td>
        `;

        tabla.appendChild(fila);
        return;
    }


    const fragmento =
        document.createDocumentFragment();

    datos.forEach(item => {

        const fila =
            document.createElement("tr");

        fila.innerHTML =
            COLUMNAS_ANALYTICS
                .map(columna => {

                    const valor =
                        formatearValorCelda(
                            item[columna.key],
                            columna.tipo,
                            columna.key
                        );

                    const clase =
                        obtenerClaseCelda(
                            columna.key,
                            columna.tipo
                        );

                    return `
                        <td class="${clase}">
                            ${valor}
                        </td>
                    `;
                })
                .join("");

        fragmento.appendChild(fila);
    });

    tabla.appendChild(fragmento);
}


// =====================================================
// KPIs DEL DASHBOARD
// =====================================================

function actualizarKPIs(datos) {

    const dashboards = datos.length;

    const usuarios =
        sumarCampo(datos, "USUARIOS_ACTIVOS");

    const sesiones =
        sumarCampo(datos, "SESIONES");

    const vistas =
        sumarCampo(datos, "VISTAS");

    colocarTexto("kpiDashboards", formatearNumero(dashboards));
    colocarTexto("kpiUsuarios", formatearNumero(usuarios));
    colocarTexto("kpiSesiones", formatearNumero(sesiones));
    colocarTexto("kpiVistas", formatearNumero(vistas));
}


function sumarCampo(datos, campo) {

    return datos.reduce(
        (total, item) =>
            total + numeroSeguro(item[campo]),
        0
    );
}


function colocarTexto(id, valor) {

    const elemento =
        document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}


// =====================================================
// CONTADOR DE REGISTROS
// =====================================================

function actualizarContador(visibles, total) {

    const elemento =
        document.getElementById("contadorRegistros");

    if (!elemento) {
        return;
    }

    if (visibles === total) {
        elemento.textContent =
            `${formatearNumero(total)} registros`;
    } else {
        elemento.textContent =
            `${formatearNumero(visibles)} de ${formatearNumero(total)} registros`;
    }
}


// =====================================================
// FORMATEAR CADA CELDA SEGÚN SU TIPO / CONTENIDO
// =====================================================

function formatearValorCelda(valor, tipo, clave) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return "-";
    }

    if (tipo === "numero") {
        return formatearNumero(valor);
    }

    if (tipo === "porcentaje") {
        return formatearPorcentaje(valor);
    }

    const texto = escaparHTML(
        ["PRIMER_ACCESO", "ULTIMO_ACCESO", "ULTIMA_ACTIVIDAD"].includes(clave)
            ? formatearFechaAnalytics(valor)
            : valor
    );

    // Badges simples para campos que se benefician visualmente.
    if (clave === "ACTIVO") {
        const activo = normalizarTexto(valor) === "si";
        return `<span class="badge ${activo ? "badge-activo" : "badge-inactivo"}">${texto}</span>`;
    }

    if (clave === "CLAVE_ANALYTICS" && String(valor).trim() !== "-") {
        return `<span class="badge badge-clave">${texto}</span>`;
    }

    return texto;
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


// =====================================================
// CLASE CSS SEGÚN TIPO/COLUMNA
// =====================================================

function obtenerClaseCelda(clave, tipo) {

    const clases = [];

    if (tipo === "numero" || tipo === "porcentaje") {
        clases.push("numero");
    }

    if (clave === "TITULO_ANALYTICS") {
        clases.push("titulo");
    }

    if (
        clave === "NAVEGADORES" ||
        clave === "SISTEMAS_OPERATIVOS" ||
        clave === "CATEGORIAS_DISPOSITIVO" ||
        clave === "PLATAFORMAS" ||
        clave === "CIUDADES" ||
        clave === "PAISES" ||
        clave === "REGIONES" ||
        clave === "FUENTES_SESION" ||
        clave === "EVENTOS"
    ) {
        clases.push("detalle");
    }

    if (
        clave === "URL_PAGINAS" ||
        clave === "URL_ENLACES"
    ) {
        clases.push("url");
    }

    if (
        clave === "PRIMER_ACCESO" ||
        clave === "ULTIMO_ACCESO" ||
        clave === "ULTIMA_ACTIVIDAD"
    ) {
        clases.push("fecha");
    }

    return clases.join(" ");
}


// =====================================================
// FORMATEAR NÚMEROS
// =====================================================

function formatearNumero(valor) {

    valor = convertirSerialAnalytics(valor);

    const numero = Number(valor);

    if (
        valor === "" ||
        valor === null ||
        valor === undefined ||
        Number.isNaN(numero)
    ) {
        return "0";
    }

    return numero.toLocaleString("es-GT");
}

function convertirSerialAnalytics(valor) {
    const texto = String(valor ?? "");

    if (!/^(1899|1900)-/.test(texto)) {
        return valor;
    }

    const fecha = new Date(texto);

    if (Number.isNaN(fecha.getTime())) {
        return valor;
    }

    const inicio = Date.UTC(1899, 11, 30);
    return Math.round((fecha.getTime() - inicio) / 86400000);
}


function numeroSeguro(valor) {

    valor = convertirSerialAnalytics(valor);

    const numero = Number(valor);

    return Number.isFinite(numero)
        ? numero
        : 0;
}


// =====================================================
// FORMATEAR PORCENTAJE
// GA4 normalmente entrega 0.7059 -> 70.59%
// =====================================================

function formatearPorcentaje(valor) {

    if (typeof valor === "string" && valor.trim().endsWith("%")) {
        return escaparHTML(valor);
    }

    const numero = Number(valor);

    if (Number.isNaN(numero)) {
        return "0.00%";
    }

    return (
        (numero * 100).toLocaleString(
            "es-GT",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ) + "%"
    );
}


// =====================================================
// NORMALIZAR TEXTO PARA BÚSQUEDAS
// =====================================================

function normalizarTexto(valor) {

    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}


// =====================================================
// EVITAR INYECTAR HTML DESDE LOS DATOS
// =====================================================

function escaparHTML(valor) {

    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =====================================================
// MOSTRAR / LIMPIAR ERROR
// =====================================================

function mostrarError(mensaje) {

    console.error(
        "Error cargando Analytics:",
        mensaje
    );

    const elemento =
        document.getElementById("errorAnalytics");

    if (elemento) {
        elemento.textContent = mensaje;
        elemento.style.display = "block";
    }
}


function limpiarError() {

    const elemento =
        document.getElementById("errorAnalytics");

    if (elemento) {
        elemento.textContent = "";
        elemento.style.display = "none";
    }
}


// =====================================================
// ESTADO DEL BOTÓN ACTUALIZAR
// =====================================================

function establecerEstadoActualizando(actualizando) {

    const boton =
        document.querySelector(".btn-actualizar");

    if (!boton) {
        return;
    }

    boton.disabled = actualizando;
    boton.textContent =
        actualizando
            ? "Actualizando..."
            : "↻ Actualizar";
}


// =====================================================
// ACTUALIZAR MANUALMENTE
// =====================================================

function actualizarAnalytics() {

    console.log("Actualizando Analytics...");
    establecerEstadoActualizando(true);

    cargarAnalytics()
        .catch(error => {
            console.error(error);
        })
        .finally(() => {
            establecerEstadoActualizando(false);
        });
}


// =====================================================
// EVENTOS DE BÚSQUEDA / FILTROS
// =====================================================

function inicializarFiltros() {

    const buscador =
        document.getElementById("buscarEmpresa");

    const filtroTipo =
        document.getElementById("filtroTipo");

    const empresaSelect =
        document.getElementById("empresaSelect");

    if (buscador) {
        buscador.addEventListener("input", aplicarFiltros);
    }

    if (filtroTipo) {
        filtroTipo.addEventListener("change", aplicarFiltros);
    }

    if (empresaSelect) {
        empresaSelect.addEventListener("change", () => {
            const empresaSeleccionada = empresaSelect.value;
            const navButtons = document.querySelectorAll(".nav-btn");

            navButtons.forEach(btn => {
                btn.classList.toggle("active", btn.dataset.view === "empresa");
            });

            const generalView = document.getElementById("view-general");
            const empresaView = document.getElementById("view-empresa");

            if (generalView && empresaView) {
                generalView.hidden = true;
                empresaView.hidden = false;
            }

            if (empresaSeleccionada) {
                renderizarGraficaEmpresa(datosOriginales.filter(item => String(item.EMPRESA || "") === empresaSeleccionada));
            } else {
                renderizarGraficaEmpresa(datosOriginales);
            }
        });
    }

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.addEventListener("click", () => {
            const view = button.dataset.view;
            const generalView = document.getElementById("view-general");
            const empresaView = document.getElementById("view-empresa");

            document.querySelectorAll(".nav-btn").forEach(btn => {
                btn.classList.toggle("active", btn === button);
            });

            if (generalView && empresaView) {
                const mostrarGeneral = view === "general";
                generalView.hidden = !mostrarGeneral;
                empresaView.hidden = mostrarGeneral;
            }
        });
    });
}

function renderizarGraficaGeneral(datos) {

    const contenedor = document.getElementById("chartGeneral");

    if (!contenedor) {
        return;
    }

    const resumen = {};

    datos.forEach(item => {
        const empresa = String(item.EMPRESA || "Sin empresa");
        resumen[empresa] = (resumen[empresa] || 0) + numeroSeguro(item.SESIONES);
    });

    const items = Object.entries(resumen)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const maxValue = Math.max(...items.map(([, value]) => value), 1);

    contenedor.innerHTML = items.length === 0
        ? '<div class="empty-chart">Sin datos</div>'
        : items.map(([label, value]) => {
            const height = Math.max((value / maxValue) * 100, 12);
            return `
                <div class="chart-bar-item">
                    <div class="chart-bar-value">${formatearNumero(value)}</div>
                    <div class="chart-bar" style="height:${height}%"></div>
                    <div class="chart-bar-label">${escaparHTML(label)}</div>
                </div>
            `;
        }).join("");
}

function obtenerCategoriasGenerales(valor) {
    const categorias = String(valor || "Sin especificar")
        .split(/[,;|\n]+/)
        .map(categoria => categoria.trim())
        .filter(Boolean);

    return categorias.length ? [...new Set(categorias)] : ["Sin especificar"];
}

function agruparGrafica(datos, campo, metrica, limite = 6) {
    const resumen = {};

    datos.forEach(item => {
        const categorias = obtenerCategoriasGenerales(item[campo]);
        const valor = numeroSeguro(item[metrica]);
        const valorPorCategoria = valor / categorias.length;

        categorias.forEach(nombre => {
            resumen[nombre] = (resumen[nombre] || 0) + valorPorCategoria;
        });
    });

    return Object.entries(resumen)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limite)
        .map(([nombre, valor]) => [nombre, Math.round(valor * 100) / 100]);
}

function renderizarListaGrafica(id, items) {
    const contenedor = document.getElementById(id);

    if (!contenedor) {
        return;
    }

    const maximo = Math.max(...items.map(([, valor]) => valor), 1);
    contenedor.innerHTML = items.length
        ? items.map(([nombre, valor]) => `
            <div class="general-fila-grafica">
                <div class="general-fila-cabecera">
                    <span title="${escaparHTML(nombre)}">${escaparHTML(nombre)}</span>
                    <strong>${formatearNumero(valor)}</strong>
                </div>
                <div class="general-fila-pista"><i style="width:${Math.max(valor / maximo * 100, 3)}%"></i></div>
            </div>
        `).join("")
        : '<div class="empty-chart">Sin datos</div>';
}

function fechaActividadGeneral(valor) {
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
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function claveFechaGeneral(fecha) {
    return [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, "0"),
        String(fecha.getDate()).padStart(2, "0")
    ].join("-");
}

function renderizarGraficaActividadGeneral(datos) {
    const contenedor = document.getElementById("chartInteraccion");

    if (!contenedor) {
        return;
    }

    const sesionesPorFecha = {};

    datos.forEach(item => {
        const fecha = fechaActividadGeneral(
            item.ULTIMA_ACTIVIDAD || item.ULTIMO_ACCESO || item.PRIMER_ACCESO
        );

        if (!fecha) {
            return;
        }

        const clave = claveFechaGeneral(fecha);
        sesionesPorFecha[clave] = {
            fecha,
            sesiones: (sesionesPorFecha[clave]?.sesiones || 0) + numeroSeguro(item.SESIONES)
        };
    });

    const fechasConDatos = Object.values(sesionesPorFecha).sort((a, b) => a.fecha - b.fecha);

    if (!fechasConDatos.length) {
        contenedor.innerHTML = '<div class="empty-chart">Sin actividad para mostrar</div>';
        return;
    }

    const puntos = [];
    const primeraFecha = new Date(fechasConDatos[0].fecha);
    const ultimaFecha = new Date();
    ultimaFecha.setHours(0, 0, 0, 0);

    for (const fecha = new Date(primeraFecha); fecha <= ultimaFecha; fecha.setDate(fecha.getDate() + 1)) {
        const clave = claveFechaGeneral(fecha);
        puntos.push({
            fecha: new Date(fecha),
            sesiones: sesionesPorFecha[clave]?.sesiones || 0
        });
    }

    const ancho = 900;
    const alto = 330;
    const margen = { superior: 24, derecho: 24, inferior: 70, izquierdo: 48 };
    const anchoUtil = ancho - margen.izquierdo - margen.derecho;
    const altoUtil = alto - margen.superior - margen.inferior;
    const maximo = Math.max(...puntos.map(punto => punto.sesiones), 1);
    const coordenadas = puntos.map((punto, indice) => ({
        ...punto,
        x: puntos.length === 1
            ? margen.izquierdo + anchoUtil / 2
            : margen.izquierdo + indice / (puntos.length - 1) * anchoUtil,
        y: margen.superior + altoUtil - punto.sesiones / maximo * altoUtil
    }));
    const linea = coordenadas.map(punto => `${punto.x},${punto.y}`).join(" ");
    const area = `${margen.izquierdo},${margen.superior + altoUtil} ${linea} ${margen.izquierdo + anchoUtil},${margen.superior + altoUtil}`;
    const pasoEtiqueta = puntos.length <= 24 ? 1 : Math.ceil(puntos.length / 18);
    const zonasInteraccion = coordenadas.map((punto, indice) => {
        const puntoAnterior = coordenadas[indice - 1]?.x || margen.izquierdo;
        const puntoSiguiente = coordenadas[indice + 1]?.x || margen.izquierdo + anchoUtil;
        const inicioZona = indice === 0 ? margen.izquierdo : (puntoAnterior + punto.x) / 2;
        const finZona = indice === coordenadas.length - 1 ? margen.izquierdo + anchoUtil : (punto.x + puntoSiguiente) / 2;
        return `<rect x="${inicioZona}" y="${margen.superior}" width="${Math.max(finZona - inicioZona, 1)}" height="${altoUtil}" class="general-linea-zona" data-indice="${indice}" />`;
    }).join("");
    const etiquetas = coordenadas.map((punto, indice) => {
        const mostrar = indice === 0 || indice === puntos.length - 1 || indice % pasoEtiqueta === 0;
        return mostrar
            ? `<text x="${punto.x}" y="${alto - 24}" class="general-linea-fecha" text-anchor="end" transform="rotate(-35 ${punto.x} ${alto - 24})">${punto.fecha.toLocaleDateString("es-GT", { day: "2-digit", month: "short" })}</text>`
            : "";
    }).join("");

    contenedor.innerHTML = `<svg class="general-linea-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Sesiones por fecha">
        <line x1="${margen.izquierdo}" y1="${margen.superior}" x2="${margen.izquierdo}" y2="${margen.superior + altoUtil}" class="general-linea-eje" />
        <line x1="${margen.izquierdo}" y1="${margen.superior + altoUtil}" x2="${margen.izquierdo + anchoUtil}" y2="${margen.superior + altoUtil}" class="general-linea-eje" />
        <polygon points="${area}" class="general-linea-area" />
        <polyline points="${linea}" class="general-linea-trazo" />
        ${coordenadas.map((punto, indice) => {
            const etiquetaX = Math.min(Math.max(punto.x - 70, margen.izquierdo), ancho - margen.derecho - 140);
            const etiquetaY = Math.max(punto.y - 52, 6);
            const fechaTexto = punto.fecha.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
            return `<line x1="${punto.x}" y1="${margen.superior}" x2="${punto.x}" y2="${margen.superior + altoUtil}" class="general-linea-guia" data-indice="${indice}" /><circle cx="${punto.x}" cy="${punto.y}" r="5" class="general-linea-punto" data-indice="${indice}"><title>${fechaTexto} - ${formatearNumero(punto.sesiones)} sesiones</title></circle><g class="general-linea-informacion" data-indice="${indice}" transform="translate(${etiquetaX} ${etiquetaY})"><rect width="140" height="38" rx="6" /><text x="70" y="15" text-anchor="middle">${fechaTexto}</text><text x="70" y="30" text-anchor="middle">${formatearNumero(punto.sesiones)} sesiones</text></g>`;
        }).join("")}
        ${zonasInteraccion}
        ${etiquetas}
    </svg>`;

    const svg = contenedor.querySelector(".general-linea-svg");
    const ocultarGuias = () => {
        svg.querySelectorAll(".general-linea-guia, .general-linea-punto, .general-linea-informacion").forEach(elemento => {
            elemento.classList.remove("activo");
        });
    };

    svg.querySelectorAll(".general-linea-zona").forEach(zona => {
        zona.addEventListener("mouseenter", () => {
            ocultarGuias();
            const indice = zona.dataset.indice;
            svg.querySelectorAll(`.general-linea-guia[data-indice='${indice}'], .general-linea-punto[data-indice='${indice}']`).forEach(elemento => {
                elemento.classList.add("activo");
            });
            const informacion = svg.querySelector(`.general-linea-informacion[data-indice='${indice}']`);
            informacion?.classList.add("activo");
        });
    });
    svg.addEventListener("mouseleave", ocultarGuias);
}

function renderizarGraficasGenerales(datos) {
    renderizarListaGrafica(
        "chartPaises",
        agruparGrafica(datos, "PAISES", "USUARIOS_ACTIVOS")
    );
    renderizarListaGrafica(
        "chartDispositivos",
        agruparGrafica(datos, "CATEGORIAS_DISPOSITIVO", "SESIONES")
    );
    renderizarListaGrafica(
        "chartNavegadores",
        agruparGrafica(datos, "NAVEGADORES", "SESIONES")
    );

    renderizarGraficaActividadGeneral(datos);
}

function actualizarGraficasGeneralesSeguras(datos) {
    try {
        renderizarGraficasGenerales(Array.isArray(datos) ? datos : []);
    } catch (error) {
        console.error("No se pudieron renderizar las gráficas generales:", error);
        ["chartPaises", "chartDispositivos", "chartNavegadores", "chartInteraccion"].forEach(id => {
            const contenedor = document.getElementById(id);
            if (contenedor) {
                contenedor.innerHTML = '<div class="empty-chart">Sin datos disponibles</div>';
            }
        });
    }
}

function renderizarGraficaUsoDashboards(datos) {
    const contenedor = document.getElementById("chartUsoDashboards");

    if (!contenedor) {
        return;
    }

    const usados = datos.filter(item => numeroSeguro(item.SESIONES) > 0).length;
    const noUsados = datos.length - usados;
    const total = usados + noUsados;

    if (!total) {
        contenedor.innerHTML = '<div class="empty-chart">Sin dashboards para comparar</div>';
        return;
    }

    const porcentajeUsados = (usados / total) * 100;
    const porcentajeNoUsados = 100 - porcentajeUsados;

    contenedor.innerHTML = `
        <div class="uso-dashboard-pie" style="--porcentaje-usados: ${porcentajeUsados}%" role="img" aria-label="${usados} dashboards usados y ${noUsados} no usados">
            <div class="uso-dashboard-pie-centro">
                <strong>${total}</strong>
                <span>dashboards</span>
            </div>
        </div>
        <div class="uso-dashboard-leyenda">
            <div class="uso-dashboard-leyenda-item">
                <span class="uso-dashboard-color usado"></span>
                <span>Usados</span>
                <strong>${usados} (${porcentajeUsados.toFixed(0)}%)</strong>
            </div>
            <div class="uso-dashboard-leyenda-item">
                <span class="uso-dashboard-color no-usado"></span>
                <span>No usados</span>
                <strong>${noUsados} (${porcentajeNoUsados.toFixed(0)}%)</strong>
            </div>
        </div>
    `;
}

function renderizarGraficaEmpresa(datos) {

    const contenedor = document.getElementById("chartEmpresa");

    if (!contenedor) {
        return;
    }

    const resumen = {};

    datos.forEach(item => {
        const dashboard = String(item.TITULO_ANALYTICS || item.TIPO_DASHBOARD || "Sin nombre");
        resumen[dashboard] = (resumen[dashboard] || 0) + numeroSeguro(item.VISTAS);
    });

    const items = Object.entries(resumen)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const maxValue = Math.max(...items.map(([, value]) => value), 1);

    contenedor.innerHTML = items.length === 0
        ? '<div class="empty-chart">Seleccione una empresa o no hay datos</div>'
        : items.map(([label, value]) => {
            const height = Math.max((value / maxValue) * 100, 12);
            return `
                <div class="chart-bar-item">
                    <div class="chart-bar-value">${formatearNumero(value)}</div>
                    <div class="chart-bar" style="height:${height}%"></div>
                    <div class="chart-bar-label">${escaparHTML(label)}</div>
                </div>
            `;
        }).join("");
}


// =====================================================
// CARGAR CUANDO EL HTML ESTÉ LISTO
// =====================================================

let dashboardIniciado = false;

function iniciarDashboard() {
    if (dashboardIniciado) {
        return;
    }

    dashboardIniciado = true;
    inicializarFiltros();
    actualizarAnalytics();

    if (intervaloActualizacion) {
        clearInterval(intervaloActualizacion);
    }

    intervaloActualizacion =
        setInterval(
            actualizarAnalytics,
            TIEMPO_ACTUALIZACION
        );
}

document.addEventListener("DOMContentLoaded", iniciarDashboard);
document.addEventListener("sidebar:loaded", iniciarDashboard, { once: true });