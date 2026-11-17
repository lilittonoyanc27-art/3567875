import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  Music,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { stopBackgroundMusic, stopSpeech, syncBackgroundMusic } from './audio';
import { BattleArena } from './BattleArena';
import { ClickableSpanish } from './ClickableSpanish';
import {
  buildRoundPlans,
  buildTieBreakerRound,
  QUESTION_BANK,
} from './questions';
import {
  createEmptyPlayerMatchState,
  loadActiveGame,
  loadCumulativeStats,
  loadSoundSettings,
  mergeMatchIntoCumulativeStats,
  resetAllStoredProgress,
  saveActiveGame,
  saveCumulativeStats,
  saveSoundSettings,
} from './storage';
import { TeacherReport } from './TeacherReport';
import {
  ActiveGameState,
  CumulativeStats,
  DifficultyLevel,
  GAME_MODE_INFO,
  GameModeId,
  PlayerId,
  PlayScope,
  Question,
  SoundSettings,
  TENSE_DESCRIPTIONS,
  TENSE_LABELS,
  TenseFilter,
  TenseKey,
} from './types';

type ScreenView = 'MENU' | 'ARENA' | 'REPORT';

function PlayerBadge({ player }: { player: PlayerId }) {
  const isRazmik = player === 'razmik';
  return (
    <div
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 shadow-sm ${
        isRazmik
          ? 'border-orange-400 bg-gradient-to-br from-blue-600 via-blue-700 to-orange-500 text-white'
          : 'border-violet-400 bg-gradient-to-br from-pink-500 via-pink-600 to-violet-600 text-white'
      }`}
      aria-label={isRazmik ? 'Emblema de Razmik' : 'Emblema de Gayane'}
    >
      {isRazmik ? (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="rgba(255,255,255,0.14)"
            stroke="white"
            strokeWidth="2.5"
          />
          <polygon points="32,14 43,22 39,35 25,35 21,22" fill="white" />
          <path
            d="M32 6 L32 14 M55 24 L43 22 M48 52 L39 35 M16 52 L25 35 M9 24 L21 22"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 64 64" className="h-11 w-11" aria-hidden="true">
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

const ALL_MODES: GameModeId[] = [
  'elige',
  'traduce',
  'corrige',
  'viaje',
  'batalla',
  'desafio',
];

const SAMPLE_SENTENCES: Record<
  TenseKey,
  { es: string; hy: string }
> = {
  perfecto: {
    es: 'Hoy hemos jugado un partido inolvidable en el colegio.',
    hy: 'Այսօր մենք անմոռանալի խաղ ենք խաղացել դպրոցում։',
  },
  indefinido: {
    es: 'Ayer Razmik y Gayane fueron al museo y vieron cuadros famosos.',
    hy: 'Երեկ Ռազմիկն ու Գայանեն գնացին թանգարան և տեսան հայտնի նկարներ։',
  },
  imperfecto: {
    es: 'Cuando éramos pequeños, jugábamos siempre después de clase.',
    hy: 'Երբ փոքր էինք, դասերից հետո միշտ խաղում էինք։',
  },
  pluscuamperfecto: {
    es: 'Cuando llegué a casa, mi madre ya había preparado la cena.',
    hy: 'Երբ տուն հասա, մայրս արդեն պատրաստել էր ընթրիքը։',
  },
};

export default function App() {
  const [screen, setScreen] = useState<ScreenView>('MENU');
  const [cumulative, setCumulative] = useState<CumulativeStats>(() =>
    loadCumulativeStats()
  );
  const [activeGame, setActiveGame] = useState<ActiveGameState | null>(() =>
    loadActiveGame()
  );
  const [lastCompletedGame, setLastCompletedGame] =
    useState<ActiveGameState | null>(null);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() =>
    loadSoundSettings()
  );
  const [forceShowTranslation, setForceShowTranslation] = useState(false);

  // Lobby configuration
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medio');
  const [tenseFilter, setTenseFilter] = useState<TenseFilter>('todos');
  const [questionsPerRound, setQuestionsPerRound] = useState<number>(4);
  const [showResetModal, setShowResetModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    saveSoundSettings(soundSettings);
    syncBackgroundMusic(soundSettings.musicEnabled);
    return () => {
      stopBackgroundMusic();
    };
  }, [soundSettings]);

  useEffect(() => {
    saveActiveGame(activeGame);
  }, [activeGame]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3200);
  };

  const startNewGame = useCallback(
    (scope: PlayScope, customMistakeIds?: string[]) => {
      stopSpeech();
      const allMistakes =
        customMistakeIds ??
        Array.from(
          new Set([
            ...cumulative.mistakeHistoryIds.razmik,
            ...cumulative.mistakeHistoryIds.gayane,
          ])
        );

      const rounds = buildRoundPlans({
        scope,
        difficulty,
        tenseFilter,
        questionsPerPlayer: questionsPerRound,
        mistakeIds: allMistakes,
      });

      const newGame: ActiveGameState = {
        id: `game_${Date.now()}`,
        scope,
        difficulty,
        tenseFilter,
        rounds,
        currentRoundIndex: 0,
        activePlayer: 'razmik',
        razmikQuestionIdx: 0,
        gayaneQuestionIdx: 0,
        phase: 'PLAYING',
        players: {
          razmik: createEmptyPlayerMatchState(),
          gayane: createEmptyPlayerMatchState(),
        },
        finalTimerRemaining: { razmik: 90, gayane: 90 },
        startedAtIso: new Date().toISOString(),
      };

      setActiveGame(newGame);
      setScreen('ARENA');
    },
    [cumulative, difficulty, questionsPerRound, tenseFilter]
  );

  const finalizeCompletedMatch = useCallback(
    (finishedGame: ActiveGameState) => {
      const updatedStats = mergeMatchIntoCumulativeStats(
        cumulative,
        finishedGame,
        finishedGame.rounds.length
      );
      setCumulative(updatedStats);
      saveCumulativeStats(updatedStats);
      setLastCompletedGame(finishedGame);
      setActiveGame(null);
      saveActiveGame(null);
    },
    [cumulative]
  );

  const concludeCurrentRound = useCallback(
    (gameState: ActiveGameState): ActiveGameState => {
      const hasMoreRounds =
        gameState.currentRoundIndex + 1 < gameState.rounds.length;

      if (hasMoreRounds) {
        return {
          ...gameState,
          phase: 'ROUND_SUMMARY',
        };
      }

      const rp = gameState.players.razmik.points;
      const gp = gameState.players.gayane.points;
      const currentRound = gameState.rounds[gameState.currentRoundIndex];

      // Launch tie-breaker if tied and not already after a tie-breaker
      if (rp === gp && !currentRound?.isTieBreaker) {
        return {
          ...gameState,
          phase: 'TIE_BREAKER_INTRO',
        };
      }

      const overState: ActiveGameState = {
        ...gameState,
        phase: 'GAME_OVER',
      };
      return overState;
    },
    []
  );

  const handleAnswerSubmitted = useCallback(
    ({
      player,
      question,
      isCorrect,
      pointsEarned,
      streakBonus,
    }: {
      player: PlayerId;
      question: Question;
      isCorrect: boolean;
      pointsEarned: number;
      streakBonus: boolean;
    }) => {
      setActiveGame((prev) => {
        if (!prev) return prev;
        const p = prev.players[player];
        const nextStreak = isCorrect ? p.streak + 1 : 0;
        const prevTense = p.tenseStats[question.tense];

        return {
          ...prev,
          players: {
            ...prev.players,
            [player]: {
              ...p,
              points: p.points + pointsEarned,
              correct: p.correct + (isCorrect ? 1 : 0),
              wrong: p.wrong + (isCorrect ? 0 : 1),
              streak: nextStreak,
              maxStreak: Math.max(p.maxStreak, nextStreak),
              streakBonuses: p.streakBonuses + (streakBonus ? 1 : 0),
              tenseStats: {
                ...p.tenseStats,
                [question.tense]: {
                  correct: prevTense.correct + (isCorrect ? 1 : 0),
                  total: prevTense.total + 1,
                },
              },
              mistakeIds: isCorrect
                ? p.mistakeIds
                : Array.from(new Set([...p.mistakeIds, question.id])),
            },
          },
        };
      });
    },
    []
  );

  const handleAdvanceTurn = useCallback(() => {
    stopSpeech();
    setActiveGame((prev) => {
      if (!prev) return prev;
      const round = prev.rounds[prev.currentRoundIndex];
      if (!round) return prev;

      if (round.isFinalChallenge) {
        if (prev.activePlayer === 'razmik') {
          const nextIdx = prev.razmikQuestionIdx + 1;
          if (nextIdx >= round.razmikQuestions.length) {
            return {
              ...prev,
              razmikQuestionIdx: nextIdx,
              activePlayer: 'gayane',
              phase: 'HANDOFF_GAYANE',
            };
          }
          return {
            ...prev,
            razmikQuestionIdx: nextIdx,
          };
        } else {
          const nextIdx = prev.gayaneQuestionIdx + 1;
          if (nextIdx >= round.gayaneQuestions.length) {
            const concluded = concludeCurrentRound({
              ...prev,
              gayaneQuestionIdx: nextIdx,
            });
            if (concluded.phase === 'GAME_OVER') {
              finalizeCompletedMatch(concluded);
              setLastCompletedGame(concluded);
              return concluded;
            }
            return concluded;
          }
          return {
            ...prev,
            gayaneQuestionIdx: nextIdx,
          };
        }
      }

      // Alternating turn-based play (Modes 1–5 & tie-breaker): Razmik -> Gayane -> Razmik -> Gayane
      if (prev.activePlayer === 'razmik') {
        const nextRazmikIdx = prev.razmikQuestionIdx + 1;
        if (prev.gayaneQuestionIdx < round.gayaneQuestions.length) {
          return {
            ...prev,
            razmikQuestionIdx: nextRazmikIdx,
            activePlayer: 'gayane',
          };
        }
        const concluded = concludeCurrentRound({
          ...prev,
          razmikQuestionIdx: nextRazmikIdx,
        });
        if (concluded.phase === 'GAME_OVER') {
          finalizeCompletedMatch(concluded);
        }
        return concluded;
      } else {
        const nextGayaneIdx = prev.gayaneQuestionIdx + 1;
        if (prev.razmikQuestionIdx < round.razmikQuestions.length) {
          return {
            ...prev,
            gayaneQuestionIdx: nextGayaneIdx,
            activePlayer: 'razmik',
          };
        }
        const concluded = concludeCurrentRound({
          ...prev,
          gayaneQuestionIdx: nextGayaneIdx,
        });
        if (concluded.phase === 'GAME_OVER') {
          finalizeCompletedMatch(concluded);
        }
        return concluded;
      }
    });
  }, [concludeCurrentRound, finalizeCompletedMatch]);

  const handleFinalTimeTick = useCallback(
    (player: PlayerId, remaining: number) => {
      setActiveGame((prev) => {
        if (!prev || prev.phase !== 'PLAYING') return prev;
        if (remaining > 0) {
          return {
            ...prev,
            finalTimerRemaining: {
              ...prev.finalTimerRemaining,
              [player]: remaining,
            },
          };
        }

        // Time expired (0s) for player in Final Challenge
        if (player === 'razmik') {
          return {
            ...prev,
            finalTimerRemaining: { ...prev.finalTimerRemaining, razmik: 0 },
            activePlayer: 'gayane',
            phase: 'HANDOFF_GAYANE',
          };
        } else {
          const concluded = concludeCurrentRound({
            ...prev,
            finalTimerRemaining: { ...prev.finalTimerRemaining, gayane: 0 },
          });
          if (concluded.phase === 'GAME_OVER') {
            finalizeCompletedMatch(concluded);
          }
          return concluded;
        }
      });
    },
    [concludeCurrentRound, finalizeCompletedMatch]
  );

  const handleStartGayaneFinal = () => {
    setActiveGame((prev) =>
      prev ? { ...prev, activePlayer: 'gayane', phase: 'PLAYING' } : prev
    );
  };

  const handleNextRound = () => {
    setActiveGame((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        currentRoundIndex: prev.currentRoundIndex + 1,
        activePlayer: 'razmik',
        razmikQuestionIdx: 0,
        gayaneQuestionIdx: 0,
        phase: 'PLAYING',
      };
    });
  };

  const handleStartTieBreaker = () => {
    setActiveGame((prev) => {
      if (!prev) return prev;
      const usedIds = prev.rounds.flatMap((r) => [
        ...r.razmikQuestions.map((q) => q.id),
        ...r.gayaneQuestions.map((q) => q.id),
      ]);
      const tieRound = buildTieBreakerRound(
        prev.difficulty,
        prev.tenseFilter,
        usedIds
      );
      return {
        ...prev,
        rounds: [...prev.rounds, tieRound],
        currentRoundIndex: prev.rounds.length,
        activePlayer: 'razmik',
        razmikQuestionIdx: 0,
        gayaneQuestionIdx: 0,
        phase: 'PLAYING',
      };
    });
  };

  const handleConfirmReset = () => {
    const empty = resetAllStoredProgress();
    setCumulative(empty);
    setActiveGame(null);
    setLastCompletedGame(null);
    setShowResetModal(false);
    setScreen('MENU');
    showToast('Todos los resultados locales han sido reiniciados.');
  };

  const reportMatchSource = activeGame ?? lastCompletedGame;
  const totalStoredMistakes = Array.from(
    new Set([
      ...cumulative.mistakeHistoryIds.razmik,
      ...cumulative.mistakeHistoryIds.gayane,
    ])
  ).length;

  const hasUnfinishedGame =
    activeGame !== null && activeGame.phase !== 'GAME_OVER';

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-yellow-50/60 to-orange-50/50 text-stone-900">
      {/* Top Navigation Bar (Strict 3-zone contract) */}
      <header className="sticky top-0 z-30 border-b border-amber-200 bg-gradient-to-r from-amber-50/95 via-yellow-50/95 to-orange-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => {
              stopSpeech();
              setScreen('MENU');
            }}
            className="font-display text-lg font-extrabold tracking-tight text-stone-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Razmik vs Gayane
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-700">
            <button
              type="button"
              onClick={() => setScreen('MENU')}
              className={`hover:text-orange-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                screen === 'MENU' ? 'font-bold text-orange-800' : ''
              }`}
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={() => startNewGame('torneo')}
              className="hover:text-orange-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Torneo completo
            </button>
            <button
              type="button"
              onClick={() => setScreen('REPORT')}
              className={`hover:text-orange-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                screen === 'REPORT' ? 'font-bold text-orange-800' : ''
              }`}
            >
              Informe profesora
            </button>
            <button
              type="button"
              onClick={() => {
                if (totalStoredMistakes === 0) {
                  showToast('Todavía no hay errores guardados para repasar.');
                } else {
                  startNewGame('repaso');
                }
              }}
              className="hover:text-orange-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Repasar errores
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => startNewGame('torneo')}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-orange-600 hover:to-amber-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Nueva partida
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Audio, Translation & General Reset Toolbar */}
      <div className="border-b border-amber-200 bg-amber-100/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="text-xs font-medium text-amber-950/80">
            <span>{QUESTION_BANK.length} preguntas de español (A2–B1)</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>Guardado local en este navegador</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSoundSettings((s) => ({ ...s, sfxEnabled: !s.sfxEnabled }))
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                soundSettings.sfxEnabled
                  ? 'border-slate-300 bg-white text-slate-800'
                  : 'border-slate-200 bg-slate-100 text-slate-500'
              }`}
            >
              {soundSettings.sfxEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Efectos</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSoundSettings((s) => ({ ...s, musicEnabled: !s.musicEnabled }))
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                soundSettings.musicEnabled
                  ? 'border-violet-300 bg-violet-50 text-violet-900'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <Music className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Música</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSoundSettings((s) => ({
                  ...s,
                  speechEnabled: !s.speechEnabled,
                }))
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                soundSettings.speechEnabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Voz es-ES</span>
            </button>

            <button
              type="button"
              onClick={() => setForceShowTranslation((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                forceShowTranslation
                  ? 'border-orange-400 bg-orange-100 text-orange-950'
                  : 'border-amber-200 bg-white text-stone-700'
              }`}
            >
              {forceShowTranslation ? (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Mostrar traducción</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reiniciar todo</span>
            </button>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="mx-auto mt-3 max-w-3xl px-4">
          <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-900">
            <CheckCircle2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* VIEW: BATTLE ARENA */}
      {screen === 'ARENA' && (activeGame || lastCompletedGame) && (
        <BattleArena
          game={(activeGame ?? lastCompletedGame)!}
          soundSettings={soundSettings}
          forceShowTranslation={forceShowTranslation}
          onToggleForceTranslation={() => setForceShowTranslation((v) => !v)}
          onAnswerSubmitted={handleAnswerSubmitted}
          onAdvanceTurn={handleAdvanceTurn}
          onStartGayaneFinal={handleStartGayaneFinal}
          onFinalTimeTick={handleFinalTimeTick}
          onNextRound={handleNextRound}
          onStartTieBreaker={handleStartTieBreaker}
          onOpenReport={() => setScreen('REPORT')}
          onPracticeMistakes={() => {
            const g = activeGame ?? lastCompletedGame;
            const ids = g
              ? Array.from(
                  new Set([
                    ...g.players.razmik.mistakeIds,
                    ...g.players.gayane.mistakeIds,
                  ])
                )
              : [];
            startNewGame('repaso', ids);
          }}
          onPlayAgain={() => {
            const prevScope =
              (activeGame ?? lastCompletedGame)?.scope ?? 'torneo';
            startNewGame(prevScope);
          }}
          onExitToMenu={() => setScreen('MENU')}
        />
      )}

      {/* VIEW: TEACHER REPORT */}
      {screen === 'REPORT' && (
        <TeacherReport
          razmikMatch={
            reportMatchSource?.players.razmik ?? createEmptyPlayerMatchState()
          }
          gayaneMatch={
            reportMatchSource?.players.gayane ?? createEmptyPlayerMatchState()
          }
          cumulative={cumulative}
          sessionTitle={
            reportMatchSource
              ? `Sesión (${reportMatchSource.difficulty})`
              : 'Resumen acumulado del curso'
          }
          speechEnabled={soundSettings.speechEnabled}
          forceShowTranslation={forceShowTranslation}
          onBack={() => setScreen('MENU')}
          onPracticeMistakes={() => startNewGame('repaso')}
        />
      )}

      {/* VIEW: MAIN MENU */}
      {screen === 'MENU' && (
        <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
          {/* Hero Split Matchup: Razmik vs Gayane */}
          <section className="grid items-stretch gap-5 lg:grid-cols-12">
            {/* Razmik Zone */}
            <div className="flex flex-col justify-between rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-orange-50 p-6 lg:col-span-3">
              <div>
                <div className="flex items-center gap-3">
                  <PlayerBadge player="razmik" />
                  <div>
                    <h2 className="text-2xl font-extrabold text-blue-900">
                      🔵 Razmik
                    </h2>
                    <p className="text-xs font-semibold text-orange-700">
                      Equipo Azul y Naranja · Fútbol
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-blue-100 pt-4">
                  <div>
                    <div className="text-xs text-slate-500">Victorias</div>
                    <div className="font-mono-tabular text-2xl font-extrabold text-blue-800">
                      {cumulative.wins.razmik}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Puntos totales</div>
                    <div className="font-mono-tabular text-2xl font-extrabold text-slate-900">
                      {cumulative.totalPoints.razmik}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-600">
                Aciertos acumulados:{' '}
                <strong className="font-mono-tabular">
                  {cumulative.correctCount.razmik}/
                  {cumulative.correctCount.razmik +
                    cumulative.wrongCount.razmik}
                </strong>
              </div>
            </div>

            {/* Center Championship Control Deck */}
            <div className="flex flex-col justify-between rounded-3xl border border-amber-200 bg-gradient-to-b from-white via-yellow-50/40 to-orange-50/40 p-6 shadow-sm lg:col-span-6">
              <div className="text-center">
                <p className="text-xs font-bold tracking-wide text-orange-700">
                  Duelo de Tiempos del Pasado · Español ↔ Armenio
                </p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
                  ¡Batalla de Español!
                </h1>
                <p className="mx-auto mt-2 max-w-xl text-sm text-stone-600">
                  Jueguen por turnos en el mismo dispositivo. Primero responde Razmik, después Gayane. Cada tres aciertos seguidos suman +5 puntos extra.
                </p>
              </div>

              {/* Filters: Difficulty, Tense, Questions per round */}
              <div className="mt-6 space-y-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-800">
                    Nivel:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'facil', label: 'Fácil' },
                        { id: 'medio', label: 'Medio' },
                        { id: 'dificil', label: 'Difícil' },
                      ] as const
                    ).map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setDifficulty(lvl.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                          difficulty === lvl.id
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-stone-700 border border-amber-200 hover:bg-amber-100/60'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-800">
                    Tiempo verbal:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'todos', label: 'Todos los tiempos' },
                        { id: 'perfecto', label: 'Perfecto' },
                        { id: 'indefinido', label: 'Indefinido' },
                        { id: 'imperfecto', label: 'Imperfecto' },
                        { id: 'pluscuamperfecto', label: 'Pluscuamperfecto' },
                      ] as const
                    ).map((tf) => (
                      <button
                        key={tf.id}
                        type="button"
                        onClick={() => setTenseFilter(tf.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                          tenseFilter === tf.id
                            ? 'bg-amber-500 text-stone-950 font-bold'
                            : 'bg-white text-stone-700 border border-amber-200 hover:bg-amber-100/60'
                        }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-stone-800">
                    Preguntas por jugador (Juegos 1–5):
                  </span>
                  <div className="flex gap-1.5">
                    {[3, 4, 5].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionsPerRound(count)}
                        className={`rounded-lg px-3 py-1 text-xs font-bold font-mono-tabular transition-colors cursor-pointer ${
                          questionsPerRound === count
                            ? 'bg-orange-600 text-white'
                            : 'bg-white text-stone-700 border border-amber-200 hover:bg-amber-100/60'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Primary Action Buttons */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => startNewGame('torneo')}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-sm hover:opacity-95 cursor-pointer whitespace-nowrap"
                >
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                  <span>¡Empezar torneo completo (6 juegos)!</span>
                </button>

                {hasUnfinishedGame && (
                  <button
                    type="button"
                    onClick={() => setScreen('ARENA')}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    <span>Continuar partida</span>
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-4 text-xs">
                <button
                  type="button"
                  onClick={() => setScreen('REPORT')}
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-blue-700 cursor-pointer"
                >
                  <Award className="h-4 w-4" aria-hidden="true" />
                  <span>Informe para la profesora</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (totalStoredMistakes === 0) {
                      showToast('Aún no hay errores guardados para repasar.');
                    } else {
                      startNewGame('repaso');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Repasar errores ({totalStoredMistakes})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="inline-flex items-center gap-1.5 font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Reiniciar resultados</span>
                </button>
              </div>
            </div>

            {/* Gayane Zone */}
            <div className="flex flex-col justify-between rounded-3xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-violet-50 p-6 lg:col-span-3">
              <div>
                <div className="flex items-center gap-3">
                  <PlayerBadge player="gayane" />
                  <div>
                    <h2 className="text-2xl font-extrabold text-pink-900">
                      🩷 Gayane
                    </h2>
                    <p className="text-xs font-semibold text-violet-700">
                      Equipo Rosa y Violeta · Estrellas
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-pink-100 pt-4">
                  <div>
                    <div className="text-xs text-slate-500">Victorias</div>
                    <div className="font-mono-tabular text-2xl font-extrabold text-pink-800">
                      {cumulative.wins.gayane}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Puntos totales</div>
                    <div className="font-mono-tabular text-2xl font-extrabold text-slate-900">
                      {cumulative.totalPoints.gayane}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-600">
                Aciertos acumulados:{' '}
                <strong className="font-mono-tabular">
                  {cumulative.correctCount.gayane}/
                  {cumulative.correctCount.gayane +
                    cumulative.wrongCount.gayane}
                </strong>
              </div>
            </div>
          </section>

          {/* 6 Mini-Games Selector Grid */}
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Los 6 minijuegos de la batalla
                </h2>
                <p className="text-sm text-slate-600">
                  Elige cualquier minijuego para practicarlo directamente o juega el torneo completo de 6 rondas.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_MODES.map((modeId) => {
                const info = GAME_MODE_INFO[modeId];
                return (
                  <button
                    key={modeId}
                    type="button"
                    onClick={() => startNewGame(modeId)}
                    className="group flex flex-col justify-between rounded-2xl border border-amber-200 bg-gradient-to-br from-white via-yellow-50/40 to-orange-50/50 p-5 text-left transition-all hover:border-orange-400 hover:shadow-md cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-orange-800/80">
                        <span>Juego {info.number}</span>
                        <span className="font-mono-tabular text-stone-700">
                          {info.secondsLimit}s · +{info.pointsPerCorrect} pts
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-extrabold text-stone-900 group-hover:text-orange-700">
                        {info.title}
                      </h3>
                      <p className="mt-1 text-sm text-stone-600">
                        {info.subtitle}
                      </p>
                    </div>

                    <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-orange-700">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Jugar ahora</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Interactive Past Tenses Preview (Click any Spanish example to see Armenian!) */}
          <section className="rounded-3xl border border-amber-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-600" aria-hidden="true" />
              <h2 className="text-xl font-extrabold text-stone-900">
                Repaso rápido · Haz clic en cualquier frase en español para ver su traducción al armenio
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(
                ['perfecto', 'indefinido', 'imperfecto', 'pluscuamperfecto'] as TenseKey[]
              ).map((t) => (
                <div
                  key={t}
                  className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
                >
                  <div className="text-sm font-extrabold text-stone-900">
                    {TENSE_LABELS[t]}
                  </div>
                  <div className="mt-0.5 text-xs text-stone-600">
                    {TENSE_DESCRIPTIONS[t]}
                  </div>
                  <div className="mt-3">
                    <ClickableSpanish
                      textEs={SAMPLE_SENTENCES[t].es}
                      translationHy={SAMPLE_SENTENCES[t].hy}
                      forceShowTranslation={forceShowTranslation}
                      speechEnabled={soundSettings.speechEnabled}
                      textClassName="text-sm font-semibold text-stone-900"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* Confirmation Modal for Reiniciar resultados */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <Flame className="h-6 w-6" aria-hidden="true" />
              <h3 id="reset-modal-title" className="text-xl font-extrabold text-slate-900">
                ¿Reiniciar todos los resultados?
              </h3>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Se borrarán los puntos acumulados, las victorias de Razmik y Gayane, la partida en curso y el historial de errores guardado en este dispositivo.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 cursor-pointer"
              >
                Sí, reiniciar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
