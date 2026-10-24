// items.js — 道具效果：统一消耗接口 useItem + action 型执行逻辑。
// 模式同 miner.js 的 STATES_IMPL：config_shop.js 只声明数据（effect 参数），
// buff 型由 useItem 通用处理（挂到 Buffs），action 型在这里写执行逻辑。
import { SHOP_ITEMS } from './config_shop.js';
import { STATES } from './config_gameplay.js';

// action 型道具的执行逻辑（按商品 id 注册；config 里 effect.type === 'action' 的才需要）
const ACTIONS = {
  dynamite(ctx) {
    const { miner } = ctx.game;
    if (miner.state !== STATES.RETRACT_LOADED || !miner.caught) {
      return { ok: false, reason: 'no-target', message: '没有勾住物体' };
    }
    const e = miner.caught;
    miner.blowCaught(); // 状态机内完成：标记 dead + 转 RETRACT_EMPTY（空钩继续收）
    ctx.popups?.push({ text: '💥', x: e.x, y: e.y, t: 0 });
    return { ok: true, message: '已炸掉' };
  },
};

/**
 * 道具统一消耗接口（所有使用入口都调这里）：
 * 数量校验 → 附加效果（buff 挂 Buffs / action 立即执行）→ 有效才扣 1 个（写存档）→ 返回 { ok, message }。
 * ctx 由调用方组装：{ game, popups, buffs }，items.js 不 import 界面层。
 */
export function useItem(id, ctx) {
  const def = SHOP_ITEMS[id];
  if (!def) return { ok: false, reason: 'no-such-item', message: '未知道具' };
  if (ctx.game.backpack.count(id) <= 0) {
    return { ok: false, reason: 'no-item', message: '没有该道具' };
  }

  const fx = def.effect;
  let res;
  if (fx.type === 'buff') {
    // buff = 纯数据声明：挂到 Buffs（refresh 重复使用刷新次数，否则同属性相乘叠加）
    ctx.buffs.add({
      id,
      attr: fx.attr,
      mul: fx.mul,
      charges: fx.charges ?? null,
      refresh: fx.refresh ?? false,
    });
    res = { ok: true, message: `${def.label} 生效！` };
  } else if (fx.type === 'action') {
    const fn = ACTIONS[id];
    res = fn ? fn(ctx) : { ok: false, reason: 'no-effect', message: '效果未实现' };
  } else {
    res = { ok: false, reason: 'no-effect', message: '该道具还没有效果' };
  }

  if (!res.ok) return res; // 无效不消耗（如炸药没勾住物体）
  ctx.game.backpack.add(id, -1); // 消耗 1 个（数量持久化进存档）
  return { ok: true, ...res };
}
