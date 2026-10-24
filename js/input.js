// input.js — 键盘 / 鼠标输入 → 事件队列。
// 状态机不直接监听事件，而是每帧从队列里消费（输入与逻辑解耦）。
// 鼠标点击事件携带画布坐标（x/y），供界面按钮命中检测；
// 键盘事件没有坐标，界面层据此区分"按钮点击"与"玩法输入"。
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.queue = [];
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return; // 忽略按住时的自动重复
      if (e.code === 'Space' || e.code === 'ArrowDown') {
        e.preventDefault();
        this.queue.push({ type: 'fire' });
      }
      // 数字键 = 道具快捷键：只报按键，绑定关系由界面层按 SHOP_ITEMS.key 匹配
      if (/^Digit[0-9]$/.test(e.code)) this.queue.push({ type: 'use', key: e.key });
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // 画布坐标（当前 CSS 不缩放画布，1:1；日后若加 CSS 缩放需除以缩放系数）
      const rect = this.canvas.getBoundingClientRect();
      this.queue.push({
        type: 'fire',
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    });
  }

  /** 取走并清空积压事件。主循环每帧调用一次。 */
  poll() {
    return this.queue.splice(0);
  }
}
