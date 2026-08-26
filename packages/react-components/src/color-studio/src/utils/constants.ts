// packages/react-components/src/color-studio/src/utils/constants.ts
//
// 和声规则常量(角度偏移 + 明度档数)。

import type { HarmonyType } from '../../../../../../apps/showcase/src/api/components/color-studio/types';

/** 各规则相对 anchor 色相角偏移(°),monochromatic 不用此表。 */
export const HARMONY_ANGLE_TABLE: Record<Exclude<HarmonyType, 'monochromatic'>, number[]> = {
  complementary: [180],
  triadic: [120, 240],
  'split-complementary': [150, 210],
  analogous: [-30, 30],
};

/** 各规则派生输出总条数(含 anchor)。 */
export const HARMONY_OUTPUT_LENGTH: Record<HarmonyType, number> = {
  complementary: 2,
  triadic: 3,
  'split-complementary': 3,
  analogous: 3,
  monochromatic: 5,
};

/** 单色规则的明度档数(以 0/0.25/0.5/0.75/1 均匀分布)。 */
export const MONOCHROMATIC_TIERS = HARMONY_OUTPUT_LENGTH.monochromatic;
