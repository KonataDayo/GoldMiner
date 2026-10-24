// level.js — 关卡：计分、倒计时、胜负判定。
import { ACTIVE_DIFFICULTY, getDifficulty } from './config_level.js';

export class Level {
  constructor(cfg = {}) {
    // 未传参用当前启用难度；cfg.tag 可按 tag 查表（运行时查找，供菜单/多关卡用）
    const diff = getDifficulty(cfg.tag ?? ACTIVE_DIFFICULTY);
    this.tag = diff.tag;
    this.target = cfg.target ?? diff.targetValue;
    this.timeLeft = cfg.time ?? diff.time;
    this.score = 0;
    this.elapsed = 0;   // 本关已耗时（秒），结算存档用
    this.finished = false;
    this.result = null; // 'clear' | 'over'
  }

  addScore(v) {
    this.score += v;
  }

  /** 每帧更新：倒计时。 */
  update(dt) {
    if (this.finished) return;
    this.timeLeft -= dt;
    this.elapsed += dt;
    if (this.timeLeft <= 0) this.finish('over');
  }

  /**
   * 由矿工的 SETTLE 状态在每次结算后调用：游戏是否还能继续。
   * 返回 'continue'（继续）| 'clear'（达标过关）| 'over'（超时）。
   */
  checkContinue() {
    if (this.score >= this.target) return this.finish('clear');
    if (this.timeLeft <= 0) return this.finish('over');
    return 'continue';
  }

  finish(result) {
    if (this.finished) return this.result;
    this.finished = true;
    this.result = result;
    console.log('[level]', result === 'clear' ? '过关' : '超时', 'score:', this.score);
    return result;
  }
}
