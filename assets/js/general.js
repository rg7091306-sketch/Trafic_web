// =====================================================
// CONTROL GENERAL — KPIs, interacción, dashboards, países,
// actividad en el tiempo, sesiones por área y empresas.
// Solo se muestran datos exactos de Analytics; lo que no se puede
// calcular con el filtro actual aparece como "—".
// =====================================================

function renderizarKpisGenerales(metricas) {
    colocarTexto("kpiUsuarios", dato(metricas.usuarios));
    colocarTexto("kpiUsuariosSub", metricas.nuevos !== null
        ? `${fmt(metricas.nuevos)} nuevos en el periodo`
        : "Usuarios únicos");
    colocarTexto("kpiSesiones", dato(metricas.sesiones));
    colocarTexto("kpiSesionesSub", metricas.tasaInteraccion !== null
        ? `${fmtPct(metricas.tasaInteraccion, 0)} con interacción`
        : "No disponible con este filtro");
    colocarTexto("kpiVistas", fmt(metricas.vistas));
    colocarTexto("kpiVistasSesion", dato(metricas.vistasPorSesion, valor => fmt(valor, 1)));
    colocarTexto("kpiEventos", fmt(metricas.eventos));
    colocarTexto("kpiEventosSub", metricas.eventosPorSesion !== null
        ? `${fmt(metricas.eventosPorSesion, 1)} por sesión`
        : "Total registrado");
    colocarTexto("kpiRecurrentes", dato(metricas.recurrentes));
    colocarTexto("kpiRecurrentesSub", metricas.recurrentes !== null && metricas.totalUsuarios
        ? `${fmtPct(metricas.recurrentes / metricas.totalUsuarios, 0)} regresaron`
        : "No disponible con este filtro");

    colocarTexto("statTiempoUsuario", dato(metricas.tiempoPorUsuario, fmtDuracion));
    colocarTexto("statSesionesUsuario", dato(metricas.sesionesInteraccionPorUsuario, valor => fmt(valor, 1)));
    colocarTexto("statTiempoSesion", dato(metricas.tiempoPorSesion, fmtDuracion));
    colocarTexto("statTasa", dato(metricas.tasaInteraccion, fmtPct));
    colocarTexto("statTasaSub", metricas.sesionesInteraccion !== null
        ? `${fmt(metricas.sesionesInteraccion)} de ${fmt(metricas.sesiones)} sesiones`
        : "No disponible con este filtro");
}

function renderizarTiempoPorDia(filtrado) {
    const dias = serieDiariaExacta(filtrado);

    if (!dias) {
        noDisponible("chartTiempo", MENSAJE_SOLO_SIN_FILTRO);
        return;
    }

    renderLinea("chartTiempo", [{
        nombre: "Tiempo de interacción",
        color: COLORES[3],
        puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.segundos }))
    }], { formato: fmtDuracion, unidadEje: 60 });
}

function renderizarActividad(filtrado) {
    const dias = serieDiariaExacta(filtrado);
    const resumen = document.getElementById("resumenActividad");

    if (!dias) {
        noDisponible("chartActividad", MENSAJE_SOLO_SIN_FILTRO);
        if (resumen) resumen.innerHTML = "";
        return;
    }

    renderLinea("chartActividad", [
        { nombre: "Sesiones", color: COLORES[0], puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.sesiones })) },
        { nombre: "Usuarios activos", color: COLORES[1], puntos: dias.map(dia => ({ fecha: dia.fecha, valor: dia.usuarios })) }
    ], { totales: false });

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

    const sesionesPorEmpresa = new Map(
        totalesPorGrupo(filas, "_empresa", "sesiones").items.map(item => [item.nombre, item.valor])
    );
    const empresas = valoresUnicos(filas, "_empresa")
        .map(empresa => {
            const propias = filas.filter(fila => fila._empresa === empresa);
            return {
                empresa,
                dashboards: propias.length,
                sesiones: sesionesPorEmpresa.get(empresa) ?? null,
                vistas: sumar(propias, "_vistas")
            };
        })
        .sort((a, b) => (b.sesiones ?? -1) - (a.sesiones ?? -1) || b.vistas - a.vistas);

    cuerpo.innerHTML = empresas.length
        ? empresas.map(item => `
            <tr>
                <td><div class="cell-main">${escaparHTML(item.empresa)}</div></td>
                <td class="num">${fmt(item.dashboards)}</td>
                <td class="num">${dato(item.sesiones)}</td>
                <td class="num">${fmt(item.vistas)}</td>
            </tr>`).join("")
        : '<tr><td colspan="4" class="empty-cell">Sin empresas para el filtro seleccionado.</td></tr>';
}

document.addEventListener("analytics:actualizado", ({ detail }) => {
    const { filas, metricas, filtrado } = detail;

    renderizarKpisGenerales(metricas);
    renderizarTiempoPorDia(filtrado);

    // Sesiones de cada título de página: dato exacto de Analytics por fila
    renderRanking(
        "rankDashboards",
        filas.map(fila => ({ nombre: fila._titulo, valor: fila._sesiones })).sort((a, b) => b.valor - a.valor),
        { columnas: ["Título de página", "Sesiones"], limite: 8 }
    );

    const paises = desglose("paises", filas, "PAISES", filtrado);
    if (paises) {
        renderDona("donaPaises", paises, {
            etiqueta: "Usuarios",
            centro: dato(metricas.usuarios),
            mostrarValor: false
        });
    } else {
        noDisponible("donaPaises");
    }

    renderizarActividad(filtrado);

    // Barras y no dona: una sesión puede pasar por dashboards de varias áreas,
    // así que el porcentaje se calcula sobre el total real de sesiones.
    const porArea = totalesPorGrupo(filas, "_area", "sesiones");
    if (porArea.exacto) {
        renderRanking("donaAreas", porArea.items, {
            columnas: ["Área", "Sesiones"],
            total: metricas.sesiones
        });
    } else {
        noDisponible("donaAreas");
    }

    renderizarTablaEmpresas(filas);
});
