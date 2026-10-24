// shop.js — 商店：商品列表来自 config 的 SHOP_ITEMS 表，购买 = 扣金币 + 入背包。
import { SHOP_ITEMS } from './config_shop.js';

/** 商品：配置表里的一行 + 运行时状态 */
export class ShopItem {
  constructor(id, def) {
    this.id = id;
    this.label = def.label; // 名称
    this.desc = def.desc;   // 效果说明
    this.price = def.price; // 价格（金币）
    this.color = def.color ?? '#ffffff';
    this.sprite = def.sprite ?? '';
  }
}

export class Shop {
  constructor(save, backpack) {
    this.save = save;         // 扣款/余额
    this.backpack = backpack; // 入包
    // 商品列表由配置表生成：加商品只需在 SHOP_ITEMS 加行
    this.items = Object.keys(SHOP_ITEMS).map((id) => new ShopItem(id, SHOP_ITEMS[id]));
  }

  /**
   * 购买：金币足够 → 扣款 + 入包，返回 { ok: true, item }；
   * 失败返回 { ok: false, reason: 'no-such-item' | 'no-coins' }。
   */
  buy(id) {
    const item = this.items.find((it) => it.id === id);
    if (!item) return { ok: false, reason: 'no-such-item' };
    if (!this.save.spendCoins(item.price)) return { ok: false, reason: 'no-coins' };
    this.backpack.add(item.id);
    return { ok: true, item };
  }
}
