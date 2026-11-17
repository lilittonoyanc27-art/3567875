export type PlayerId = 'razmik' | 'gayane';

export type TenseKey =
  | 'perfecto'
  | 'indefinido'
  | 'imperfecto'
  | 'pluscuamperfecto';

export type TenseFilter = 'todos' | TenseKey;

export type DifficultyLevel = 'facil' | 'medio' | 'dificil';

export type GameModeId =
  | 'elige'
  | 'traduce'
  | 'corrige'
  | 'viaje'
  | 'batalla'
  | 'desafio';

export type PlayScope = 'torneo' | GameModeId | 'repaso';

export interface QuestionOption {
  id: string;
  text: string;
  hy?: string;
  isSpanish?: boolean;
}

export interface Question {
  id: string;
  mode: GameModeId;
  tense: TenseKey;
  difficulty: DifficultyLevel;
  topic: string;
  promptEs?: string;
  promptHy?: string;
  errorHighlight?: string;
  verbMeta?: {
    infinitiveEs: string;
    infinitiveHy: string;
    person: string;
    tenseLabel: string;
  };
  options: QuestionOption[];
  correctOptionId: string;
  explanationEs: string;
  explanationHy: string;
}

export interface TenseScore {
  correct: number;
  total: number;
}

export interface PlayerMatchState {
  points: number;
  correct: number;
  wrong: number;
  streak: number;
  maxStreak: number;
  streakBonuses: number;
  tenseStats: Record<TenseKey, TenseScore>;
  mistakeIds: string[];
}

export interface MatchRecord {
  id: string;
  dateIso: string;
  modeLabel: string;
  winner: PlayerId | 'tie';
  razmikPoints: number;
  gayanePoints: number;
  razmikCorrect: number;
  razmikTotal: number;
  gayaneCorrect: number;
  gayaneTotal: number;
}

export interface CumulativeStats {
  totalPoints: Record<PlayerId, number>;
  wins: Record<PlayerId, number>;
  ties: number;
  completedRounds: number;
  correctCount: Record<PlayerId, number>;
  wrongCount: Record<PlayerId, number>;
  tenseStats: Record<PlayerId, Record<TenseKey, TenseScore>>;
  mistakeHistoryIds: Record<PlayerId, string[]>;
  matchHistory: MatchRecord[];
}

export interface RoundPlan {
  roundIndex: number;
  mode: GameModeId;
  razmikQuestions: Question[];
  gayaneQuestions: Question[];
  isFinalChallenge: boolean;
  isTieBreaker?: boolean;
}

export interface ActiveGameState {
  id: string;
  scope: PlayScope;
  difficulty: DifficultyLevel;
  tenseFilter: TenseFilter;
  rounds: RoundPlan[];
  currentRoundIndex: number;
  activePlayer: PlayerId;
  razmikQuestionIdx: number;
  gayaneQuestionIdx: number;
  phase:
    | 'PLAYING'
    | 'HANDOFF_GAYANE'
    | 'ROUND_SUMMARY'
    | 'TIE_BREAKER_INTRO'
    | 'GAME_OVER';
  players: Record<PlayerId, PlayerMatchState>;
  finalTimerRemaining: Record<PlayerId, number>;
  startedAtIso: string;
}

export interface SoundSettings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  speechEnabled: boolean;
}

export const TENSE_LABELS: Record<TenseKey, string> = {
  perfecto: 'Pretérito Perfecto',
  indefinido: 'Pretérito Indefinido',
  imperfecto: 'Pretérito Imperfecto',
  pluscuamperfecto: 'Pretérito Pluscuamperfecto',
};

export const TENSE_DESCRIPTIONS: Record<TenseKey, string> = {
  perfecto: 'He jugado · Acción pasada conectada con el presente',
  indefinido: 'Jugué · Acción puntual terminada en el pasado',
  imperfecto: 'Jugaba · Hábito, descripción o acción en progreso',
  pluscuamperfecto: 'Había jugado · Acción anterior a otro momento pasado',
};

export const GAME_MODE_INFO: Record<
  GameModeId,
  {
    number: number;
    title: string;
    subtitle: string;
    pointsPerCorrect: number;
    secondsLimit: number;
  }
> = {
  elige: {
    number: 1,
    title: '¡Elige la respuesta!',
    subtitle: 'Completa la oración con el verbo correcto',
    pointsPerCorrect: 10,
    secondsLimit: 30,
  },
  traduce: {
    number: 2,
    title: '¡Traduce y gana!',
    subtitle: 'Lee en armenio y elige la traducción al español',
    pointsPerCorrect: 10,
    secondsLimit: 30,
  },
  corrige: {
    number: 3,
    title: '¡Corrige el error!',
    subtitle: 'Detecta el verbo incorrecto y elige la forma adecuada',
    pointsPerCorrect: 10,
    secondsLimit: 30,
  },
  viaje: {
    number: 4,
    title: '¡Viaje al pasado!',
    subtitle: 'Ubica cada oración en la línea temporal del pasado',
    pointsPerCorrect: 10,
    secondsLimit: 30,
  },
  batalla: {
    number: 5,
    title: '¡La batalla de los verbos!',
    subtitle: 'Conjuga el verbo armenio en 30 segundos',
    pointsPerCorrect: 10,
    secondsLimit: 30,
  },
  desafio: {
    number: 6,
    title: '¡El desafío final!',
    subtitle: '10 preguntas en 90 segundos · +20 puntos por acierto',
    pointsPerCorrect: 20,
    secondsLimit: 90,
  },
};
