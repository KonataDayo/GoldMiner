// savegame.js — 本地存档：玩家属性（金币/胜场/背包）+ 每难度最近一次战绩。
// 存储用 localStorage（零依赖、浏览器原生）；每次启动读档，无档/损坏自动新建。
// 数据模型（JSON）：
//   { version: 1, coins: 金币数, totalWins: 获胜总次数,
//     backpack: { [商品id]: 持有数量 },            // 背包（商店购买写入这里）
//     records: { [难度tag]: { tag, result, score, timeUsed } } }
const STORAGE_KEY = 'goldminer.save.v1';

/** 默认档（新档 / 旧档缺字段时用它补齐） */
const DEFAULTS = {
  version: 1,
  coins: 0,
  totalWins: 0,
  backpack: {},
  records: {},
};

export class SaveManager {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.data = this._load();
  }

  /** 读本地存档；没有/损坏就新建默认档并落盘 */
  _load() {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.version === 1) {
          return { ...DEFAULTS, ...data }; // 旧档兼容：缺的字段（如 backpack）用默认值补
        }
      }
    } catch (err) {
      console.warn('[save] 读档失败，使用新档', err);
    }
    const fresh = { ...DEFAULTS };
    this._write(fresh);
    return fresh;
  }

  /** 金币数（每局结算入账，胜/负都保留挖到的分数） */
  get coins() {
    return this.data.coins;
  }

  /** 获胜总次数（过关才 +1） */
  get totalWins() {
    return this.data.totalWins;
  }

  /** 某难度的最近战绩；没有记录返回 null */
  getRecord(tag) {
    return this.data.records[tag] ?? null;
  }

  /** 背包数据：商品id → 持有数量（Backpack 类读这里） */
  get backpack() {
    return this.data.backpack;
  }

  /** 某商品持有数量 */
  getItemCount(id) {
    return this.data.backpack[id] ?? 0;
  }

  /** 商品入包（购买时由商店调用），默认 +1 */
  addItem(id, n = 1) {
    this.data.backpack[id] = this.getItemCount(id) + n;
    this._write(this.data);
  }

  /** 扣金币：够则扣并落盘返回 true；不够返回 false 不动账 */
  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this._write(this.data);
    return true;
  }

  /**
   * 一局结算：记录该难度战绩（有则替换、无则新增），并累计玩家属性。
   * 每局只应调用一次（由 PlayingScreen 在关卡结束当帧调用）。
   */
  finishLevel({ tag, result, score, timeUsed }) {
    this.data.records[tag] = { tag, result, score, timeUsed };
    this.data.coins += score;
    if (result === 'clear') this.data.totalWins += 1;
    this._write(this.data);
  }

  /** 落盘。存储不可用（隐私模式等）时降级为仅内存，不打断游戏。 */
  _write(data) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[save] 存档写入失败（本局不持久化）', err);
    }
  }

  /** 清档：删除本地存档并把内存态复位为默认值（清档按钮二次确认后调用） */
  clear() {
    try {
      this.storage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[save] 删档失败', err);
    }
    // backpack/records 重建为空对象：避免与 DEFAULTS 共享引用被后续写入污染
    this.data = { ...DEFAULTS, backpack: {}, records: {} };
  }
}
