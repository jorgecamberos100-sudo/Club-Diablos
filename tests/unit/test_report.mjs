import { balances, cash, toCSV } from "../../app/league/report.js";
let ok = 0, bad = 0; const t = (n, c, i) => (c ? (ok++, console.log("  ok  ", n)) : (bad++, console.log("  FALLA", n, i ?? "")));
const teams = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const ch = [{ team_id: "a", amount: "2500.00", status: "active" }, { team_id: "a", amount: 300, status: "void" }, { team_id: "b", amount: 100.1, status: "active" }, { team_id: "b", amount: 0.2, status: "active" }];
const mv = [{ team_id: "a", kind: "payment", amount: 1000, status: "active" }, { team_id: "a", kind: "payment", amount: 500, status: "void" }, { team_id: "b", kind: "payment", amount: 400, status: "active" },
  { team_id: null, kind: "income", amount: 1500, status: "active" }, { team_id: null, kind: "expense", amount: 800, status: "active" }, { team_id: null, kind: "expense", amount: 50, status: "void" }];
const b = balances(teams, ch, mv);
t("saldo = cargos activos − pagos activos", b[0].charged === 2500 && b[0].paid === 1000 && b[0].balance === 1500, JSON.stringify(b[0]));
t("lo anulado no suma", b[0].charged === 2500);
t("pago de más deja saldo negativo (a favor)", b[1].balance === -299.7, JSON.stringify(b[1]));
t("sin errores de punto flotante", b[1].charged === 100.3);
t("caja: ingresos incluyen pagos y otros ingresos; gastos aparte", JSON.stringify(cash(mv)) === JSON.stringify({ income: 2900, expense: 800, net: 2100 }), JSON.stringify(cash(mv)));
const csv = toCSV([["name", "Equipo"], [(r) => r.v, "Valor"]], [{ name: 'A, "B"', v: "=1+1" }, { name: "Ñandú", v: -5 }, { name: "x", v: "@cmd" }]);
t("CSV con BOM y encabezados", csv.startsWith("﻿Equipo,Valor\r\n"));
t("comillas y comas se escapan", csv.includes('"A, ""B"""'));
t("fórmulas se neutralizan, números negativos no", csv.includes("'=1+1") && csv.includes(",-5\r\n") && csv.includes("'@cmd"));
t("acentos intactos", csv.includes("Ñandú"));
console.log(`\n${ok} pruebas pasaron, ${bad} fallaron`); process.exit(bad ? 1 : 0);
