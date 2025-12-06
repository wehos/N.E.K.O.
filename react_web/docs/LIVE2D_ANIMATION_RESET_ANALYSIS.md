# Live2D 动画播放结束后重置机制分析

## 一、当前实现分析

### 1.1 动画播放完成检测方式

**代码位置：** `static/live2d.js` 第 272-399 行（`playMotion` 方法）

**当前实现：**
- 使用 `setTimeout` 基于估算的 duration 来检测动画完成
- 不是使用 Live2D 官方的 motion 完成回调

**具体代码：**

```362:366:static/live2d.js
// 设置定时器在motion结束后清理motion参数（但保留expression）
this.motionTimer = setTimeout(() => {
console.log(`motion播放完成（预期文件: ${choice.File}），清除motion参数但保留expression`);
    this.motionTimer = null;
    this.clearEmotionEffects(); // 只清除motion参数，不清除expression
}, motionDuration);
```

**问题分析：**
1. ⚠️ **不准确的时间估算**：duration 是从 motion 文件的 `Meta.Duration` 获取，默认值为 5000ms
   - 如果文件没有 `Meta.Duration`，使用默认 5000ms
   - 实际动画可能比估算时间短或长
   - 如果动画比估算时间长，会在动画还在播放时就重置参数
   - 如果动画比估算时间短，参数重置会延迟

2. ⚠️ **缺少真正的动画完成回调**：
   - Live2D SDK 应该提供 `onMotionFinished` 或类似回调
   - 当前实现没有监听实际的动画完成事件
   - 只是基于时间估算，不够可靠

### 1.2 简单动作（playSimpleMotion）的实现

**代码位置：** `static/live2d.js` 第 403-463 行

**当前实现：**
- 直接设置参数值（如 `ParamAngleY`）
- 使用固定的 setTimeout 时间（1000ms、1200ms、800ms）
- 在定时器回调中调用 `clearEmotionEffects()`

**问题分析：**
1. ✅ **固定时间相对准确**：简单动作的时间较短且固定，问题不大
2. ⚠️ **仍然不是基于实际完成事件**：但简单动作是直接设置参数，没有真正的动画播放

### 1.3 参数重置逻辑（clearEmotionEffects）

**代码位置：** `static/live2d.js` 第 465-575 行

**重置流程：**

1. **清除动作定时器**
2. **停止所有 motion**：使用 `motionManager.stopAllMotions()`
3. **重置所有参数到默认值**：关键步骤

**重置参数的代码：**

```512:544:static/live2d.js
// 重置所有参数到默认值（关键步骤）
if (this.currentModel && this.currentModel.internalModel && this.currentModel.internalModel.coreModel) {
    try {
        const coreModel = this.currentModel.internalModel.coreModel;
        const paramCount = coreModel.getParameterCount();
        
        console.log(`开始重置${paramCount}个参数到默认值...`);
        
        // 遍历所有参数，将其重置为默认值
        for (let i = 0; i < paramCount; i++) {
            try {
                const paramId = coreModel.getParameterId(i);
                const defaultValue = coreModel.getParameterDefaultValueByIndex(i);
                
                // 跳过嘴巴相关参数（这些由口型同步控制）
                if (paramId === 'ParamMouthOpenY' || paramId === 'ParamO') {
                    continue;
                }
                
                // 重置参数到默认值
                coreModel.setParameterValueByIndex(i, defaultValue);
            } catch (e) {
                // 单个参数重置失败不影响其他参数
            }
        }
```

**问题分析：**

1. ❌ **眼睛参数未被保护**：
   - 只跳过了嘴巴参数（`ParamMouthOpenY`, `ParamO`）
   - **眼睛参数（如 `ParamEyeLOpen`, `ParamEyeROpen`, `ParamEyeBallX`, `ParamEyeBallY` 等）会被重置**
   - 眼睛可能在动画后突然跳到默认状态，导致不自然

2. ❌ **表情参数也会被重置**：
   - 虽然之后会重新应用 expression（第 557-564 行）
   - 但在重置和重新应用之间可能有短暂延迟
   - 可能导致表情闪烁

3. ❌ **所有 motion 参数都被重置**：
   - 包括面部表情、身体姿态等所有参数
   - 可能影响眼睛注视、呼吸动画等持续效果

4. ✅ **之后会重新应用 expression**：
   ```557:565:static/live2d.js
   // 重新应用当前的expression（这样expression会覆盖需要修改的参数）
   if (this.currentEmotion && this.currentEmotion !== 'neutral') {
       try {
           console.log(`重新应用当前emotion的expression: ${this.currentEmotion}`);
           this.playExpression(this.currentEmotion);
       } catch (e) {
           console.warn('重新应用expression失败:', e);
       }
   }
   ```

5. ✅ **会重新应用常驻表情**：
   ```567:572:static/live2d.js
   // 重新应用常驻表情
   try {
       this.applyPersistentExpressionsNative();
   } catch (e) {
       console.warn('重新应用常驻表情失败:', e);
   }
   ```

## 二、存在的问题

### 2.1 动画完成检测不准确

**问题描述：**
- 使用 `setTimeout` 基于估算的 duration 检测动画完成
- 实际动画完成时间可能与估算不符

**影响：**
- 可能在动画还在播放时就重置参数（如果动画比估算时间长）
- 可能延迟重置参数（如果动画比估算时间短）
- 导致动画结束后的状态不自然

**应该使用的方式：**
- Live2D SDK 应该提供 motion 完成回调
- 例如：`motion.onFinished()` 或 `motionManager.onMotionFinished()`

### 2.2 眼睛参数被重置

**问题描述：**
- `clearEmotionEffects()` 重置所有参数时，眼睛参数也会被重置
- 只保护了嘴巴参数，没有保护眼睛参数

**可能受影响的参数：**
- `ParamEyeLOpen` / `ParamEyeROpen`（左右眼睁开程度）
- `ParamEyeBallX` / `ParamEyeBallY`（眼球位置）
- `ParamEyeForm`（眼睛形状）
- 其他眼睛相关参数

**影响：**
- 眼睛可能在动画结束后突然跳到默认状态
- 失去眼睛的自然注视或眨眼状态
- 可能看起来眼睛"瞪大"或"闭合"不自然

### 2.3 表情参数重置时机问题

**问题描述：**
- 所有表情参数先被重置到默认值
- 然后再重新应用 expression
- 在这两个操作之间可能有短暂延迟

**影响：**
- 可能导致表情短暂闪烁
- 从动画表情→默认表情→目标表情的跳跃
- 虽然时间很短，但在某些情况下可能可见

### 2.4 Motion 状态管理问题

**问题描述：**
- 调用 `stopAllMotions()` 停止所有 motion
- 然后立即重置所有参数
- 如果 motion 有自己的完成回调或状态，可能被忽略

**影响：**
- 可能打断 motion 的自然结束
- 强制停止可能导致参数状态不完整

## 三、正确重置机制的建议

### 3.1 使用 Live2D 官方的 Motion 完成回调

**建议实现：**

```javascript
// 播放 motion 时，应该监听完成回调
const motion = await this.currentModel.motion(emotion);

if (motion) {
    // 方法1: 如果 motion 对象有 onFinished 属性
    if (motion.onFinished) {
        motion.onFinished = () => {
            console.log('motion播放完成，开始重置');
            this.clearEmotionEffects();
        };
    }
    
    // 方法2: 如果使用 motionManager 的事件
    if (this.currentModel.internalModel.motionManager) {
        const motionManager = this.currentModel.internalModel.motionManager;
        // 监听 motion 完成事件（需要查看 SDK 文档确认具体 API）
        motionManager.on('motionFinished', () => {
            this.clearEmotionEffects();
        });
    }
    
    // 方法3: 保留 setTimeout 作为备用方案
    // 但应该基于实际播放状态，而不是固定时间
}
```

### 3.2 保护眼睛参数不被重置

**建议修改：**

```javascript
// 在 clearEmotionEffects 中，跳过眼睛相关参数
for (let i = 0; i < paramCount; i++) {
    try {
        const paramId = coreModel.getParameterId(i);
        const defaultValue = coreModel.getParameterDefaultValueByIndex(i);
        
        // 跳过嘴巴相关参数（由口型同步控制）
        if (paramId === 'ParamMouthOpenY' || paramId === 'ParamO') {
            continue;
        }
        
        // 新增：跳过眼睛相关参数
        if (paramId.includes('Eye') || 
            paramId === 'ParamEyeLOpen' || 
            paramId === 'ParamEyeROpen' ||
            paramId === 'ParamEyeBallX' ||
            paramId === 'ParamEyeBallY' ||
            paramId === 'ParamEyeForm') {
            continue;
        }
        
        // 重置参数到默认值
        coreModel.setParameterValueByIndex(i, defaultValue);
    } catch (e) {
        // 单个参数重置失败不影响其他参数
    }
}
```

### 3.3 优化表情重新应用的时机

**建议修改：**

```javascript
// 在重置参数之前，先保存当前表情参数
const savedExpressionParams = {};

// 如果当前有 expression，先保存其参数
if (this.currentEmotion && this.currentEmotion !== 'neutral') {
    // 保存当前 expression 的关键参数
    // ...（根据实际需求实现）
}

// 重置参数（跳过表情相关的参数，而不是全部重置后再恢复）

// 或者：使用更平滑的方式
// 1. 停止 motion
// 2. 直接应用 expression（覆盖 motion 改变的表情参数）
// 3. 只重置身体姿态等 motion 相关的参数
```

### 3.4 区分 Motion 参数和 Expression 参数

**建议改进：**

不要重置所有参数，而是：
1. **只重置 Motion 相关的参数**（如身体姿态、头部角度等）
2. **不重置 Expression 参数**（如面部表情、眼睛等）
3. **不重置持续效果参数**（如眼睛注视、呼吸等）

**实现思路：**

```javascript
// 定义需要重置的参数类型
const motionRelatedParams = [
    'ParamAngleX', 'ParamAngleY', 'ParamAngleZ',  // 头部角度
    'ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ',  // 身体角度
    'ParamPositionX', 'ParamPositionY', 'ParamPositionZ',  // 位置
    // ... 其他 motion 相关的参数
];

// 只重置 motion 相关的参数
for (let i = 0; i < paramCount; i++) {
    const paramId = coreModel.getParameterId(i);
    
    // 跳过嘴巴参数
    if (paramId === 'ParamMouthOpenY' || paramId === 'ParamO') {
        continue;
    }
    
    // 跳过眼睛参数
    if (paramId.includes('Eye')) {
        continue;
    }
    
    // 只重置 motion 相关的参数
    if (motionRelatedParams.includes(paramId)) {
        const defaultValue = coreModel.getParameterDefaultValueByIndex(i);
        coreModel.setParameterValueByIndex(i, defaultValue);
    }
    // 其他参数（表情参数）保持不变
}
```

## 四、总结

### 4.1 当前问题总结

1. ❌ **动画完成检测不准确**：使用 `setTimeout` 估算，而不是真实的完成回调
2. ❌ **眼睛参数被重置**：导致眼睛状态不自然
3. ⚠️ **表情参数重置时机问题**：重置后重新应用可能导致短暂闪烁
4. ⚠️ **所有参数都被重置**：应该只重置 motion 相关的参数

### 4.2 正确的重置机制应该：

1. ✅ **使用真实的动画完成回调**：监听 Live2D SDK 提供的 motion 完成事件
2. ✅ **保护眼睛参数**：不要重置眼睛相关参数，让眼睛保持自然状态
3. ✅ **保护表情参数**：不重置表情参数，或者先保存后恢复，避免闪烁
4. ✅ **只重置 motion 相关参数**：区分 motion 参数和 expression 参数，只重置前者

### 4.3 优先级建议

1. **高优先级**：保护眼睛参数不被重置
2. **高优先级**：使用真实的动画完成回调（如果 SDK 支持）
3. **中优先级**：优化表情参数的重新应用时机
4. **低优先级**：区分 motion 参数和 expression 参数，实现更精细的控制

