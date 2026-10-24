// util/math.js — 纯函数工具：随机、范围、加权抽取、夹取、插值。
// 全部是 JS 内置 Math API 的薄封装；本项目零依赖，暂无引入第三方库的必要，
// 日后需要复杂数学功能（噪声/矩阵等）再考虑引入。

/** [0, 1) 随机浮点数 */
export function rand() {
  return Math.random();
}

/** [lo, hi) 随机浮点数 */
export function randRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

/** [lo, hi] 随机整数（含两端） */
export function randInt(lo, hi) {
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}

/** 把 v 夹到 [lo, hi] */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 把 v 从 [lo, hi] 归一化到 [0, 1]（越界时夹取） */
export function norm01(v, lo, hi) {
  return clamp((v - lo) / (hi - lo), 0, 1);
}

/** 线性插值：t ∈ [0,1] 时返回 a→b 之间的值 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 按权重随机抽取一个元素。
 * @param {Array} items 候选数组
 * @param {(item) => number} weightOf 取权重函数；权重合计不必为 1（自动归一化）
 * @returns {*} 抽中的元素
 */
export function pickWeighted(items, weightOf) {
  const weights = items.map(weightOf);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1]; // 浮点误差兜底
}

// ———— 低差异序列（low discrepancy sequence） ————

/** 基变换逆根（radical inverse）：Halton 低差异序列的一维分量 */
export function radicalInverse(i, base) {
  let result = 0;
  let f = 1 / base;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

/** Halton 2D 低差异序列的第 index 个点，返回 [u, v] ∈ [0,1)² */
export function halton2D(index) {
  return [radicalInverse(index, 2), radicalInverse(index, 3)];
}
