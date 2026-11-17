import { jsPDF } from 'jspdf';
import {
  CumulativeStats,
  PlayerMatchState,
  TENSE_LABELS,
  TenseKey,
} from './types';

export interface TeacherReportData {
  razmik: PlayerMatchState;
  gayane: PlayerMatchState;
  cumulative: CumulativeStats;
  dateLabel: string;
  sessionTitle: string;
}

const TENSES: TenseKey[] = [
  'perfecto',
  'indefinido',
  'imperfecto',
  'pluscuamperfecto',
];

function pct(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export function buildTeacherSummaryText(data: TeacherReportData): string {
  const rTotal = data.razmik.correct + data.razmik.wrong;
  const gTotal = data.gayane.correct + data.gayane.wrong;

  const lines: string[] = [
    'INFORME PARA LA PROFESORA — RAZMIK VS GAYANE (BATALLA DE ESPAÑOL)',
    `Fecha: ${data.dateLabel}`,
    `Sesión: ${data.sessionTitle}`,
    '',
    `RESULTADO FINAL: RAZMIK ${data.razmik.points} pts vs GAYANE ${data.gayane.points} pts`,
    '',
    `RAZMIK (${data.razmik.correct}/${rTotal} aciertos · ${pct(data.razmik.correct, rTotal)}%):`,
    ...TENSES.map((t) => {
      const s = data.razmik.tenseStats[t];
      return `- ${TENSE_LABELS[t]}: ${s.correct}/${s.total} (${pct(s.correct, s.total)}%)`;
    }),
    '',
    `GAYANE (${data.gayane.correct}/${gTotal} aciertos · ${pct(data.gayane.correct, gTotal)}%):`,
    ...TENSES.map((t) => {
      const s = data.gayane.tenseStats[t];
      return `- ${TENSE_LABELS[t]}: ${s.correct}/${s.total} (${pct(s.correct, s.total)}%)`;
    }),
    '',
    'HISTORIAL ACUMULADO EN ESTE DISPOSITIVO:',
    `- Victorias Razmik: ${data.cumulative.wins.razmik} | Victorias Gayane: ${data.cumulative.wins.gayane} | Empates: ${data.cumulative.ties}`,
    `- Rondas completadas: ${data.cumulative.completedRounds}`,
  ];

  return lines.join('\n');
}

export function downloadTeacherReportPdf(data: TeacherReportData): void {
  const canvas = document.createElement('canvas');
  const width = 1240;
  const height = 1754;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, 180);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Informe para la profesora', 72, 84);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `Razmik vs Gayane — ¡Batalla de Español! · ${data.dateLabel}`,
    72,
    132
  );

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(72, 220, width - 144, 130);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(72, 220, width - 144, 130);

  ctx.fillStyle = '#1e293b';
  ctx.font = '700 26px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(data.sessionTitle, 100, 268);

  const winnerText =
    data.razmik.points > data.gayane.points
      ? `Ganador de la partida: Razmik (${data.razmik.points} vs ${data.gayane.points} puntos)`
      : data.gayane.points > data.razmik.points
        ? `Ganadora de la partida: Gayane (${data.gayane.points} vs ${data.razmik.points} puntos)`
        : `Empate en la partida (${data.razmik.points} puntos cada uno)`;

  ctx.fillStyle = '#334155';
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(winnerText, 100, 314);

  const drawPlayerSection = (
    name: string,
    accentHex: string,
    bgHex: string,
    stats: PlayerMatchState,
    cumTense: Record<TenseKey, { correct: number; total: number }>,
    yStart: number
  ) => {
    ctx.fillStyle = bgHex;
    ctx.fillRect(72, yStart, width - 144, 470);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(72, yStart, width - 144, 470);

    ctx.fillStyle = accentHex;
    ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(name, 104, yStart + 58);

    const total = stats.correct + stats.wrong;
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(
      `Puntos: ${stats.points}   ·   Aciertos: ${stats.correct}/${total} (${pct(stats.correct, total)}%)   ·   Racha máx: ${stats.maxStreak}`,
      104,
      yStart + 102
    );

    TENSES.forEach((tense, idx) => {
      const yRow = yStart + 162 + idx * 72;
      const cur = stats.tenseStats[tense];
      const cum = cumTense[tense];
      const p = pct(cur.correct, cur.total);

      ctx.fillStyle = '#1e293b';
      ctx.font = '600 21px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(TENSE_LABELS[tense], 104, yRow);

      ctx.fillStyle = '#475569';
      ctx.font = '500 20px "JetBrains Mono", monospace';
      ctx.fillText(
        `Partida: ${cur.correct}/${cur.total} (${p}%)  ·  Acumulado: ${cum.correct}/${cum.total}`,
        520,
        yRow
      );

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(104, yRow + 16, width - 208, 14);
      ctx.fillStyle = accentHex;
      ctx.fillRect(104, yRow + 16, ((width - 208) * p) / 100, 14);
    });
  };

  drawPlayerSection(
    'RAZMIK',
    '#1d4ed8',
    '#eff6ff',
    data.razmik,
    data.cumulative.tenseStats.razmik,
    390
  );

  drawPlayerSection(
    'GAYANE',
    '#be185d',
    '#fdf2f8',
    data.gayane,
    data.cumulative.tenseStats.gayane,
    900
  );

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(72, 1410, width - 144, 210);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(72, 1410, width - 144, 210);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Historial acumulado en este dispositivo', 104, 1462);

  ctx.fillStyle = '#334155';
  ctx.font = '500 21px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `Victorias de Razmik: ${data.cumulative.wins.razmik}   ·   Victorias de Gayane: ${data.cumulative.wins.gayane}   ·   Empates: ${data.cumulative.ties}`,
    104,
    1512
  );
  ctx.fillText(
    `Rondas completadas: ${data.cumulative.completedRounds}   ·   Puntos totales: Razmik ${data.cumulative.totalPoints.razmik} vs Gayane ${data.cumulative.totalPoints.gayane}`,
    104,
    1554
  );

  ctx.fillStyle = '#64748b';
  ctx.font = '500 18px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    'Generado automáticamente por Razmik vs Gayane — ¡Batalla de Español!',
    72,
    1690
  );

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [width, height] });
  pdf.addImage(imgData, 'PNG', 0, 0, width, height);
  pdf.save(`informe-razmik-gayane-${new Date().toISOString().slice(0, 10)}.pdf`);
}
