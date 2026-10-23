// Saldos, caja y exportación a CSV. Funciones puras (se prueban sin navegador).
// Solo cuentan los registros activos: lo anulado se conserva como historial pero no suma.
const n2 = (x) => Math.round((+x || 0) * 100) / 100;

export function balances(teams, charges, movements) {
  return teams.map((t) => {
    const charged = charges.filter((c) => c.team_id === t.id && c.status === "active").reduce((a, c) => a + +c.amount, 0);
    const paid = movements.filter((m) => m.team_id === t.id && m.kind === "payment" && m.status === "active").reduce((a, m) => a + +m.amount, 0);
    return { team_id: t.id, name: t.name, charged: n2(charged), paid: n2(paid), balance: n2(charged - paid) };   // saldo > 0: debe; < 0: pagó de más
  });
}

export function cash(movements) {
  const act = movements.filter((m) => m.status === "active"), sum = (f) => n2(act.filter(f).reduce((a, m) => a + +m.amount, 0));
  const income = sum((m) => m.kind === "payment" || m.kind === "income"), expense = sum((m) => m.kind === "expense");
  return { income, expense, net: n2(income - expense) };
}

// CSV para Excel: separador coma, UTF-8 con BOM. Las celdas que empiezan con = + - @ se escapan para que no se ejecuten como fórmula.
export function toCSV(columns, rows) {
  const cell = (v) => {
    let t = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "'" + t;
    return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  return "﻿" + [columns.map((c) => cell(c[1])).join(","), ...rows.map((r) => columns.map((c) => cell(typeof c[0] === "function" ? c[0](r) : r[c[0]])).join(","))].join("\r\n") + "\r\n";
}
