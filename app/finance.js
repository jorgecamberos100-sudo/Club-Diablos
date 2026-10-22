// Cálculo de cuentas de un equipo. Funciones puras: reciben los datos y regresan cifras.
import { sum, money } from "./util.js";

export function calc(fin, playersById) {
  const cuentas = fin.cuentas.map((c) => ({ ...c, name: (playersById[c.player] || {}).name || c.player }));
  const nMulta = cuentas.filter((c) => c.multa).length;
  const share = nMulta ? fin.multa.total / nMulta : 0;
  cuentas.forEach((c) => {
    c.toca = fin.cuota + (c.multa ? share : 0);
    c.saldo = (c.aportado || 0) - c.toca;
  });
  const aportado = sum(cuentas, (c) => c.aportado);
  const ligaPag = sum(fin.liga, (x) => x.pagado);
  const gastosPag = sum(fin.gastos, (x) => x.pagado);
  const items = fin.orden
    .map((k) => {
      let i = fin.liga.findIndex((y) => y.k === k);
      if (i > -1) return { x: fin.liga[i], src: "liga" };
      i = fin.gastos.findIndex((y) => y.k === k);
      return i > -1 ? { x: fin.gastos[i], src: "gastos" } : null;
    })
    .filter(Boolean);
  const cubre = fin.liga.filter((x) => x.k !== "multa").concat(fin.gastos);
  return {
    cuentas, nMulta, share, aportado, ligaPag, gastosPag, items, cubre,
    cubreTot: sum(cubre, (x) => x.costo),
    caja: aportado - ligaPag - gastosPag,
    falta: sum(cuentas, (c) => Math.max(0, -c.saldo)),
    favor: sum(cuentas, (c) => Math.max(0, c.saldo)),
    ligaTot: sum(fin.liga, (x) => x.costo),
    ligaFalta: sum(fin.liga, (x) => Math.max(0, x.costo - x.pagado)),
    gastosFalta: sum(fin.gastos, (x) => Math.max(0, x.costo - x.pagado)),
  };
}

// Variables que pueden usar los textos de preguntas y secciones.
export function textVars(fin, C, contact) {
  const dep = fin.liga.find((x) => x.k === "deposito");
  return {
    cuota: money(fin.cuota),
    multa: money(C.share),
    cuotaMasMulta: money(fin.cuota + C.share),
    multaTotal: money(fin.multa.total),
    original: money(fin.multa.original || 0),
    nMulta: C.nMulta,
    nPagan: C.cuentas.length,
    pagaMulta: C.cuentas.filter((c) => c.multa).map((c) => c.name).join(", "),
    ligaFalta: money(C.ligaFalta),
    gastosFalta: money(C.gastosFalta),
    falta: money(C.falta),
    cubreTot: money(C.cubreTot),
    cubreLista: C.cubre.map((x) => x.label.toLowerCase() + " " + money(x.costo)).join(", "),
    orden: C.items.map((o) => o.x.label.toLowerCase()).join(", "),
    deposito: money(dep ? dep.costo : 0),
    contacto: contact || "el administrador",
  };
}
