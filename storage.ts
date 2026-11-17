import {
  ActiveGameState,
  CumulativeStats,
  PlayerId,
  PlayerMatchState,
  SoundSettings,
  TenseKey,
} from './types';

const STATS_KEY = 'razmik_gayane_spanish_stats_v1';
const ACTIVE_GAME_KEY = 'razmik_gayane_spanish_active_v1';
const SETTINGS_KEY = 'razmik_gayane_spanish_settings_v1';

export function createEmptyTenseStats(): Record<
  TenseKey,
  { correct: number; total: number }
> {
  return {
    perfecto: { correct: 0, total: 0 },
    indefinido: { correct: 0, total: 0 },
    imperfecto: { correct: 0, total: 0 },
    pluscuamperfecto: { correct: 0, total: 0 },
  };
}

export function createEmptyPlayerMatchState(): PlayerMatchState {
  return {
    points: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    maxStreak: 0,
    streakBonuses: 0,
    tenseStats: createEmptyTenseStats(),
    mistakeIds: [],
  };
}

export function createEmptyCumulativeStats(): CumulativeStats {
  return {
    totalPoints: { razmik: 0, gayane: 0 },
    wins: { razmik: 0, gayane: 0 },
    ties: 0,
    completedRounds: 0,
    correctCount: { razmik: 0, gayane: 0 },
    wrongCount: { razmik: 0, gayane: 0 },
    tenseStats: {
      razmik: createEmptyTenseStats(),
      gayane: createEmptyTenseStats(),
    },
    mistakeHistoryIds: {
      razmik: [],
      gayane: [],
    },
    matchHistory: [],
  };
}

export function loadCumulativeStats(): CumulativeStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return createEmptyCumulativeStats();
    const parsed = JSON.parse(raw) as CumulativeStats;
    return {
      ...createEmptyCumulativeStats(),
      ...parsed,
      tenseStats: {
        razmik: {
          ...createEmptyTenseStats(),
          ...(parsed.tenseStats?.razmik ?? {}),
        },
        gayane: {
          ...createEmptyTenseStats(),
          ...(parsed.tenseStats?.gayane ?? {}),
        },
      },
      mistakeHistoryIds: {
        razmik: parsed.mistakeHistoryIds?.razmik ?? [],
        gayane: parsed.mistakeHistoryIds?.gayane ?? [],
      },
      matchHistory: parsed.matchHistory ?? [],
    };
  } catch {
    return createEmptyCumulativeStats();
  }
}

export function saveCumulativeStats(stats: CumulativeStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadActiveGame(): ActiveGameState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveGameState;
    if (!parsed || !Array.isArray(parsed.rounds) || parsed.rounds.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveGame(game: ActiveGameState | null): void {
  try {
    if (!game) {
      localStorage.removeItem(ACTIVE_GAME_KEY);
    } else {
      localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(game));
    }
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function resetAllStoredProgress(): CumulativeStats {
  const empty = createEmptyCumulativeStats();
  try {
    localStorage.removeItem(ACTIVE_GAME_KEY);
    localStorage.setItem(STATS_KEY, JSON.stringify(empty));
  } catch {
    // Ignore storage errors
  }
  return empty;
}

export function loadSoundSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { sfxEnabled: true, musicEnabled: false, speechEnabled: true };
    }
    return {
      sfxEnabled: true,
      musicEnabled: false,
      speechEnabled: true,
      ...(JSON.parse(raw) as Partial<SoundSettings>),
    };
  } catch {
    return { sfxEnabled: true, musicEnabled: false, speechEnabled: true };
  }
}

export function saveSoundSettings(settings: SoundSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function mergeMatchIntoCumulativeStats(
  prev: CumulativeStats,
  game: ActiveGameState,
  completedRoundsDelta: number
): CumulativeStats {
  const next: CumulativeStats = {
    totalPoints: {
      razmik: prev.totalPoints.razmik + game.players.razmik.points,
      gayane: prev.totalPoints.gayane + game.players.gayane.points,
    },
    wins: { ...prev.wins },
    ties: prev.ties,
    completedRounds: prev.completedRounds + completedRoundsDelta,
    correctCount: {
      razmik: prev.correctCount.razmik + game.players.razmik.correct,
      gayane: prev.correctCount.gayane + game.players.gayane.correct,
    },
    wrongCount: {
      razmik: prev.wrongCount.razmik + game.players.razmik.wrong,
      gayane: prev.wrongCount.gayane + game.players.gayane.wrong,
    },
    tenseStats: {
      razmik: createEmptyTenseStats(),
      gayane: createEmptyTenseStats(),
    },
    mistakeHistoryIds: {
      razmik: Array.from(
        new Set([
          ...prev.mistakeHistoryIds.razmik,
          ...game.players.razmik.mistakeIds,
        ])
      ),
      gayane: Array.from(
        new Set([
          ...prev.mistakeHistoryIds.gayane,
          ...game.players.gayane.mistakeIds,
        ])
      ),
    },
    matchHistory: [...prev.matchHistory],
  };

  (['razmik', 'gayane'] as PlayerId[]).forEach((pid) => {
    (['perfecto', 'indefinido', 'imperfecto', 'pluscuamperfecto'] as TenseKey[]).forEach(
      (tense) => {
        next.tenseStats[pid][tense] = {
          correct:
            prev.tenseStats[pid][tense].correct +
            game.players[pid].tenseStats[tense].correct,
          total:
            prev.tenseStats[pid][tense].total +
            game.players[pid].tenseStats[tense].total,
        };
      }
    );
  });

  const rp = game.players.razmik.points;
  const gp = game.players.gayane.points;
  const winner: PlayerId | 'tie' = rp > gp ? 'razmik' : gp > rp ? 'gayane' : 'tie';
  if (winner === 'razmik') next.wins.razmik += 1;
  else if (winner === 'gayane') next.wins.gayane += 1;
  else next.ties += 1;

  const rTotal = game.players.razmik.correct + game.players.razmik.wrong;
  const gTotal = game.players.gayane.correct + game.players.gayane.wrong;

  next.matchHistory.unshift({
    id: game.id,
    dateIso: new Date().toISOString(),
    modeLabel:
      game.scope === 'torneo'
        ? 'Torneo completo (6 juegos)'
        : game.scope === 'repaso'
          ? 'Repaso de errores'
          : `Modo: ${game.scope}`,
    winner,
    razmikPoints: rp,
    gayanePoints: gp,
    razmikCorrect: game.players.razmik.correct,
    razmikTotal: rTotal,
    gayaneCorrect: game.players.gayane.correct,
    gayaneTotal: gTotal,
  });

  next.matchHistory = next.matchHistory.slice(0, 20);
  return next;
}
