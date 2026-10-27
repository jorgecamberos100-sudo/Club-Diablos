// Cálculo de cuentas de un equipo. Funciones puras: reciben los datos y regresan cifras.
import { sum, money } from "./util.js";

export function calc(fin, playersById) {
  const cuentas = fin.cuentas.map((c) => ({ ...c, name: (playersById[c.player] || {}).name || c.player }));
  const nMulta = cuentas.filter((c) => c.multa).length;
  const share = nMulta && fin.multa ? fin.multa.total / nMulta : 0;
  cuentas.forEach((c) => {
    c.toca = fin.cuota + (c.multa ? share : 0);
    c.saldo = (c.aportado || 0) - c.toca;
  });
  const aportado = sum(cuentas, (c) => c.aportado);
  fin.gastos = fin.gastos || []; fin.orden = fin.orden || fin.liga.map((x) => x.k);
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
  const parte = reparto(fin.cuota, cubre);
  return {
    parte,
    cuentas, nMulta, share, aportado, ligaPag, gastosPag, items, cubre,
    cubreTot: sum(cubre, (x) => x.costo),
    ingresos: sum(fin.ingresos || [], (x) => x.monto),
    caja: aportado + sum(fin.ingresos || [], (x) => x.monto) - ligaPag - gastosPag,
    falta: sum(cuentas, (c) => Math.max(0, -c.saldo)),
    favor: sum(cuentas, (c) => Math.max(0, c.saldo)),
    ligaTot: sum(fin.liga, (x) => x.costo),
    ligaFalta: sum(fin.liga, (x) => Math.max(0, x.costo - x.pagado)),
    gastosFalta: sum(fin.gastos, (x) => Math.max(0, x.costo - x.pagado)),
  };
}

// A dónde va cada peso de la cuota: se reparte entre los conceptos según lo que cuesta cada uno.
// Se redondea a pesos completos y los centavos sobrantes van a los conceptos con mayor residuo, para que la suma dé exacto.
export function reparto(cuota, cubre) {
  const tot = sum(cubre, (x) => x.costo);
  if (!tot || !cuota) return [];
  const raw = cubre.map((x) => ({ k: x.k, label: x.label, costo: x.costo, v: (cuota * x.costo) / tot }));
  raw.forEach((r) => { r.monto = Math.floor(r.v); });
  let rest = Math.round(cuota - sum(raw, (r) => r.monto));
  raw.slice().sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v))).forEach((r) => { if (rest > 0) { r.monto += 1; rest -= 1; } });
  return raw.map(({ k, label, costo, monto }) => ({ k, label, costo, monto }));
}

// Variables que pueden usar los textos de preguntas y secciones.
export function textVars(fin, C, contact) {
  const dep = fin.liga.find((x) => x.k === "deposito");
  return {
    cuota: money(fin.cuota),
    multa: money(C.share),
    cuotaMasMulta: money(fin.cuota + C.share),
    multaTotal: money(fin.multa ? fin.multa.total : 0),
    original: money((fin.multa && fin.multa.original) || 0),
    nMulta: C.nMulta,
    nPagan: C.cuentas.length,
    pagaMulta: C.cuentas.filter((c) => c.multa).map((c) => c.name).join(", "),
    ligaFalta: money(C.ligaFalta),
    gastosFalta: money(C.gastosFalta),
    falta: money(C.falta),
    cubreTot: money(C.cubreTot),
    cuotaDesglose: C.parte.map((x) => x.label.toLowerCase() + " " + money(x.monto)).join(", "),
    cubreLista: C.cubre.map((x) => x.label.toLowerCase() + " " + money(x.costo)).join(", "),
    orden: C.items.map((o) => o.x.label.toLowerCase()).join(", "),
    deposito: money(dep ? dep.costo : 0),
    contacto: contact || "el administrador",
  };
}
