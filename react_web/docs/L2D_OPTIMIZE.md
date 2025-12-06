# Live2D Canvas 性能优化分析

## 一、当前实现分析

### 1.1 Canvas 尺寸设置

**当前状态：**
- `#live2d-container` 设置为全屏尺寸：`width: 100%; height: 100%;`
- `#live2d-canvas` 通过 PIXI 的 `resizeTo` 属性跟随容器大小
- 在 `initPIXI` 方法中：`resizeTo: document.getElementById(containerId)`
- Canvas 实际渲染尺寸 = 整个浏览器窗口/屏幕尺寸

**代码位置：**
- CSS: `templates/index.html` 第 213-226 行
- JavaScript: `static/live2d.js` 第 96-117 行（`initPIXI` 方法）

### 1.2 功能依赖分析

#### 拖拽功能 (`setupDragAndDrop`)
- **实现方式：** 使用 PIXI 的 `pointermove` 事件监听整个 stage
- **坐标系统：** 使用 `event.data.global` 获取全局坐标
- **关键代码：**
  - `this.pixi_app.stage.hitArea = this.pixi_app.screen` (第 1106 行)
  - `model.x = newPosition.x - dragStartPos.x` (第 1151 行)
  - `model.y = newPosition.y - dragStartPos.y` (第 1152 行)
- **依赖：** 需要监听整个屏幕区域的鼠标事件

#### 鼠标跟随功能 (`enableMouseTracking`)
- **实现方式：** 监听 stage 的 `pointermove` 事件
- **坐标系统：** 使用 `event.data.global` 和 `model.getBounds()` 计算距离
- **关键代码：**
  - `const pointer = event.data.global` (第 2519 行)
  - `const bounds = model.getBounds()` (第 2553 行)
  - `model.focus(pointer.x, pointer.y)` (第 2587 行)
- **依赖：** 需要监听整个屏幕区域的鼠标移动，计算与模型边界的距离

#### 模型位置和缩放
- **位置控制：** `model.x`, `model.y` (PIXI 坐标系统)
- **缩放控制：** `model.scale.set(scale)` 
- **锚点设置：** `model.anchor.set(0.65, 0.75)` (桌面端)
- **边界获取：** `model.getBounds()` 返回模型在 stage 坐标系中的边界

## 二、性能问题分析

### 2.1 当前性能开销

**Canvas 渲染开销：**
- Canvas 尺寸 = 屏幕分辨率（例如 1920x1080 = 2,073,600 像素）
- 每帧需要渲染的像素数量 = 全屏像素数
- 即使模型只占屏幕一小部分，Canvas 仍需要处理整个屏幕的渲染

**内存占用：**
- Canvas 缓冲区大小 = width × height × 4 bytes (RGBA)
- 1920×1080 = 约 8.3 MB 每帧
- 透明背景区域也在占用内存和 GPU 资源

**GPU 资源：**
- 全屏 Canvas 需要更多的 GPU 内存
- 合成层（compositing layer）占用更大
- 在 Electron 透明窗口场景下，性能影响更明显

### 2.2 优化潜力

**理论优化空间：**
- 如果模型实际显示区域为 800×1200 像素（常见 Live2D 模型尺寸）
- 优化后 Canvas 尺寸 ≈ 800×1200 = 960,000 像素
- 相比全屏 1920×1080 = 2,073,600 像素
- **性能提升约 53%**（像素数量减少）

**实际优化效果预估：**
- 渲染性能提升：30-50%
- 内存占用减少：50-60%
- GPU 资源占用减少：40-50%
- 在低端设备上效果更明显

## 三、优化方案可行性分析

### 3.1 方案概述

**核心思路：**
将 Canvas 尺寸限定为模型实际显示区域 + 适当边距，而不是全屏尺寸。

**实现步骤：**
1. 计算模型的实际显示尺寸（考虑缩放）
2. 动态设置 Canvas 尺寸为模型尺寸 + 边距
3. 调整容器定位，保持模型在屏幕上的显示位置不变
4. 调整事件处理，确保拖拽和鼠标跟随功能正常

### 3.2 技术可行性

#### ✅ 可行点

1. **模型尺寸获取**
   - 可以使用 `model.getBounds()` 获取模型边界
   - 可以结合 `model.scale` 计算实际显示尺寸
   - 代码位置：`static/live2d.js` 第 2553 行已有使用示例

2. **Canvas 尺寸动态调整**
   - PIXI 支持动态调整 renderer 尺寸
   - 可以使用 `pixi_app.renderer.resize(width, height)`
   - 需要禁用 `resizeTo` 或改为手动控制

3. **坐标系统转换**
   - PIXI 的坐标系统可以正常工作
   - `event.data.global` 仍然有效，但需要相对于新的 Canvas 尺寸
   - 可以通过调整 stage 位置来保持模型显示位置

#### ⚠️ 需要注意的问题

1. **容器定位调整**
   - 当前容器使用 `position: fixed; right: 0; bottom: 0;`
   - 优化后需要调整容器尺寸和位置
   - 需要确保模型在屏幕上的显示位置不变

2. **事件监听范围**
   - 当前 `stage.hitArea = this.pixi_app.screen` 监听整个屏幕
   - 优化后 Canvas 变小，但需要保持全屏事件监听能力
   - **解决方案：** 可以在容器上监听事件，然后转换坐标到 Canvas 坐标系

3. **模型边界检测**
   - 鼠标跟随功能使用 `model.getBounds()` 计算距离
   - 优化后需要确保边界计算仍然准确
   - 需要考虑模型移动和缩放时的动态调整

4. **窗口大小变化**
   - 需要监听窗口 resize 事件
   - 重新计算 Canvas 尺寸
   - 调整容器位置

## 四、对现有功能的影响分析

### 4.1 拖拽功能

**当前实现：**
- 监听整个 stage 的 `pointermove` 事件
- 使用 `event.data.global` 获取全局坐标
- 直接设置 `model.x` 和 `model.y`

**优化后影响：**
- ✅ **功能可保持：** 拖拽逻辑本身不受影响
- ⚠️ **需要调整：** 
  - 如果 Canvas 尺寸变小，需要确保拖拽时模型不会超出 Canvas 边界
  - 或者允许模型超出 Canvas，但只渲染可见部分
  - 事件监听可能需要从容器层面处理，然后转换坐标

**实现建议：**
```javascript
// 方案1: 在容器上监听事件，转换坐标
container.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 转换为 PIXI 坐标
    const globalPos = pixi_app.renderer.plugins.interaction.mouse.global;
    // 继续使用原有逻辑
});

// 方案2: 保持全屏 hitArea，但 Canvas 尺寸缩小
// 这样事件监听范围仍然是全屏，但渲染区域缩小
```

### 4.2 鼠标跟随功能

**当前实现：**
- 监听 stage 的 `pointermove` 事件
- 使用 `model.getBounds()` 计算模型边界
- 计算鼠标到模型边界的距离

**优化后影响：**
- ✅ **功能可保持：** 边界计算逻辑不受影响
- ⚠️ **需要调整：**
  - 鼠标坐标需要正确转换到 Canvas 坐标系
  - 如果事件在容器上监听，需要转换坐标
  - `model.getBounds()` 返回的仍然是模型在 stage 中的边界，不受 Canvas 尺寸影响

**实现建议：**
- 保持使用 `event.data.global`，PIXI 会自动处理坐标转换
- 或者手动转换：`const localPos = event.data.getLocalPosition(model.parent)`

### 4.3 模型位置和缩放

**当前实现：**
- 模型位置通过 `model.x`, `model.y` 控制
- 缩放通过 `model.scale` 控制
- 锚点通过 `model.anchor` 设置

**优化后影响：**
- ✅ **完全兼容：** 模型的位置、缩放、锚点设置不受影响
- ✅ **边界计算正常：** `model.getBounds()` 仍然返回正确的边界

### 4.4 其他功能

**浮动按钮显示：**
- 当前基于鼠标距离模型边界的距离显示/隐藏
- 优化后不受影响，因为边界计算逻辑不变

**滚轮缩放：**
- 当前实现不受 Canvas 尺寸影响
- 优化后功能正常

## 五、实现难点和注意事项

### 5.1 技术难点

1. **坐标系统转换**
   - 需要确保鼠标事件坐标正确转换到 PIXI 坐标系
   - 需要考虑容器位置、Canvas 位置、模型位置的相对关系
   - **解决：** 使用 PIXI 的坐标转换 API，或手动计算偏移

2. **动态尺寸调整**
   - 模型缩放或移动时，需要重新计算 Canvas 尺寸
   - 需要监听模型变化事件
   - **解决：** 在模型加载、缩放、移动后重新计算并调整 Canvas

3. **容器定位**
   - 需要保持模型在屏幕上的显示位置不变
   - 需要计算容器的 `right` 和 `bottom` 值
   - **解决：** 根据模型位置和 Canvas 尺寸计算容器位置

4. **边界处理**
   - 模型可能超出 Canvas 边界（拖拽时）
   - 需要决定是限制拖拽范围还是允许超出
   - **解决：** 建议允许超出，只渲染可见部分

### 5.2 性能考虑

1. **频繁调整 Canvas 尺寸**
   - 避免在每帧都调整 Canvas 尺寸
   - 只在模型尺寸或位置显著变化时调整
   - 使用防抖（debounce）或节流（throttle）

2. **事件监听优化**
   - 如果改为在容器上监听事件，需要考虑事件冒泡
   - 避免重复监听导致性能问题

3. **渲染区域优化**
   - 可以设置 PIXI 的 `renderer.viewport` 来限制渲染区域
   - 但需要确保坐标系统正确

### 5.3 兼容性考虑

1. **不同屏幕尺寸**
   - 需要适配不同分辨率的屏幕
   - 移动端和桌面端可能需要不同的处理

2. **窗口大小变化**
   - 需要监听 `window.resize` 事件
   - 重新计算 Canvas 尺寸和容器位置

3. **模型切换**
   - 切换模型时，新模型的尺寸可能不同
   - 需要重新计算并调整 Canvas

## 六、推荐实现方案

### 6.1 方案 A：最小改动方案（推荐）

**核心思路：**
- 保持事件监听在 stage 层面（全屏范围）
- 只缩小 Canvas 的实际渲染尺寸
- 通过调整容器尺寸和位置来保持显示效果

**优点：**
- 改动最小，风险最低
- 事件处理逻辑基本不变
- 兼容性最好

**实现要点：**
1. 计算模型实际显示尺寸（`model.getBounds()` + 边距）
2. 动态设置 `pixi_app.renderer.resize(width, height)`
3. 调整 `#live2d-container` 的尺寸和位置
4. 保持 `stage.hitArea` 为全屏或容器尺寸

### 6.2 方案 B：完全优化方案

**核心思路：**
- Canvas 尺寸 = 模型尺寸 + 边距
- 事件监听在容器层面，手动转换坐标
- 更精细的控制和优化

**优点：**
- 性能优化最彻底
- 内存占用最小

**缺点：**
- 实现复杂度较高
- 需要处理更多边界情况
- 坐标转换可能引入 bug

## 七、总结

### 7.1 优化可行性

✅ **高度可行**
- 技术实现上完全可行
- 现有功能可以保持
- 性能提升明显

### 7.2 推荐实施步骤

1. **第一阶段：** 实现方案 A（最小改动）
   - 动态计算模型尺寸
   - 调整 Canvas 和容器尺寸
   - 测试拖拽和鼠标跟随功能

2. **第二阶段：** 性能测试和优化
   - 测试不同场景下的性能
   - 优化尺寸计算频率
   - 处理边界情况

3. **第三阶段（可选）：** 方案 B 深度优化
   - 如果方案 A 效果不够，考虑方案 B
   - 实现更精细的事件处理
   - 进一步优化内存占用

### 7.3 预期效果

- **性能提升：** 30-50%
- **内存占用减少：** 50-60%
- **GPU 资源减少：** 40-50%
- **用户体验：** 无明显影响（功能保持）

### 7.4 风险评估

- **低风险：** 方案 A 实现简单，风险可控
- **中风险：** 需要充分测试各种场景
- **建议：** 先在测试环境验证，再逐步推广

