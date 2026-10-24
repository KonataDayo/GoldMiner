// config_shop.js — 配置（商店板块）：商品表 + 道具效果声明 + 商店/背包格子 UI 参数。
// 加商品直接加行；调界面布局只改 SHOP_UI。

// ============ 商店商品表 ============
// 每行一件商品（id 为 key）：price 价格（金币）、label 名称、desc 效果说明、
// key 游戏内快捷键（数字键 1/2/3，主菜单说明行与 HUD 背包行自动展示）；
// effect 效果声明（数据驱动，执行逻辑在 items.js）：
//   { type: 'buff', attr, mul, charges, refresh? }
//     —— 数值修饰：attr 属性、mul 倍数、charges 可用次数（按抓钩释放次数扣，
//        每次完整抓钩循环 -1，扣完失效；null = 持续到本局结束）；
//        refresh=true 重复使用刷新次数，否则同属性相乘叠加
//   { type: 'action' }
//     —— 执行行为（如炸药），实现注册在 items.js 的 ACTIONS
export const SHOP_ITEMS = {
  dynamite: {
    label: '炸药', desc: '炸掉当前勾住的物体', price: 120, color: '#e63946', sprite: '',
    key: '1', // 游戏内快捷键（input 只报按键，绑定在这里声明）
    effect: { type: 'action' },
  },
  strength: {
    label: '力量药水', desc: '接下来 10 次抓钩收回速度翻倍', price: 150, color: '#90be6d', sprite: '',
    key: '2',
    effect: { type: 'buff', attr: 'retractMul', mul: 2, charges: 10, refresh: true },
  },
  lucky: {
    label: '生财药水', desc: '本局得分 +20%', price: 200, color: '#f9c74f', sprite: '',
    key: '3',
    effect: { type: 'buff', attr: 'scoreMul', mul: 1.2, charges: null },
  },
};

// ============ 商店/背包共用 UI ============
// 两界面复用同一套"物品格子"：图标 + 名字 + 右下角数量角标（背包），
// 商店多价格与购买按钮、背包多使用按钮（同一组按钮参数 btn）；
// 布局几何都从这张表读。
export const SHOP_UI = {
  gridX: 150,  // 第一个格子的中心 x（列方向按 colGap 递增）
  gridY: 250,  // 第一行格子的中心 y（行方向按 rowGap 递增）
  cols: 3,     // 每行格子数
  colGap: 220, // 列间距（相邻格子中心）
  rowGap: 150, // 行间距
  iconR: 28,   // 图标半径（贴图显示直径 = iconR × 2）
  badgeR: 11,  // 数量角标半径（图标右下角）
  badgeBg: '#f9c74f',
  badgeText: '#3a2c1e',
  nameFont: 'bold 16px system-ui, sans-serif',
  countFont: 'bold 13px system-ui, sans-serif',
  priceFont: '14px system-ui, sans-serif',
  nameDy: 52,    // 名字相对格子中心的 y 偏移
  priceDy: 78,   // 价格相对格子中心的 y 偏移
  btn: { w: 88, h: 32, dy: 92 }, // 格子按钮（商店=购买、背包=使用，水平居中于格子）
};
