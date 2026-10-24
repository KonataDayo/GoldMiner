// buffs.js — BuffManager：持有道具 buff（运行时数值修饰）的数据结构。
// 只负责挂载/按次数递减/查询/清场，不关心 attr 具体含义（attr 是字符串 key）。
//
// 计时模型（用户定）：按「抓钩释放次数」消耗——每次完整抓钩循环结束
// （矿工回到 SWING，由 onCycleDone 钩子驱动 cycleDone()）charges -1，扣完失效；
// charges = null 表示持续到本局结束（新局 clear() 清空）。
// 若次数制体验不佳要退回时间制：把 charges 换成 ttl（秒），update(dt) 每帧递减，
// 并把"循环结束扣次数"改回"每帧扣时间"即可，数据结构其余不变。
export class Buffs {
  constructor() {
    this.list = []; // { id, attr, mul, charges }
  }

  /**
   * 挂 buff：refresh=true 时重复使用同一道具 = 刷新次数（charges 重置），
   * 否则同属性再挂一条、效果相乘叠加。
   */
  add(spec) {
    if (spec.refresh) {
      const old = this.list.find((b) => b.id === spec.id);
      if (old) {
        old.charges = spec.charges ?? null;
        return;
      }
    }
    this.list.push({ id: spec.id, attr: spec.attr, mul: spec.mul, charges: spec.charges ?? null });
  }

  /** 一次完整抓钩循环结束：按次数递减，扣完移除 */
  cycleDone() {
    for (const b of this.list) {
      if (b.charges == null) continue;
      b.charges -= 1;
    }
    this.list = this.list.filter((b) => b.charges == null || b.charges > 0);
  }

  /** 某属性的当前总倍数（没有 buff 返回 1） */
  getMul(attr) {
    let m = 1;
    for (const b of this.list) {
      if (b.attr === attr) m *= b.mul;
    }
    return m;
  }

  /** 清场：新开一局时调用（buff 是运行时态，不存档） */
  clear() {
    this.list = [];
  }
}
