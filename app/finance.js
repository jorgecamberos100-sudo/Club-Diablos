// Cálculo de cuentas de un equipo. Funciones puras: reciben los datos y regresan cifras.
import { sum, money } from "./util.js";

export function calc(fin, playersById = {}) {
  const pById = playersById || {};
  const cuentas = (fin.cuentas || []).map((c) => ({ ...c, name: (pById[c.player] || {}).name || c.player }));
  const nMulta = cuentas.filter((c) => c.multa).length;
  const share = nMulta && fin.multa ? fin.multa.total / nMulta : 0;
  cuentas.forEach((c) => {
    c.toca = (fin.cuota || 0) + (c.multa ? share : 0);
    c.saldo = (c.aportado || 0) - c.toca;
  });
  const aportado = sum(cuentas, (c) => c.aportado);
  const liga = fin.liga || [];
  const gastos = fin.gastos || [];
  const orden = fin.orden || liga.map((x) => x.k);
  const ligaPag = sum(liga, (x) => x.pagado);
  const gastosPag = sum(gastos, (x) => x.pagado);
  const items = orden
    .map((k) => {
      let i = liga.findIndex((y) => y.k === k);
      if (i > -1) return { x: liga[i], src: "liga" };
      i = gastos.findIndex((y) => y.k === k);
      return i > -1 ? { x: gastos[i], src: "gastos" } : null;
    })
    .filter(Boolean);
  const cubre = liga.filter((x) => x.k !== "multa").concat(gastos);
  const parte = reparto(fin.cuota || 0, cubre);
  return {
    parte,
    cuentas, nMulta, share, aportado, ligaPag, gastosPag, items, cubre,
    cubreTot: sum(cubre, (x) => x.costo),
    ingresos: sum(fin.ingresos || [], (x) => x.monto),
    caja: aportado + sum(fin.ingresos || [], (x) => x.monto) - ligaPag - gastosPag,
    falta: sum(cuentas, (c) => Math.max(0, -c.saldo)),
    favor: sum(cuentas, (c) => Math.max(0, c.saldo)),
    ligaTot: sum(liga, (x) => x.costo),
    ligaFalta: sum(liga, (x) => Math.max(0, x.costo - x.pagado)),
    gastosFalta: sum(gastos, (x) => Math.max(0, x.costo - x.pagado)),
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
export function textVars(fin, C = {}, contact) {
  const finObj = fin || {};
  const cObj = C || {};
  const dep = (finObj.liga || []).find((x) => x.k === "deposito");
  return {
    cuota: money(finObj.cuota || 0),
    multa: money(cObj.share || 0),
    cuotaMasMulta: money((finObj.cuota || 0) + (cObj.share || 0)),
    multaTotal: money(finObj.multa ? finObj.multa.total : 0),
    original: money((finObj.multa && finObj.multa.original) || 0),
    nMulta: cObj.nMulta || 0,
    nPagan: (cObj.cuentas || []).length,
    pagaMulta: (cObj.cuentas || []).filter((c) => c.multa).map((c) => c.name).join(", "),
    ligaFalta: money(cObj.ligaFalta || 0),
    gastosFalta: money(cObj.gastosFalta || 0),
    falta: money(cObj.falta || 0),
    cubreTot: money(cObj.cubreTot || 0),
    cuotaDesglose: (cObj.parte || []).map((x) => x.label.toLowerCase() + " " + money(x.monto)).join(", "),
    cubreLista: (cObj.cubre || []).map((x) => x.label.toLowerCase() + " " + money(x.costo)).join(", "),
    orden: (cObj.items || []).map((o) => o.x.label.toLowerCase()).join(", "),
    deposito: money(dep ? dep.costo : 0),
    contacto: contact || "el administrador",
  };
}
