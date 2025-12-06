// 原有通用模态对话框系统已迁移到 React Modal 组件，此文件不再提供 showAlert/showConfirm/showPrompt。

/**
 * 禁用浏览器缩放快捷键
 * 阻止 Ctrl+/Ctrl- 和 Ctrl+滚轮 缩放页面
 */
(function() {
    'use strict';
    
    // 禁用 Ctrl+/- 和 Ctrl+0 键盘快捷键
    document.addEventListener('keydown', function(event) {
        // 检测 Ctrl 或 Cmd 键（Mac）
        if (event.ctrlKey || event.metaKey) {
            // 禁用加号、减号、等号（=键位常用作+）和数字0
            if (event.key === '+' || 
                event.key === '=' || 
                event.key === '-' || 
                event.key === '_' || 
                event.key === '0') {
                event.preventDefault();
                return false;
            }
        }
    }, { passive: false });
    
    // 禁用 Ctrl + 滚轮缩放
    document.addEventListener('wheel', function(event) {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            return false;
        }
    }, { passive: false });
    
    // 禁用触控板的双指缩放手势（适用于部分浏览器）
    document.addEventListener('gesturestart', function(event) {
        event.preventDefault();
        return false;
    }, { passive: false });
    
    document.addEventListener('gesturechange', function(event) {
        event.preventDefault();
        return false;
    }, { passive: false });
    
    document.addEventListener('gestureend', function(event) {
        event.preventDefault();
        return false;
    }, { passive: false });
    
    console.log('页面缩放快捷键已禁用');
})();

