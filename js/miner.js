// miner.js — 矿工角色：状态机 + 绳子/钩子物理。
// 主循环每帧调 tick(dt, events)，按当前状态分发 update。
//
// 状态流转：
//   SWING ──输入──→ EXTEND ──到最长──→ RETRACT_EMPTY ──收回──→ SWING
//     ↑              │ 钩子碰到实体
//     │              ↓
//     │         RETRACT_LOADED ──收回──→ SETTLE ──结算完──→ SWING
//     └─────────────────────────────────────────────┘
import { MINER, ROPE, STATES, SETTLE_TIME } from './config_gameplay.js';
import { clamp } from './util/math.js';

export class Miner {
  constructor() {
    this.x = MINER.x;
    this.y = MINER.y;
    this._state = null;
    this._states = STATES_IMPL;

    // 回调钩子：由上层（Playing 界面）注入，矿工不依赖关卡逻辑
    this.onCollect = null;     // SETTLE 开始时触发（入账 + 播效果）
    this.checkContinue = null; // SETTLE 结束时触发，返回 'continue' | 'clear' | 'over'
    this.onSettleDone = null;  // 结算流程结束时触发
    this.onCycleDone = null;   // 一次完整抓钩循环结束（回到 SWING）时触发：buff 按次数递减
    this.getRetractMul = null; // 收回速度倍率来源（BuffManager 由界面层注入，力量药水）

    this.reset(); // 初值统一走 reset（新开一局同样调用）
  }

  get state() {
    return this._state;
  }

  /** 重置到初始状态（新开一局时由 Playing.enter() 调用） */
  reset() {
    this.ropeLen = ROPE.minLen;
    this.angle = 0;        // 0 = 竖直向下，正值向右
    this.phase = 0;        // 摆动相位（只在 SWING 推进）
    this.settleTimer = 0;
    this.caught = null;    // 当前抓到的实体
    this.setState(STATES.SWING);
  }

  /** 显式状态切换：调用新状态 enter。所有转移都走这里，不写隐式标志位。 */
  setState(next) {
    const prev = this._state;
    if (prev === next) return;
    this._state = next;
    this._states[next].enter.call(this, prev);
    console.log('[miner]', prev, '→', next);
  }

  /** 每帧入口：按当前状态分发。events 来自 input.poll()。 */
  tick(dt, events) {
    this._states[this._state].update.call(this, dt, events);
  }

  /** 钩子尖端世界坐标（绳子末端） */
  hookTip() {
    return {
      x: this.x + Math.sin(this.angle) * this.ropeLen,
      y: this.y + Math.cos(this.angle) * this.ropeLen,
    };
  }

  /** 被上层碰撞检测调用：钩子抓住了实体 */
  grab(entity) {
    if (this.state !== STATES.EXTEND) return;
    entity.caught = true;
    this.caught = entity;
    this.setState(STATES.RETRACT_LOADED);
  }

  /** 行为道具（炸药）调用：炸掉当前勾住的物体，转空钩收回 */
  blowCaught() {
    if (this.state !== STATES.RETRACT_LOADED || !this.caught) return false;
    this.caught.dead = true;
    this.caught = null;
    this.setState(STATES.RETRACT_EMPTY);
    return true;
  }
}

// ———— 各状态的 enter / update（this 绑定为矿工实例） ————
// 约定：每个状态都必须实现 enter 和 update，没有逻辑就写空函数。
// 缺了会在 setState/tick 里直接报错（RETRACT_EMPTY 曾因漏写 enter 崩溃）。
const STATES_IMPL = {
  [STATES.SWING]: {
    enter() {
      // 从当前角度反推相位，摆动从当前角度继续，不跳变
      const t = clamp(this.angle / MINER.swingAmp, -1, 1);
      this.phase = Math.asin(t);
      this.caught = null;
      this.onCycleDone?.(); // 一次抓钩循环结束：buff 按次数递减
    },
    update(dt, events) {
      this.phase += MINER.swingSpeed * dt;
      this.angle = Math.sin(this.phase) * MINER.swingAmp;
      if (events.some((e) => e.type === 'fire')) {
        this.setState(STATES.EXTEND);
      }
    },
  },

  [STATES.EXTEND]: {
    enter() {
      this.ropeLen = ROPE.minLen; // 发射瞬间角度锁定在摆动角度
    },
    update(dt) {
      this.ropeLen += MINER.extendSpeed * dt;
      if (this.ropeLen >= ROPE.maxLen) {
        this.ropeLen = ROPE.maxLen;
        this.setState(STATES.RETRACT_EMPTY);
      }
    },
  },

  [STATES.RETRACT_EMPTY]: {
    enter() {}, // 无进入逻辑（约定：空函数也必须写）
    update(dt) {
      this.ropeLen -= MINER.retractSpeed * dt;
      if (this.ropeLen <= ROPE.minLen) {
        this.ropeLen = ROPE.minLen;
        this.setState(STATES.SWING);
      }
    },
  },

  [STATES.RETRACT_LOADED]: {
    enter() {
      // 实体吸附到钩尖，之后逐帧跟随
      const tip = this.hookTip();
      this.caught.x = tip.x;
      this.caught.y = tip.y;
    },
    update(dt) {
      if (!this.caught) {
        this.setState(STATES.RETRACT_EMPTY);
        return;
      }
      // 收回速度 = 基础速度 ÷ 重量 × buff 倍率（力量药水），重量越大越慢；保底 40 px/s 后再乘倍率
      const base = Math.max(MINER.retractSpeed / this.caught.weight, 40);
      const speed = base * (this.getRetractMul?.() ?? 1);
      this.ropeLen -= speed * dt;
      const tip = this.hookTip();
      this.angle = Math.atan2(tip.x - this.x, tip.y - this.y);
      this.caught.x = tip.x;
      this.caught.y = tip.y;
      if (this.ropeLen <= ROPE.minLen) {
        this.ropeLen = ROPE.minLen;
        this.setState(STATES.SETTLE);
      }
    },
  },

  [STATES.SETTLE]: {
    enter() {
      this.settleTimer = 0;
      // 入账 + 播放效果（飘字等），由界面层注入
      if (this.onCollect && this.caught) this.onCollect(this.caught);
    },
    update(dt) {
      this.settleTimer += dt;
      if (this.settleTimer >= SETTLE_TIME) {
        // 结算完成：询问关卡"是否还能继续"
        const verdict = this.checkContinue ? this.checkContinue() : 'continue';
        const done = this.caught;
        this.setState(STATES.SWING);
        if (done) this.onSettleDone?.(verdict);
      }
    },
  },
};
