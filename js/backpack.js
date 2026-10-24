// backpack.js — 背包：玩家持有的道具数量。
// 数据持久化在存档（SaveManager.backpack），本类只是它的遍历/增减封装；
// 界面层"打开背包"时调 list() 遍历展示。
import { SHOP_ITEMS } from './config_shop.js';

export class Backpack {
  constructor(save) {
    this.save = save; // SaveManager：背包数据的持久化来源
  }

  /** 某商品的持有数量 */
  count(id) {
    return this.save.getItemCount(id);
  }

  /** 商品入包（商店购买时调用），默认 +1 */
  add(id, n = 1) {
    this.save.addItem(id, n);
  }

  /** 遍历背包：按配置表顺序返回 [{ id, def, count }]，只含持有的 */
  list() {
    return Object.keys(SHOP_ITEMS)
      .map((id) => ({ id, def: SHOP_ITEMS[id], count: this.count(id) }))
      .filter((it) => it.count > 0);
  }

  /** 背包是否为空（"打开背包"时决定显示空态还是列表） */
  get isEmpty() {
    return this.list().length === 0;
  }
}
