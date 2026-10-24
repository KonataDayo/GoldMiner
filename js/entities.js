// entities.js — 抓取物 + 关卡生成。
// 生成算法（参数来自 config 的难度表 DIFFICULTIES / OBJ_TYPES）：
//   1. 类型：按 ratio 权重抽取 + Russian Roulette（rand ≤ spawnRate 才接受）
//   2. 位置：Halton 低差异序列 → 距矿工 [minSpawnRadius, maxSpawnRadius] 的
//      正下方 ±75° 对称扇形，clamp 进画布安全区；低差异让候选点天然分散；
//      并按价值关联距离（valueDistanceBias）：越贵的物体越倾向生成在外圈
//   3. 间距：与已生成物体距离 < rA + rB + spacingGap 时直接舍弃本次生成，
//      进入下一次（拒绝式采样：判断少、无需算偏移）
//   4. 停止：总价值 ≥ targetValue × scale；数量触顶 maxCount 或尝试触顶则保险退出
import { CANVAS, WORLD } from './config.js';
import { MINER } from './config_gameplay.js';
import { OBJ_TYPES, ACTIVE_DIFFICULTY, getDifficulty } from './config_level.js';
import { rand, randInt, lerp, pickWeighted, clamp, norm01, halton2D } from './util/math.js';

export class Entity {
  constructor(type, x, y, sizeScale = 1) {
    const def = OBJ_TYPES[type];
    this.type = type;
    this.x = x;
    this.y = y;
    this.value = def.value;
    this.weight = def.weight;
    this.r = def.r * sizeScale; // 尺寸由难度表的 sizeScale 缩放（碰撞/显示共用）
    this.sprite = def.sprite;   // 贴图路径（空 = 矢量占位，render.js 里决定）
    this.color = def.color;
    this.dead = false;   // 已结算收走 → 移除
    this.caught = false; // 正被钩子拖回中
  }
}

const MAX_ATTEMPTS = 2000;        // 生成尝试次数上限（保险阀）
const FAN = (75 * Math.PI) / 180; // 生成扇形半角：正下方 ±75°

// 物体价值范围（价值→距离关联的归一化用），由物体表自动算出
const VALUE_MIN = Math.min(...Object.values(OBJ_TYPES).map((t) => t.value));
const VALUE_MAX = Math.max(...Object.values(OBJ_TYPES).map((t) => t.value));

/** 生成一关的抓取物。tag 指定难度（默认当前启用难度；主菜单选择后传入所选 tag） */
export function spawnLevel(tag = ACTIVE_DIFFICULTY) {
  const DIFF = getDifficulty(tag);
  const target = DIFF.targetValue * DIFF.scale; // 需要生成的总价值
  const list = [];
  let total = 0;
  let attempt = 0;
  const seed = randInt(0, 1000); // 随机起点：同一低差异序列，每局布局不同

  while (total < target && list.length < DIFF.maxCount && attempt < MAX_ATTEMPTS) {
    attempt++;

    // 1. 类型：ratio 加权抽取 + Russian Roulette
    const type = pickWeighted(Object.keys(OBJ_TYPES), (t) => OBJ_TYPES[t].ratio);
    if (rand() > OBJ_TYPES[type].spawnRate) continue;

    // 2. 位置：Halton 低差异序列 → 下方对称扇形（价值越高越偏外圈）
    const [u, v] = halton2D(seed + attempt);
    const { x, y } = mapToSpawnArea(u, v, DIFF, OBJ_TYPES[type].value);

    // 3. 间距不足 → 舍弃本次生成，直接下一次（半径按缩放后的实际尺寸）
    const r = OBJ_TYPES[type].r * DIFF.sizeScale;
    if (tooClose(list, x, y, r, DIFF)) continue;

    const e = new Entity(type, x, y, DIFF.sizeScale);
    list.push(e);
    total += e.value;
  }

  console.log('[spawn]', DIFF.tag, list.length, '个物体，总价值', total, '/ 目标', target.toFixed(0), '（尝试', attempt, '次）');
  return list;
}

const EDGE = 40; // 物品距画布边缘的最小间距

/** Halton 点 [u,v] ∈ [0,1)² → 距矿工 [minR, maxR] 的下方对称扇形，clamp 进安全区。
 *  价值关联：valueDistanceBias ∈ [0,1] 把半径采样 u 向该物体的价值归一值拉拢，
 *  0 = 完全不关联（纯 Halton），1 = 半径完全由价值决定（贵的必在外圈）。 */
function mapToSpawnArea(u, v, DIFF, value) {
  const minR = DIFF.minSpawnRadius;
  const maxR = DIFF.maxSpawnRadius;
  const value01 = norm01(value, VALUE_MIN, VALUE_MAX); // 0 = 最便宜，1 = 最贵
  const ru = lerp(u, value01, DIFF.valueDistanceBias);
  // 面积均匀：对 r² 插值（对 r 插值会让内圈偏密）
  const r = Math.sqrt(lerp(minR * minR, maxR * maxR, ru));
  const a = lerp(-FAN, FAN, v); // 正下方 ±75°，左右对称
  const x = clamp(MINER.x + Math.sin(a) * r, EDGE, CANVAS.width - EDGE);
  const y = clamp(
    MINER.y + Math.cos(a) * r,
    MINER.y + minR,
    WORLD.groundY - 40
  );
  return { x, y };
}

/** 与已生成物体靠得太近？间距阈值 = rA + rB + spacingGap */
function tooClose(list, x, y, r, DIFF) {
  for (const e of list) {
    const minDist = e.r + r + DIFF.spacingGap;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy < minDist * minDist) return true;
  }
  return false;
}
