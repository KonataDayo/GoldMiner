// config.js — 配置（画面板块）：画布、世界、主题配色、角色外观。
// 玩法数值在 config_gameplay.js / config_level.js，商店在 config_shop.js。
// 约定：所有贴图路径为相对 ASSET.root 的相对路径；src 为空 = 未配置贴图，用矢量占位。

// ============ 资源路径 ============
export const ASSET = {
  root: 'assets/', // 素材根目录（AI 素材到位后放这里）
};

// ============ 画布 ============
export const CANVAS = { width: 800, height: 600 };

// ============ 玩法 · 世界 ============
export const WORLD = {
  groundY: 560, // 地面线（生成区域与绘制共用）
};

// ============ 美术 · 全局主题 ============
// 天空/地面/UI 配色都在这里，整体换美术风格只改这一块
export const THEME = {
  sky: { top: '#0f2027', bottom: '#2c5364' }, // 天空渐变
  ground: { color: '#3a2c1e', edge: '#54402a', edgeHeight: 6 },
  hud: { color: '#ffffff', font: 'bold 20px system-ui, sans-serif', pad: 16, lineY: 34, subFont: 'bold 15px system-ui, sans-serif', subLineY: 62 },
  popup: { color: '#ffe066', font: 'bold 16px system-ui, sans-serif', floatSpeed: 40, life: 1.0 },
  result: {
    overlay: 'rgba(0,0,0,0.55)',
    titleColor: '#ffffff',
    titleFont: 'bold 42px system-ui, sans-serif',
    textFont: '20px system-ui, sans-serif',
  },
  ui: { // 按钮（主菜单 / 游戏内 / 商店购买共用）
    button: '#2b5876',
    buttonBorder: 'rgba(255,255,255,0.35)',
    buttonText: '#ffffff',
    buttonFont: 'bold 18px system-ui, sans-serif',
  },
  menu: { // 界面大标题（主菜单/商店/背包共用）
    title: '#f9c74f',
    titleShadow: 'rgba(0,0,0,0.5)',
    subtitle: 'rgba(255,255,255,0.75)',
    subtitleFont: '16px system-ui, sans-serif',
  },
  debug: { color: 'rgba(255,255,255,0.7)', font: '12px monospace' },
};

// ============ 美术 · 角色外观 ============
// 下面是"角色外观"通用结构（schema），任何角色套用同一份字段：
//   body         本体贴图与锚点（anchor = 绳支点在贴图上的位置，占图比例）
//   placeholder  贴图未配置/未加载完时的矢量占位参数
//   rope         绳子颜色/粗细
//   hook         钩子贴图与矢量占位
// 加新角色（P2 矿工、换肤等）时复制这份结构改值即可。
export const MINER_LOOK = {
  body: {
    src: '',             // 矿工本体贴图；空 = 用 placeholder
    size: 64,            // 显示宽度 (px)，高度按图等比
    anchor: { x: 0.5, y: 0.2 }, // 绳支点在贴图上的位置（比例）
  },
  placeholder: {
    skin: '#e0ac69',
    cloth: '#7a4a2b',
    radius: 16,
  },
  rope: {
    color: '#d9c9a3',
    width: 2,
  },
  hook: {
    src: '',          // 钩子贴图；空 = 矢量十字钩
    size: 12,         // 显示尺寸 (px)
    color: '#cfd2d6', // 矢量占位颜色
  },
};
