export function badgeSvg({ label = "skill crucible", message, color }) {
  const l = xmlEscape(label);
  const m = xmlEscape(message);
  const lw = Math.ceil(String(label).length * 6.6) + 12;
  const mw = Math.ceil(String(message).length * 6.6) + 12;
  const w = lw + mw;
  const lx = lw / 2;
  const mx = lw + mw / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${l}: ${m}">
  <title>${l}: ${m}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="r">
    <rect width="${w}" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#r)">
    <path fill="#555" d="M0 0h${lw}v20H0z"/>
    <path fill="${color}" d="M${lw} 0h${mw}v20H${lw}z"/>
    <path fill="url(#s)" d="M0 0h${w}v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lx}" y="15" fill="#010101" fill-opacity=".3">${l}</text>
    <text x="${lx}" y="14">${l}</text>
    <text x="${mx}" y="15" fill="#010101" fill-opacity=".3">${m}</text>
    <text x="${mx}" y="14">${m}</text>
  </g>
</svg>
`;
}

export function badgeColor(score) {
  if (score >= 90) return "#4c1";
  if (score >= 80) return "#97ca00";
  if (score >= 70) return "#dfb317";
  if (score >= 60) return "#fe7d37";
  return "#e05d44";
}

export function badgeForScore(score, grade, opts = {}) {
  return badgeSvg({
    label: opts.label ?? "skill crucible",
    message: opts.message ?? `${score} · ${grade}`,
    color: badgeColor(score),
  });
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
