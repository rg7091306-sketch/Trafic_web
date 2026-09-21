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

    const texto = escaparHTML(valor);

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


function numeroSeguro(valor) {

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

    const contenedor = document.getElementById("chartInteraccion");

    if (!contenedor) {
        return;
    }

    const sesiones = sumarCampo(datos, "SESIONES");
    const sesionesInteraccion = sumarCampo(datos, "SESIONES_CON_INTERACCION");
    const eventos = sumarCampo(datos, "TOTAL_EVENTOS");
    const porcentaje = sesiones ? sesionesInteraccion / sesiones * 100 : 0;

    contenedor.innerHTML = `
        <div class="general-metrica-principal">
            <strong>${porcentaje.toLocaleString("es-GT", { maximumFractionDigits: 1 })}%</strong>
            <span>sesiones con interacción</span>
        </div>
        <div class="general-metricas-secundarias">
            <div><strong>${formatearNumero(sesionesInteraccion)}</strong><span>con interacción</span></div>
            <div><strong>${formatearNumero(eventos)}</strong><span>eventos totales</span></div>
        </div>
    `;
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