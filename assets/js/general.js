// =====================================================
// CONTROL GENERAL — KPIs, interacción, dashboards, países,
// actividad en el tiempo, uso de dashboards y empresas.
// =====================================================

function renderizarKpisGenerales(metricas, filtrado) {
    colocarTexto("kpiUsuarios", fmt(metricas.usuarios));
    colocarTexto("kpiUsuariosSub", filtrado
        ? "Suma por dashboard (aprox.)"
        : `${fmt(metricas.nuevos)} nuevos · ${fmt(metricas.recurrentes)} recurrentes`);
    colocarTexto("kpiSesiones", fmt(metricas.sesiones));
    colocarTexto("kpiSesionesSub", `${fmtPct(metricas.tasaInteraccion, 0)} con interacción`);
    colocarTexto("kpiVistas", fmt(metricas.vistas));
    colocarTexto("kpiVistasSesion", fmt(metricas.vistasPorSesion, 1));
    colocarTexto("kpiEventos", fmt(metricas.eventos));
    colocarTexto("kpiEventosSub", `${fmt(metricas.eventosPorSesion, 1)} por sesión`);
    colocarTexto("kpiRecurrentes", fmt(metricas.recurrentes));
    colocarTexto("kpiRecurrentesSub", metricas.totalUsuarios
        ? `${fmtPct(metricas.recurrentes / metricas.totalUsuarios, 0)} regresaron`
        : "Sin usuarios");

    colocarTexto("statTiempoUsuario", fmtDuracion(metricas.tiempoPorUsuario));
    colocarTexto("statSesionesUsuario", fmt(metricas.sesionesInteraccionPorUsuario, 1));
    colocarTexto("statTiempoSesion", fmtDuracion(metricas.tiempoPorSesion));
    colocarTexto("statTasa", fmtPct(metricas.tasaInteraccion));
    colocarTexto("statTasaSub", "Sesiones con interacción sobre el total");
}

function renderizarTiempoPorDia(filas) {
    const dias = serieDiaria(filas, "_ultimaActividad", {
        segundos: fila => fila._segundosSesion * fila._sesiones
    });

    renderLinea("chartTiempo", [{
        nombre: "Tiempo de interacción",
        color: COLORES[3],
        puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.segundos }))
    }], { formato: fmtDuracion, unidadEje: 60 });
}

function renderizarActividad(filas) {
    const dias = serieDiaria(filas, "_ultimaActividad", {
        sesiones: fila => fila._sesiones,
        usuarios: fila => fila._usuarios
    });

    renderLinea("chartActividad", [
        { nombre: "Sesiones", color: COLORES[0], puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.sesiones })) },
        { nombre: "Usuarios activos", color: COLORES[1], puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.usuarios })) }
    ], { totales: false });

    const resumen = document.getElementById("resumenActividad");

    if (!resumen) {
        return;
    }

    const conActividad = dias.filter(dia => dia.sesiones > 0);
    const ultima = conActividad.at(-1);

    resumen.innerHTML = ultima
        ? `<b>${fmt(conActividad.length)} días</b>con actividad · último registro ${fmtFecha(ultima.fecha)}`
        : "Sin actividad registrada.";
}

function renderizarTablaEmpresas(filas) {
    const cuerpo = document.getElementById("tablaEmpresas");

    if (!cuerpo) {
        return;
    }

    const empresas = valoresUnicos(filas, "_empresa")
        .map(empresa => {
            const propias = filas.filter(fila => fila._empresa === empresa);
            return {
                empresa,
                dashboards: propias.length,
                sesiones: sumar(propias, "_sesiones"),
                vistas: sumar(propias, "_vistas")
            };
        })
        .sort((a, b) => b.sesiones - a.sesiones || b.vistas - a.vistas);

    cuerpo.innerHTML = empresas.length
        ? empresas.map(item => `
            <tr>
                <td><div class="cell-main">${escaparHTML(item.empresa)}</div></td>
                <td class="num">${fmt(item.dashboards)}</td>
                <td class="num">${fmt(item.sesiones)}</td>
                <td class="num">${fmt(item.vistas)}</td>
            </tr>`).join("")
        : '<tr><td colspan="4" class="empty-cell">Sin empresas para el filtro seleccionado.</td></tr>';
}

document.addEventListener("analytics:actualizado", ({ detail }) => {
    const { filas, metricas, filtrado } = detail;

    renderizarKpisGenerales(metricas, filtrado);
    renderizarTiempoPorDia(filas);

    renderRanking(
        "rankDashboards",
        filas.map(fila => ({ nombre: fila._titulo, valor: fila._sesiones })).sort((a, b) => b.valor - a.valor),
        { columnas: ["Título de página", "Sesiones"], limite: 8 }
    );

    renderDona("donaPaises", agregarLista(filas, "PAISES"), {
        etiqueta: "Usuarios",
        centro: fmt(metricas.usuarios),
        mostrarValor: false
    });

    renderizarActividad(filas);

    renderDona("donaAreas", agruparPor(filas, "_area", "_sesiones"), {
        etiqueta: "Áreas",
        centro: fmt(valoresUnicos(filas, "_area").length),
        mostrarValor: false
    });

    renderizarTablaEmpresas(filas);
});
