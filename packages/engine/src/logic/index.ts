export { solveLogically, findNextStep, findNextStepFrom, replayPath } from './solve.js';
export type {
  SolveOutcome,
  SolvePath,
  SolveLogicallyOptions,
  PathFrame,
  Position,
} from './solve.js';
export {
  REGISTRY,
  RATING_VERSION,
  MAX_KNOWN_DIFFICULTY,
  TECHNIQUE_CATALOGUE,
  techniqueInfo,
} from './registry.js';
export type { TechniqueInfo } from './registry.js';
export { rate, LEVELS, levelInfo, levelForScore } from './rate.js';
export type { Rating, Level, LevelInfo } from './rate.js';
export { LogicState } from './state.js';
export type {
  Step,
  TechniqueId,
  TechniqueEntry,
  Placement,
  Elimination,
  CellDigits,
  LogicStateView,
} from './types.js';
