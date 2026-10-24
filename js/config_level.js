// config_level.js — 配置（关卡板块）：难度表 + 抓取物表。
// 调难度、调生成、加物体类型只改这个文件。

// ============ 玩法 · 难度表 ============
// 每行一个难度，后续直接往下加行；tag 用于命名与运行时查找。
// 启动默认难度由 ACTIVE_DIFFICULTY 指定；运行中由主菜单的难度选择覆盖。
// 字段说明：
//   targetValue       本关获胜所需价值金额
//   time              本关限时（秒）
//   scale             场上物品总价值 = targetValue × scale（越大场上越富）
//   maxCount          生成物品数量上限（保险阀：防死循环/过密，正常不触顶）
//   minSpawnRadius    物品距矿工支点的最小半径
//   maxSpawnRadius    物品距矿工支点的最大半径（生成位置 clamp 在两者之间）
//   spacingGap        物体最小间距附加值：两物距离 < rA + rB + spacingGap 时舍弃本次生成（越大越稀疏）
//   valueDistanceBias 价值-距离关联度 ∈ [0,1]：越大，越贵的物体越倾向生成在外圈
//   sizeScale         物体尺寸缩放（作用于碰撞/显示半径）：越小越难勾中
export const DIFFICULTIES = [
  {
    tag: 'easy', label: '简单',
    targetValue: 200, time: 60, scale: 2.0, maxCount: 35,
    minSpawnRadius: 110, maxSpawnRadius: 350, spacingGap: 16,
    valueDistanceBias: 0.4, sizeScale: 1.15,
  },
  {
    tag: 'normal', label: '普通',
    targetValue: 300, time: 60, scale: 1.5, maxCount: 40,
    minSpawnRadius: 130, maxSpawnRadius: 380, spacingGap: 12,
    valueDistanceBias: 0.6, sizeScale: 1.0,
  },
  {
    tag: 'hard', label: '困难',
    targetValue: 500, time: 50, scale: 1.1, maxCount: 45,
    minSpawnRadius: 220, maxSpawnRadius: 390, spacingGap: 8,
    valueDistanceBias: 0.8, sizeScale: 0.85,
  },
];

/** 启动时的默认难度（tag），运行时按需查表 */
export const ACTIVE_DIFFICULTY = 'hard';

/** 按 tag 查找难度配置；找不到时回退到表里第一行 */
export function getDifficulty(tag = ACTIVE_DIFFICULTY) {
  return DIFFICULTIES.find((d) => d.tag === tag) ?? DIFFICULTIES[0];
}

// ============ 玩法 · 抓取物 ============
// value 分值 / weight 重量（越大收回越慢）/ r 碰撞半径
// ratio 生成时被抽中的权重（百分比，合计不必为 1，自动归一化）
// spawnRate Russian Roulette 接受概率 ∈ (0,1)：抽中后再掷随机数，≤ 它才真正生成
// sprite 贴图路径（空 = 矢量占位；render 按路径缓存，多类型可复用同一张图只加载一次）/ color 矢量占位颜色
export const OBJ_TYPES = {
  goldSmall: {
    label: '小金块', value: 50, weight: 1.6, r: 14,
    ratio: 0.22, spawnRate: 0.9, sprite: 'small_gold.png', color: '#f9c74f',
  },
  goldBig: {
    label: '大金块', value: 200, weight: 3.2, r: 26,
    ratio: 0.1, spawnRate: 0.7, sprite: 'large_gold.png', color: '#f4a300',
  },
  diamond: {
    label: '钻石', value: 300, weight: 0.8, r: 11,
    ratio: 0.06, spawnRate: 0.5, sprite: 'diamond.png', color: '#5bc0eb',
  },
  stoneSmall: {
    label: '小石头', value: 20, weight: 2.2, r: 15,
    ratio: 0.27, spawnRate: 0.9, sprite: 'small_stone.png', color: '#8d99ae',
  },
  stoneBig: {
    label: '大石头', value: 50, weight: 4.5, r: 28,
    ratio: 0.15, spawnRate: 0.75, sprite: 'large_stone.png', color: '#6c757d',
  },
  bag: {
    label: '神秘袋', value: 100, weight: 2.0, r: 16,
    ratio: 0.2, spawnRate: 0.8, sprite: 'mystery_bag.png', color: '#a98274',
  },
};
