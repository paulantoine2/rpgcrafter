import type { Vec2 } from './types.js';

export const CHARACTER_DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type CharacterDirection = typeof CHARACTER_DIRECTIONS[number];

export const CHARACTER_FRAME_SIZE = 48;
export const CHARACTER_COUNT = 8;
const CHARACTERS_PER_ROW = 4;
const FRAMES_PER_DIRECTION = 3;
const DIRECTIONS_PER_CHARACTER = 4;
const WALK_FRAME_DURATION = 0.12;
const WALK_SEQUENCE = [0, 1, 2, 1] as const;

export function characterDirection(facing: Vec2): CharacterDirection {
  if (Math.abs(facing.x) > Math.abs(facing.y)) return facing.x < 0 ? 'left' : 'right';
  return facing.y < 0 ? 'up' : 'down';
}

export function characterFrame(characterIndex: number, direction: CharacterDirection, pattern: number) {
  if (!Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex >= CHARACTER_COUNT) throw new RangeError(`Index de personnage invalide : ${characterIndex}`);
  if (!Number.isInteger(pattern) || pattern < 0 || pattern >= FRAMES_PER_DIRECTION) throw new RangeError(`Frame de marche invalide : ${pattern}`);
  const characterColumn = characterIndex % CHARACTERS_PER_ROW;
  const characterRow = Math.floor(characterIndex / CHARACTERS_PER_ROW);
  const directionRow = CHARACTER_DIRECTIONS.indexOf(direction);
  return {
    x: (characterColumn * FRAMES_PER_DIRECTION + pattern) * CHARACTER_FRAME_SIZE,
    y: (characterRow * DIRECTIONS_PER_CHARACTER + directionRow) * CHARACTER_FRAME_SIZE,
    width: CHARACTER_FRAME_SIZE,
    height: CHARACTER_FRAME_SIZE,
  };
}

export function walkFrame(elapsedSeconds: number, moving: boolean) {
  if (!moving) return 1;
  const sequenceIndex = Math.floor(Math.max(0, elapsedSeconds) / WALK_FRAME_DURATION) % WALK_SEQUENCE.length;
  return WALK_SEQUENCE[sequenceIndex];
}
