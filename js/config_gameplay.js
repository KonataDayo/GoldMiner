// config_gameplay.js — 配置（玩法板块）：矿工物理、绳子、状态机。
// 调手感只改这个文件。

// ============ 玩法 · 矿工物理 ============
export const MINER = {
  x: 400,            // 钩子支点位置（画布中心，随画布改）
  y: 120,
  swingSpeed: 1.6,   // 摆动角速度 (rad/s)
  swingAmp: 1.1,     // 摆动最大角度 (rad，约 63°)
  extendSpeed: 420,  // 绳子放出速度 (px/s)
  retractSpeed: 300, // 空钩收回速度 (px/s)
  hookRadius: 10,    // 钩子碰撞半径
};

// ============ 玩法 · 绳子 ============
export const ROPE = {
  minLen: 28,   // 收回后的基础绳长
  maxLen: 430,  // 最大绳长
};

export const SETTLE_TIME = 0.5; // 结算状态停留时长（秒）

// 状态机状态名
export const STATES = {
  SWING: 'swing',                 // 摆动待发射
  EXTEND: 'extend',               // 绳子放出
  RETRACT_EMPTY: 'retractEmpty',  // 空钩收回
  RETRACT_LOADED: 'retractLoaded',// 负重收回
  SETTLE: 'settle',               // 结算：入账 + 播效果 + 判定能否继续
};
