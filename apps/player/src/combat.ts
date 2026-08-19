import type { BattleBackground } from '@rpgcrafter/game-schema';

export function battleBackgroundImage(background: BattleBackground | undefined, assetUrls: Record<string, string>) {
  if (!background) return '';
  const lowerUrl = assetUrls[background.lowerImage];
  const upperUrl = assetUrls[background.upperImage];
  return lowerUrl && upperUrl ? `url("${upperUrl}"), url("${lowerUrl}")` : '';
}

export function playerDamage(attack: number, equipmentAttack: number, skillDamage: number, enemyDefense: number) {
  return Math.max(1, attack + equipmentAttack + skillDamage - enemyDefense);
}

export function enemyDamage(attack: number, playerDefense: number, equipmentDefense: number) {
  return Math.max(1, attack - playerDefense - equipmentDefense);
}
