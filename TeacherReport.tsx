import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Mail,
  Printer,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { ClickableSpanish } from './ClickableSpanish';
import { QUESTION_BANK } from './questions';
import {
  buildTeacherSummaryText,
  downloadTeacherReportPdf,
  TeacherReportData,
} from './report';
import {
  CumulativeStats,
  PlayerId,
  PlayerMatchState,
  TENSE_LABELS,
  TenseKey,
} from './types';

interface TeacherReportProps {
  razmikMatch: PlayerMatchState;
  gayaneMatch: PlayerMatchState;
  cumulative: CumulativeStats;
  sessionTitle: string;
  speechEnabled: boolean;
  forceShowTranslation: boolean;
  onBack: () => void;
  onPracticeMistakes: (player?: PlayerId) => void;
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

export const TeacherReport: React.FC<TeacherReportProps> = ({
  razmikMatch,
  gayaneMatch,
  cumulative,
  sessionTitle,
  speechEnabled,
  forceShowTranslation,
  onBack,
  onPracticeMistakes,
}) => {
  const [teacherEmail, setTeacherEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);

  const dateLabel = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const reportData: TeacherReportData = {
    razmik: razmikMatch,
    gayane: gayaneMatch,
    cumulative,
    dateLabel,
    sessionTitle,
  };

  const summaryText = buildTeacherSummaryText(reportData);

  const handleDownloadPdf = () => {
    downloadTeacherReportPdf(reportData);
    setSendFeedback('Informe PDF descargado correctamente.');
    window.setTimeout(() => setSendFeedback(null), 3500);
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setSendFeedback('Resumen copiado al portapapeles.');
      window.setTimeout(() => {
        setCopied(false);
        setSendFeedback(null);
      }, 3000);
    } catch {
      setSendFeedback('No se pudo copiar automáticamente.');
    }
  };

  const handleSendToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(
      `Informe de español: Razmik vs Gayane (${dateLabel})`
    );
    const body = encodeURIComponent(summaryText);

    if (teacherEmail.trim()) {
      window.location.href = `mailto:${encodeURIComponent(
        teacherEmail.trim()
      )}?subject=${subject}&body=${body}`;
      setSendFeedback(
        `Abriendo el cliente de correo para enviar el informe a ${teacherEmail.trim()}.`
      );
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Informe para la profesora — Razmik vs Gayane',
          text: summaryText,
        });
        setSendFeedback('Informe compartido correctamente.');
        return;
      } catch {
        // Fallback to mailto below
      }
    }

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setSendFeedback('Abriendo el correo con el informe listo para enviar.');
  };

  const combinedMistakeIds = Array.from(
    new Set([
      ...razmikMatch.mistakeIds,
      ...gayaneMatch.mistakeIds,
      ...cumulative.mistakeHistoryIds.razmik,
      ...cumulative.mistakeHistoryIds.gayane,
    ])
  );
  const mistakeQuestions = QUESTION_BANK.filter((q) =>
    combinedMistakeIds.includes(q.id)
  );

  const renderPlayerCard = (
    name: string,
    playerId: PlayerId,
    matchStats: PlayerMatchState,
    accentBar: string,
    headerColor: string,
    borderColor: string,
    bgTint: string
  ) => {
    const matchTotal = matchStats.correct + matchStats.wrong;
    const cumCorrect = cumulative.correctCount[playerId];
    const cumTotal = cumCorrect + cumulative.wrongCount[playerId];

    return (
      <section className={`rounded-2xl border ${borderColor} bg-white p-6 shadow-sm`}>
        <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl ${bgTint} p-4`}>
          <div>
            <h3 className={`text-2xl font-bold ${headerColor}`}>{name}</h3>
            <p className="text-sm text-slate-600">
              Partida actual: <span className="font-mono-tabular font-semibold">{matchStats.points}</span> puntos
              {' · '}
              {matchStats.correct}/{matchTotal} aciertos ({pct(matchStats.correct, matchTotal)}%)
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-slate-500">Acumulado local</div>
            <div className="font-mono-tabular text-lg font-bold text-slate-900">
              {cumCorrect}/{cumTotal} ({pct(cumCorrect, cumTotal)}%)
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {TENSES.map((tense) => {
            const cur = matchStats.tenseStats[tense];
            const cum = cumulative.tenseStats[playerId][tense];
            const displayCorrect = cur.total > 0 ? cur.correct : cum.correct;
            const displayTotal = cur.total > 0 ? cur.total : cum.total;
            const percent = pct(displayCorrect, displayTotal);

            return (
              <div key={tense}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-800">
                    {TENSE_LABELS[tense]}
                  </span>
                  <span className="font-mono-tabular text-slate-700">
                    {cur.total > 0 ? (
                      <>
                        <strong>{cur.correct}/{cur.total}</strong>
                        <span className="ml-2 text-xs text-slate-500">
                          (Total: {cum.correct}/{cum.total})
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>{cum.correct}/{cum.total}</strong>
                        <span className="ml-2 text-xs text-slate-500">
                          ({percent}%)
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${accentBar}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-200 pb-5">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-orange-700 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver al menú principal</span>
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
            Informe para la profesora
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {sessionTitle} · {dateLabel} · Guardado localmente en este dispositivo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:from-orange-600 hover:to-amber-600 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Descargar PDF</span>
          </button>
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-amber-50 cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{copied ? 'Copiado' : 'Copiar resumen'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-amber-50 cursor-pointer whitespace-nowrap"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {sendFeedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {sendFeedback}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {renderPlayerCard(
          'Razmik',
          'razmik',
          razmikMatch,
          'bg-gradient-to-r from-blue-600 to-orange-500',
          'text-blue-700',
          'border-blue-200',
          'bg-blue-50/70'
        )}
        {renderPlayerCard(
          'Gayane',
          'gayane',
          gayaneMatch,
          'bg-gradient-to-r from-pink-600 to-violet-600',
          'text-pink-700',
          'border-pink-200',
          'bg-pink-50/70'
        )}
      </div>

      <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-stone-900">
          Enviar informe a la profesora
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Escribe el correo electrónico de la profesora o déjalo vacío para elegir una aplicación de envío en tu dispositivo.
        </p>

        <form onSubmit={handleSendToTeacher} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
            placeholder="profesora@colegio.es (opcional)"
            className="flex-1 rounded-xl border border-amber-200 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 cursor-pointer whitespace-nowrap"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>Enviar informe a la profesora</span>
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Historial de victorias y rondas
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Razmik: {cumulative.wins.razmik} victorias · Gayane: {cumulative.wins.gayane} victorias · Empates: {cumulative.ties} · Rondas completadas: {cumulative.completedRounds}
            </p>
          </div>
          <Trophy className="h-7 w-7 text-amber-500" aria-hidden="true" />
        </div>

        {cumulative.matchHistory.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Modalidad</th>
                  <th className="py-2 pr-4">Razmik</th>
                  <th className="py-2 pr-4">Gayane</th>
                  <th className="py-2">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cumulative.matchHistory.slice(0, 8).map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {new Date(item.dateIso).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-800">
                      {item.modeLabel}
                    </td>
                    <td className="py-2.5 pr-4 font-mono-tabular text-blue-700">
                      {item.razmikPoints} pts ({item.razmikCorrect}/{item.razmikTotal})
                    </td>
                    <td className="py-2.5 pr-4 font-mono-tabular text-pink-700">
                      {item.gayanePoints} pts ({item.gayaneCorrect}/{item.gayaneTotal})
                    </td>
                    <td className="py-2.5 font-semibold text-slate-900">
                      {item.winner === 'razmik'
                        ? 'Ganó Razmik'
                        : item.winner === 'gayane'
                          ? 'Ganó Gayane'
                          : 'Empate'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Todavía no hay partidas terminadas guardadas en este dispositivo.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Preguntas para repasar ({mistakeQuestions.length})
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Haz clic en cualquier frase o explicación en español para revelar su traducción al armenio.
            </p>
          </div>
          {mistakeQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => onPracticeMistakes()}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Repasar errores ahora</span>
            </button>
          )}
        </div>

        {mistakeQuestions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            ¡Excelente trabajo! No hay errores pendientes por repasar.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {mistakeQuestions.slice(0, 12).map((q) => {
              const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="mb-2 text-xs font-semibold text-slate-500">
                    {TENSE_LABELS[q.tense]} · {q.topic}
                  </div>
                  {q.promptEs ? (
                    <ClickableSpanish
                      textEs={q.promptEs}
                      translationHy={q.promptHy}
                      forceShowTranslation={forceShowTranslation}
                      speechEnabled={speechEnabled}
                      textClassName="font-semibold text-slate-900"
                    />
                  ) : (
                    <p className="font-semibold text-slate-900">
                      {q.promptHy ||
                        `${q.verbMeta?.infinitiveHy} (${q.verbMeta?.infinitiveEs}) — ${q.verbMeta?.person}`}
                    </p>
                  )}
                  <div className="mt-2 text-sm font-bold text-emerald-700">
                    Respuesta correcta: {correctOpt?.text}
                  </div>
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <ClickableSpanish
                      textEs={q.explanationEs}
                      translationHy={q.explanationHy}
                      forceShowTranslation={forceShowTranslation}
                      speechEnabled={speechEnabled}
                      compact
                      textClassName="text-xs text-slate-700"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
