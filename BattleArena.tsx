import React, { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Flame,
  Home,
  Languages,
  RotateCcw,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  XCircle,
} from 'lucide-react';
import {
  playCorrectSound,
  playStreakSound,
  playTickSound,
  playVictorySound,
  playWrongSound,
  speakSpanish,
} from './audio';
import { ClickableSpanish } from './ClickableSpanish';
import {
  ActiveGameState,
  GAME_MODE_INFO,
  PlayerId,
  Question,
  SoundSettings,
  TENSE_DESCRIPTIONS,
  TENSE_LABELS,
  TenseKey,
} from './types';

interface BattleArenaProps {
  game: ActiveGameState;
  soundSettings: SoundSettings;
  forceShowTranslation: boolean;
  onToggleForceTranslation: () => void;
  onAnswerSubmitted: (params: {
    player: PlayerId;
    question: Question;
    isCorrect: boolean;
    pointsEarned: number;
    streakBonus: boolean;
  }) => void;
  onAdvanceTurn: () => void;
  onStartGayaneFinal: () => void;
  onFinalTimeTick: (player: PlayerId, remaining: number) => void;
  onNextRound: () => void;
  onStartTieBreaker: () => void;
  onOpenReport: () => void;
  onPracticeMistakes: () => void;
  onPlayAgain: () => void;
  onExitToMenu: () => void;
}

function PlayerEmblem({
  player,
  size = 'md',
}: {
  player: PlayerId;
  size?: 'md' | 'lg';
}) {
  const isRazmik = player === 'razmik';
  const dim = size === 'lg' ? 'h-24 w-24 rounded-2xl' : 'h-14 w-14 rounded-xl';
  return (
    <div
      className={`mx-auto flex shrink-0 items-center justify-center border-2 shadow-sm ${dim} ${
        isRazmik
          ? 'border-orange-400 bg-gradient-to-br from-blue-600 via-blue-700 to-orange-500 text-white'
          : 'border-violet-400 bg-gradient-to-br from-pink-500 via-pink-600 to-violet-600 text-white'
      }`}
      aria-label={isRazmik ? 'Emblema de Razmik' : 'Emblema de Gayane'}
    >
      {isRazmik ? (
        <svg viewBox="0 0 64 64" className="h-3/4 w-3/4" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="rgba(255,255,255,0.14)"
            stroke="white"
            strokeWidth="2.5"
          />
          <polygon
            points="32,14 43,22 39,35 25,35 21,22"
            fill="white"
          />
          <path
            d="M32 6 L32 14 M55 24 L43 22 M48 52 L39 35 M16 52 L25 35 M9 24 L21 22"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 64 64" className="h-3/4 w-3/4" aria-hidden="true">
          <polygon
            points="32,8 39,23 55,25 43,36 46,53 32,45 18,53 21,36 9,25 25,23"
            fill="#fde047"
            stroke="white"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <text
            x="32"
            y="38"
            textAnchor="middle"
            fill="#831843"
            fontSize="17"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            G
          </text>
        </svg>
      )}
    </div>
  );
}

const TIMELINE_META: Record<
  TenseKey,
  { order: string; hint: string; example: string }
> = {
  pluscuamperfecto: {
    order: '01 · Pasado anterior',
    hint: 'Ocurrió antes que otro hecho pasado',
    example: 'había jugado',
  },
  imperfecto: {
    order: '02 · Pasado continuo',
    hint: 'Hábito, rutina o descripción',
    example: 'jugaba',
  },
  indefinido: {
    order: '03 · Pasado cerrado',
    hint: 'Acción puntual terminada',
    example: 'jugué',
  },
  perfecto: {
    order: '04 · Pasado reciente',
    hint: 'Conectado con el presente (hoy)',
    example: 'he jugado',
  },
};

export const BattleArena: React.FC<BattleArenaProps> = ({
  game,
  soundSettings,
  forceShowTranslation,
  onToggleForceTranslation,
  onAnswerSubmitted,
  onAdvanceTurn,
  onStartGayaneFinal,
  onFinalTimeTick,
  onNextRound,
  onStartTieBreaker,
  onOpenReport,
  onPracticeMistakes,
  onPlayAgain,
  onExitToMenu,
}) => {
  const currentRound = game.rounds[game.currentRoundIndex];
  const isFinalChallenge = currentRound?.isFinalChallenge ?? false;
  const activePlayer = game.activePlayer;
  const activeQIndex =
    activePlayer === 'razmik'
      ? game.razmikQuestionIdx
      : game.gayaneQuestionIdx;
  const activeList =
    activePlayer === 'razmik'
      ? currentRound?.razmikQuestions ?? []
      : currentRound?.gayaneQuestions ?? [];
  const currentQuestion: Question | undefined = activeList[activeQIndex];

  const modeInfo = currentRound ? GAME_MODE_INFO[currentRound.mode] : null;
  const perQuestionLimit = 30;

  const [questionTimer, setQuestionTimer] = useState<number>(perQuestionLimit);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerOutcome, setAnswerOutcome] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    streakBonus: boolean;
    timedOut: boolean;
  } | null>(null);
  const [revealedOptionHy, setRevealedOptionHy] = useState<
    Record<string, boolean>
  >({});

  const victoryPlayedRef = useRef(false);

  // Reset per-question UI state when active question changes
  useEffect(() => {
    setSelectedOptionId(null);
    setAnswerOutcome(null);
    setRevealedOptionHy({});
    setQuestionTimer(perQuestionLimit);
  }, [
    game.currentRoundIndex,
    game.activePlayer,
    game.razmikQuestionIdx,
    game.gayaneQuestionIdx,
    perQuestionLimit,
  ]);

  // Victory sound + confetti when reaching GAME_OVER
  useEffect(() => {
    if (game.phase === 'GAME_OVER' && !victoryPlayedRef.current) {
      victoryPlayedRef.current = true;
      playVictorySound(soundSettings.sfxEnabled);
      confetti({
        particleCount: 95,
        spread: 80,
        origin: { y: 0.6 },
      });
    } else if (game.phase !== 'GAME_OVER') {
      victoryPlayedRef.current = false;
    }
  }, [game.phase, soundSettings.sfxEnabled]);

  // Countdown timer for regular questions (Modes 1–5 & tie-breaker)
  useEffect(() => {
    if (
      game.phase !== 'PLAYING' ||
      isFinalChallenge ||
      answerOutcome !== null ||
      !currentQuestion
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setQuestionTimer((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        if (prev <= 5) {
          playTickSound(soundSettings.sfxEnabled);
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    game.phase,
    isFinalChallenge,
    answerOutcome,
    currentQuestion,
    soundSettings.sfxEnabled,
  ]);

  // Handle regular timer hitting 0
  useEffect(() => {
    if (
      game.phase === 'PLAYING' &&
      !isFinalChallenge &&
      questionTimer === 0 &&
      answerOutcome === null &&
      currentQuestion
    ) {
      playWrongSound(soundSettings.sfxEnabled);
      setAnswerOutcome({
        isCorrect: false,
        pointsEarned: 0,
        streakBonus: false,
        timedOut: true,
      });
      onAnswerSubmitted({
        player: activePlayer,
        question: currentQuestion,
        isCorrect: false,
        pointsEarned: 0,
        streakBonus: false,
      });
    }
  }, [
    questionTimer,
    game.phase,
    isFinalChallenge,
    answerOutcome,
    currentQuestion,
    activePlayer,
    soundSettings.sfxEnabled,
    onAnswerSubmitted,
  ]);

  // Countdown timer for Game 6 (90 seconds continuous per player)
  const finalRemaining = game.finalTimerRemaining[activePlayer];
  useEffect(() => {
    if (game.phase !== 'PLAYING' || !isFinalChallenge || !currentQuestion) {
      return;
    }
    if (finalRemaining <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      const next = Math.max(0, finalRemaining - 1);
      if (next > 0 && next <= 5) {
        playTickSound(soundSettings.sfxEnabled);
      }
      onFinalTimeTick(activePlayer, next);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    game.phase,
    isFinalChallenge,
    currentQuestion,
    activePlayer,
    finalRemaining,
    soundSettings.sfxEnabled,
    onFinalTimeTick,
  ]);

  const totalRemainingQuestions = useMemo(() => {
    let remaining = 0;
    for (let i = game.currentRoundIndex; i < game.rounds.length; i++) {
      const r = game.rounds[i];
      if (i === game.currentRoundIndex) {
        remaining += Math.max(0, r.razmikQuestions.length - game.razmikQuestionIdx);
        remaining += Math.max(0, r.gayaneQuestions.length - game.gayaneQuestionIdx);
      } else {
        remaining += r.razmikQuestions.length + r.gayaneQuestions.length;
      }
    }
    return remaining;
  }, [game]);

  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion || answerOutcome !== null || game.phase !== 'PLAYING') {
      return;
    }

    const isCorrect = optionId === currentQuestion.correctOptionId;
    const basePoints = isFinalChallenge ? 20 : 10;
    const nextStreak = isCorrect ? game.players[activePlayer].streak + 1 : 0;
    const streakBonus = isCorrect && nextStreak > 0 && nextStreak % 3 === 0;
    const pointsEarned = isCorrect ? basePoints + (streakBonus ? 5 : 0) : 0;

    setSelectedOptionId(optionId);
    setAnswerOutcome({
      isCorrect,
      pointsEarned,
      streakBonus,
      timedOut: false,
    });

    if (isCorrect) {
      if (streakBonus) {
        playStreakSound(soundSettings.sfxEnabled);
        confetti({
          particleCount: 40,
          spread: 55,
          origin: { y: 0.7 },
        });
      } else {
        playCorrectSound(soundSettings.sfxEnabled);
      }
    } else {
      playWrongSound(soundSettings.sfxEnabled);
    }

    onAnswerSubmitted({
      player: activePlayer,
      question: currentQuestion,
      isCorrect,
      pointsEarned,
      streakBonus,
    });
  };

  const accuracyPct = (pid: PlayerId) => {
    const p = game.players[pid];
    const total = p.correct + p.wrong;
    if (total === 0) return 0;
    return Math.round((p.correct / total) * 100);
  };

  const renderPlayerCard = (pid: PlayerId) => {
    const isRazmik = pid === 'razmik';
    const isActive = game.phase === 'PLAYING' && activePlayer === pid;
    const stats = game.players[pid];
    const roundTotal = isRazmik
      ? currentRound?.razmikQuestions.length ?? 0
      : currentRound?.gayaneQuestions.length ?? 0;
    const roundDone = isRazmik
      ? game.razmikQuestionIdx
      : game.gayaneQuestionIdx;

    return (
      <aside
        className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
          isRazmik
            ? isActive
              ? 'border-blue-600 bg-gradient-to-br from-blue-50 via-white to-orange-50 shadow-md ring-2 ring-blue-500/30'
              : 'border-blue-200 bg-white/90'
            : isActive
              ? 'border-pink-600 bg-gradient-to-br from-pink-50 via-white to-violet-50 shadow-md ring-2 ring-pink-500/30'
              : 'border-pink-200 bg-white/90'
        }`}
      >
        {/* Subtle decorative corner geometry matching player theme */}
        {isRazmik ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            className="pointer-events-none absolute -right-4 -bottom-4 h-24 w-24 text-blue-500/10"
          >
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="60,28 82,44 74,70 46,70 38,44" fill="currentColor" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            className="pointer-events-none absolute -right-4 -bottom-4 h-24 w-24 text-pink-500/10"
          >
            <polygon
              points="60,12 73,42 106,45 80,67 88,100 60,82 32,100 40,67 14,45 47,42"
              fill="currentColor"
            />
          </svg>
        )}

        <div className="flex items-center gap-3">
          <PlayerEmblem player={pid} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2
                className={`truncate text-lg font-extrabold ${
                  isRazmik ? 'text-blue-900' : 'text-pink-900'
                }`}
              >
                {isRazmik ? '🔵 Razmik' : '🩷 Gayane'}
              </h2>
              {isActive && (
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-white ${
                    isRazmik ? 'bg-orange-600' : 'bg-violet-600'
                  }`}
                >
                  ¡Tu turno!
                </span>
              )}
            </div>
            <div className="mt-0.5 font-mono-tabular text-2xl font-extrabold text-slate-900">
              {stats.points} <span className="text-sm font-semibold text-slate-500">pts</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200/80 pt-3 text-center">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Aciertos</div>
            <div className="font-mono-tabular text-sm font-bold text-emerald-700">
              {stats.correct}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Errores</div>
            <div className="font-mono-tabular text-sm font-bold text-rose-600">
              {stats.wrong}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Precisión</div>
            <div className="font-mono-tabular text-sm font-bold text-slate-800">
              {accuracyPct(pid)}%
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Flame
              className={`h-3.5 w-3.5 ${
                stats.streak >= 2 ? 'text-orange-500' : 'text-slate-400'
              }`}
              aria-hidden="true"
            />
            Racha: <span className="font-mono-tabular">{stats.streak}/3</span>
          </span>
          <span className="font-mono-tabular">
            Ronda: {Math.min(roundDone, roundTotal)}/{roundTotal}
          </span>
        </div>
      </aside>
    );
  };

  // =========================================================================
  // SUB-VIEWS: HANDOFF / ROUND SUMMARY / TIE-BREAKER / GAME OVER
  // =========================================================================
  if (game.phase === 'HANDOFF_GAYANE') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-pink-200 bg-white p-8 text-center shadow-sm"
        >
          <PlayerEmblem player="gayane" size="lg" />
          <h2 className="mt-4 text-3xl font-extrabold text-pink-900">
            ¡Turno de Gayane en El Desafío Final!
          </h2>
          <p className="mt-2 text-slate-600">
            Razmik ya terminó su turno con{' '}
            <span className="font-mono-tabular font-bold text-blue-700">
              {game.players.razmik.points} puntos
            </span>
            . Ahora Gayane tiene <strong className="text-slate-900">90 segundos</strong> para responder 10 preguntas (+20 puntos por acierto).
          </p>
          <button
            type="button"
            onClick={onStartGayaneFinal}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 px-6 py-3.5 text-base font-bold text-white shadow-sm hover:opacity-95 cursor-pointer"
          >
            <span>¡Empezar desafío de Gayane!</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </motion.div>
      </div>
    );
  }

  if (game.phase === 'ROUND_SUMMARY') {
    const rp = game.players.razmik.points;
    const gp = game.players.gayane.points;
    const leaderText =
      rp > gp
        ? 'Razmik va en cabeza'
        : gp > rp
          ? 'Gayane va en cabeza'
          : '¡Marcador empatado!';

    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
        >
          <Award className="mx-auto h-12 w-12 text-amber-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Ronda {game.currentRoundIndex + 1} de {game.rounds.length} completada
          </p>
          <h2 className="mt-1 text-3xl font-extrabold text-slate-900">
            {leaderText}
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
              <div className="text-lg font-bold text-blue-800">🔵 Razmik</div>
              <div className="mt-1 font-mono-tabular text-3xl font-extrabold text-slate-900">
                {rp} pts
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {game.players.razmik.correct} aciertos · {accuracyPct('razmik')}% precisión
              </div>
            </div>
            <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-5">
              <div className="text-lg font-bold text-pink-800">🩷 Gayane</div>
              <div className="mt-1 font-mono-tabular text-3xl font-extrabold text-slate-900">
                {gp} pts
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {game.players.gayane.correct} aciertos · {accuracyPct('gayane')}% precisión
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onNextRound}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-base font-bold text-white shadow-sm hover:from-orange-600 hover:to-amber-600 cursor-pointer"
          >
            <span>Siguiente ronda</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </motion.div>
      </div>
    );
  }

  if (game.phase === 'TIE_BREAKER_INTRO') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-amber-300 bg-amber-50/70 p-8 text-center shadow-sm"
        >
          <Sparkles className="mx-auto h-12 w-12 text-amber-600" aria-hidden="true" />
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900">
            ¡Empate perfecto a {game.players.razmik.points} puntos!
          </h2>
          <p className="mt-2 text-slate-700">
            Las reglas de la batalla son claras: ¡cuando hay empate, se juega una ronda extra de desempate de 3 preguntas cada uno!
          </p>
          <button
            type="button"
            onClick={onStartTieBreaker}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3.5 text-base font-bold text-white hover:bg-amber-700 cursor-pointer"
          >
            <span>¡Iniciar ronda de desempate!</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </motion.div>
      </div>
    );
  }

  if (game.phase === 'GAME_OVER') {
    const rp = game.players.razmik.points;
    const gp = game.players.gayane.points;
    const winner: PlayerId | 'tie' =
      rp > gp ? 'razmik' : gp > rp ? 'gayane' : 'tie';
    const totalMistakes =
      game.players.razmik.mistakeIds.length +
      game.players.gayane.mistakeIds.length;

    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Trophy className="h-9 w-9" aria-hidden="true" />
          </div>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">
            {winner === 'razmik'
              ? '¡Razmik gana la batalla!'
              : winner === 'gayane'
                ? '¡Gayane gana la batalla!'
                : '¡Empate épico de campeones!'}
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Marcador final: <strong className="text-blue-700">Razmik {rp} puntos</strong> —{' '}
            <strong className="text-pink-700">Gayane {gp} puntos</strong>
          </p>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {(['razmik', 'gayane'] as PlayerId[]).map((pid) => {
              const p = game.players[pid];
              const isWinner = winner === pid;
              const isRazmik = pid === 'razmik';
              return (
                <div
                  key={pid}
                  className={`rounded-2xl border p-5 text-left ${
                    isRazmik
                      ? 'border-blue-200 bg-blue-50/60'
                      : 'border-pink-200 bg-pink-50/60'
                  } ${isWinner ? 'ring-2 ring-amber-400' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <PlayerEmblem player={pid} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-extrabold text-slate-900">
                          {isRazmik ? 'Razmik' : 'Gayane'}
                        </span>
                        {isWinner && (
                          <span className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                            Campeón
                          </span>
                        )}
                      </div>
                      <div className="font-mono-tabular text-2xl font-extrabold text-slate-900">
                        {p.points} puntos
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/80 pt-3 text-center text-xs">
                    <div>
                      <div className="text-slate-500">Aciertos</div>
                      <div className="font-mono-tabular text-sm font-bold text-emerald-700">
                        {p.correct}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Errores</div>
                      <div className="font-mono-tabular text-sm font-bold text-rose-600">
                        {p.wrong}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Precisión</div>
                      <div className="font-mono-tabular text-sm font-bold text-slate-900">
                        {accuracyPct(pid)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenReport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-bold text-white hover:from-orange-600 hover:to-amber-600 cursor-pointer"
            >
              <Award className="h-4 w-4" aria-hidden="true" />
              <span>Informe para la profesora</span>
            </button>

            {totalMistakes > 0 && (
              <button
                type="button"
                onClick={onPracticeMistakes}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Repasar errores ({totalMistakes})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onPlayAgain}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Jugar otra partida</span>
            </button>

            <button
              type="button"
              onClick={onExitToMenu}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              <span>Menú principal</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // =========================================================================
  // ACTIVE GAMEPLAY ARENA
  // =========================================================================
  const displayTimer = isFinalChallenge ? finalRemaining : questionTimer;
  const maxTimer = isFinalChallenge ? 90 : perQuestionLimit;
  const timerPct = Math.max(0, Math.min(100, (displayTimer / maxTimer) * 100));

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-4 sm:px-6">
      {/* Persistent Electronic Scoreboard */}
      <div className="rounded-2xl border border-amber-400/50 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 px-4 py-3.5 text-white shadow-sm">
        <div className="flex flex-col items-center justify-between gap-3 lg:flex-row">
          <div className="flex flex-wrap items-center justify-center gap-3 text-center text-base font-extrabold tracking-tight sm:text-xl">
            <span className="text-sky-300">
              RAZMIK 🔵{' '}
              <span className="font-mono-tabular text-white">
                {game.players.razmik.points}
              </span>{' '}
              puntos
            </span>
            <span className="text-amber-400">—</span>
            <span className="text-pink-300">
              GAYANE 🩷{' '}
              <span className="font-mono-tabular text-white">
                {game.players.gayane.points}
              </span>{' '}
              puntos
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-amber-100/80">
            <span>
              Ronda{' '}
              <strong className="font-mono-tabular text-white">
                {currentRound?.isTieBreaker
                  ? 'Desempate'
                  : `${game.currentRoundIndex + 1}/${game.rounds.length}`}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Restantes:{' '}
              <strong className="font-mono-tabular text-white">
                {totalRemainingQuestions}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={`inline-flex items-center gap-1 font-mono-tabular text-sm font-bold ${
                displayTimer <= 5 ? 'text-rose-400' : 'text-yellow-300'
              }`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {displayTimer}s
            </span>
          </div>
        </div>

        {/* Smooth Timer Bar */}
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-800">
          <div
            className={`h-full transition-all duration-300 ${
              displayTimer <= 5
                ? 'bg-rose-500'
                : activePlayer === 'razmik'
                  ? 'bg-gradient-to-r from-blue-500 via-amber-400 to-orange-500'
                  : 'bg-gradient-to-r from-pink-500 via-amber-400 to-orange-500'
            }`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      {/* Main Split Arena: Razmik Left · Active Question Center · Gayane Right */}
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-3">{renderPlayerCard('razmik')}</div>

        <main className="lg:col-span-6">
          {currentQuestion && modeInfo ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentQuestion.id}-${activePlayer}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className={`rounded-3xl border bg-white p-5 shadow-sm sm:p-7 ${
                  activePlayer === 'razmik'
                    ? 'border-blue-200'
                    : 'border-pink-200'
                }`}
              >
                {/* Mode Header & Global Translation Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">
                      Juego {modeInfo.number} · {modeInfo.title} ·{' '}
                      {currentQuestion.topic}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {modeInfo.subtitle}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleForceTranslation}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      forceShowTranslation
                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {forceShowTranslation ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>
                      {forceShowTranslation
                        ? 'Ocultar traducción'
                        : 'Mostrar traducción'}
                    </span>
                  </button>
                </div>

                {/* Question Prompt Area */}
                <div className="mt-5">
                  {currentQuestion.mode === 'traduce' && (
                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-yellow-50/90 to-orange-50/70 p-5">
                      <div className="mb-1.5 text-xs font-semibold text-orange-800">
                        Traduce del armenio al español:
                      </div>
                      <p className="text-xl font-bold leading-relaxed text-stone-900 sm:text-2xl">
                        {currentQuestion.promptHy}
                      </p>
                    </div>
                  )}

                  {currentQuestion.mode === 'batalla' &&
                    currentQuestion.verbMeta && (
                      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-yellow-50/90 to-orange-50/70 p-5 text-center">
                        <div className="text-xs font-semibold text-orange-800">
                          Conjuga el verbo en 30 segundos
                        </div>
                        <div className="mt-2 text-2xl font-extrabold text-stone-900 sm:text-3xl">
                          {currentQuestion.verbMeta.infinitiveHy}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm font-bold">
                          <span className="text-blue-700">
                            {currentQuestion.verbMeta.person}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-violet-700">
                            {currentQuestion.verbMeta.tenseLabel}
                          </span>
                        </div>
                        {answerOutcome && (
                          <div className="mt-2 text-xs font-medium text-stone-600">
                            Infinitivo en español:{' '}
                            <strong>{currentQuestion.verbMeta.infinitiveEs}</strong>
                          </div>
                        )}
                      </div>
                    )}

                  {currentQuestion.mode !== 'traduce' &&
                    currentQuestion.mode !== 'batalla' &&
                    currentQuestion.promptEs && (
                      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-yellow-50/90 to-orange-50/70 p-5">
                        <div className="mb-2 text-xs font-semibold text-orange-800">
                          {currentQuestion.mode === 'corrige'
                            ? 'Encuentra la forma correcta del verbo subrayado (haz clic para ver armenio):'
                            : currentQuestion.mode === 'viaje'
                              ? '¿A qué tiempo del pasado pertenece? (haz clic para ver armenio):'
                              : 'Completa la oración (haz clic en el texto para ver armenio):'}
                        </div>
                        <ClickableSpanish
                          textEs={currentQuestion.promptEs}
                          translationHy={currentQuestion.promptHy}
                          highlightWord={currentQuestion.errorHighlight}
                          forceShowTranslation={forceShowTranslation}
                          speechEnabled={soundSettings.speechEnabled}
                          textClassName="text-lg font-bold leading-relaxed text-stone-900 sm:text-xl"
                        />
                      </div>
                    )}
                </div>

                {/* Answer Options — Timeline for Mode 4, 4 Cards for Modes 1,2,3,5,6 */}
                {currentQuestion.mode === 'viaje' ? (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>← Pasado más lejano</span>
                      <span>Más cercano al presente →</span>
                    </div>
                    <div className="relative grid gap-3 sm:grid-cols-2">
                      {currentQuestion.options.map((opt) => {
                        const tenseKey = opt.id as TenseKey;
                        const meta = TIMELINE_META[tenseKey];
                        const isSelected = selectedOptionId === opt.id;
                        const isCorrectOpt =
                          opt.id === currentQuestion.correctOptionId;

                        let cardStyle =
                          'border-amber-200 bg-white hover:border-orange-400 hover:bg-amber-50/60';
                        if (answerOutcome) {
                          if (isCorrectOpt) {
                            cardStyle =
                              'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30';
                          } else if (isSelected && !isCorrectOpt) {
                            cardStyle =
                              'border-rose-500 bg-rose-50 ring-2 ring-rose-500/30';
                          } else {
                            cardStyle = 'border-amber-100 bg-amber-50/40 opacity-65';
                          }
                        }

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={answerOutcome !== null}
                            onClick={() => handleSelectOption(opt.id)}
                            className={`rounded-2xl border p-4 text-left transition-all cursor-pointer disabled:cursor-default ${cardStyle}`}
                          >
                            <div className="text-xs font-bold text-orange-700">
                              {meta.order}
                            </div>
                            <div className="mt-1 text-base font-extrabold text-stone-900">
                              {opt.text}
                            </div>
                            <div className="mt-1 text-xs text-stone-600">
                              {meta.hint}
                            </div>
                            <div className="mt-2 font-mono-tabular text-xs font-semibold text-amber-800">
                              Ej.: {meta.example}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-3">
                    {currentQuestion.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = selectedOptionId === opt.id;
                      const isCorrectOpt =
                        opt.id === currentQuestion.correctOptionId;
                      const showHy =
                        forceShowTranslation || Boolean(revealedOptionHy[opt.id]);

                      let btnStyle =
                        'border-amber-200 bg-white hover:border-orange-400 hover:bg-amber-50/60';
                      if (answerOutcome) {
                        if (isCorrectOpt) {
                          btnStyle =
                            'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30';
                        } else if (isSelected && !isCorrectOpt) {
                          btnStyle =
                            'border-rose-500 bg-rose-50 ring-2 ring-rose-500/30';
                        } else {
                          btnStyle = 'border-amber-100 bg-amber-50/40 opacity-70';
                        }
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`rounded-2xl border p-3.5 transition-all ${btnStyle}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              disabled={answerOutcome !== null}
                              onClick={() => handleSelectOption(opt.id)}
                              className="flex flex-1 items-center gap-3 text-left cursor-pointer disabled:cursor-default min-h-[40px]"
                            >
                              <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold ${
                                  answerOutcome && isCorrectOpt
                                    ? 'bg-emerald-600 text-white'
                                    : answerOutcome && isSelected && !isCorrectOpt
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {letter}
                              </span>
                              <span className="text-base font-semibold text-slate-900">
                                {opt.text}
                              </span>
                            </button>

                            <div className="flex shrink-0 items-center gap-1.5">
                              {opt.hy && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRevealedOptionHy((prev) => ({
                                      ...prev,
                                      [opt.id]: !prev[opt.id],
                                    }));
                                  }}
                                  title="Ver traducción al armenio"
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900 cursor-pointer"
                                >
                                  <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>HY</span>
                                </button>
                              )}

                              {soundSettings.speechEnabled && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakSpanish(opt.text, soundSettings.speechEnabled);
                                  }}
                                  aria-label="Escuchar opción"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                                >
                                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>

                          {opt.hy && showHy && (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-950">
                              {opt.hy}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Immediate Feedback + Clickable Explanation + Next Turn */}
                {answerOutcome && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-6 rounded-2xl border p-4 ${
                      answerOutcome.isCorrect
                        ? 'border-emerald-200 bg-emerald-50/80'
                        : 'border-rose-200 bg-rose-50/80'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {answerOutcome.isCorrect ? (
                          <CheckCircle2
                            className="h-5 w-5 text-emerald-600"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle
                            className="h-5 w-5 text-rose-600"
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={`text-base font-extrabold ${
                            answerOutcome.isCorrect
                              ? 'text-emerald-900'
                              : 'text-rose-900'
                          }`}
                        >
                          {answerOutcome.isCorrect
                            ? `¡Excelente! +${answerOutcome.pointsEarned} puntos`
                            : answerOutcome.timedOut
                              ? '¡Se acabó el tiempo! 0 puntos'
                              : '¡Ups! Respuesta incorrecta · 0 puntos'}
                        </span>
                      </div>

                      {answerOutcome.streakBonus && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-extrabold text-white">
                          <Star className="h-3.5 w-3.5" aria-hidden="true" />
                          ¡Racha de 3! +5 extra
                        </span>
                      )}
                    </div>

                    <div className="mt-3 rounded-xl bg-white/90 p-3">
                      <div className="mb-1 text-xs font-semibold text-slate-500">
                        Explicación ({TENSE_LABELS[currentQuestion.tense]} — haz clic para ver armenio):
                      </div>
                      <ClickableSpanish
                        textEs={currentQuestion.explanationEs}
                        translationHy={currentQuestion.explanationHy}
                        forceShowTranslation={forceShowTranslation}
                        speechEnabled={soundSettings.speechEnabled}
                        textClassName="text-sm font-medium text-slate-800"
                      />
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={onAdvanceTurn}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:from-orange-600 hover:to-amber-600 cursor-pointer"
                      >
                        <span>
                          {isFinalChallenge
                            ? 'Siguiente pregunta'
                            : 'Continuar'}
                        </span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </main>

        <div className="lg:col-span-3">{renderPlayerCard('gayane')}</div>
      </div>

      {/* Bottom Mini Grammar Reference Bar */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-stone-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-orange-900">
            <Shield className="h-4 w-4 text-orange-600" aria-hidden="true" />
            <span>Guía rápida:</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(['perfecto', 'indefinido', 'imperfecto', 'pluscuamperfecto'] as TenseKey[]).map(
              (t) => (
                <span key={t}>
                  <strong className="text-stone-900">{TENSE_LABELS[t]}:</strong>{' '}
                  {TENSE_DESCRIPTIONS[t]}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
