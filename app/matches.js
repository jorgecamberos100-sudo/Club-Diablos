// Ayudas para partidos: próximo, último y textos de fecha.
export function sorted(team) {
  return (team.matches || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function nextMatch(team) {
  const now = Date.now() - 3 * 3600e3; // sigue siendo "próximo" hasta 3 horas después de empezar
  return sorted(team).find((m) => !m.score && new Date(m.date).getTime() >= now) || null;
}

export function lastPlayed(team) {
  return sorted(team).filter((m) => m.score).pop() || null;
}

export function whenText(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
  return day.charAt(0).toUpperCase() + day.slice(1) + " · " + time;
}

export function daysLeft(iso) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(iso); b.setHours(0, 0, 0, 0);
  const n = Math.round((b - a) / 86400e3);
  return n <= 0 ? "Hoy" : n === 1 ? "Mañana" : `En ${n} días`;
}

export function versus(m, clubName) {
  return m.home === false ? `${m.rival} vs ${clubName}` : m.home === true ? `${clubName} vs ${m.rival}` : `vs ${m.rival}`;
}

export function result(m) {
  if (!m.score) return null;
  const { for: f, against: a } = m.score;
  return { text: `${f} - ${a}`, kind: f > a ? "win" : f < a ? "loss" : "draw", label: f > a ? "Ganamos" : f < a ? "Perdimos" : "Empate" };
}
