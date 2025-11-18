/**
 * i18next CDN 加载器和容错机制
 * 自动检查依赖、尝试备用 CDN、使用降级方案
 * 
 * 使用方式：
 * 1. 在 HTML 中引入 i18next CDN：
 *    <script src="https://cdn.jsdelivr.net/npm/i18next@23.7.6/dist/umd/i18next.min.js" 
 *            onerror="console.error('[i18n] 加载 i18next 失败');"></script>
 *    <script src="https://cdn.jsdelivr.net/npm/i18next-http-backend@2.4.2/dist/umd/i18nextHttpBackend.min.js"
 *            onerror="console.error('[i18n] 加载 i18nextHttpBackend 失败');"></script>
 * 2. 然后引入此文件：
 *    <script src="/static/i18next-loader.js"></script>
 */

(function() {
    'use strict';
    
    // 等待所有脚本加载完成后再执行初始化
    let checkCount = 0;
    const maxChecks = 50; // 最多检查 5 秒
    
    function checkDependencies() {
        checkCount++;
        
        const i18nextLoaded = typeof i18next !== 'undefined';
        const backendLoaded = typeof i18nextHttpBackend !== 'undefined';
        
        if (i18nextLoaded && backendLoaded) {
            console.log('[i18n] ✅ 所有依赖库已加载');
            // 加载初始化脚本
            const script = document.createElement('script');
            script.src = '/static/i18n-i18next.js';
            document.head.appendChild(script);
        } else if (checkCount < maxChecks) {
            // 继续等待
            setTimeout(checkDependencies, 100);
        } else {
            // 超时，尝试使用备用 CDN
            console.error('[i18n] ⚠️ 依赖库加载超时，尝试使用备用 CDN...');
            console.log('[i18n] 加载状态:', {
                i18next: i18nextLoaded,
                backend: backendLoaded
            });
            
            // 如果 i18nextHttpBackend 未加载，尝试备用 CDN
            if (!backendLoaded) {
                console.log('[i18n] 尝试从 unpkg CDN 加载 i18nextHttpBackend...');
                const backupScript = document.createElement('script');
                backupScript.src = 'https://unpkg.com/i18next-http-backend@2.4.2/dist/umd/i18nextHttpBackend.min.js';
                backupScript.onload = function() {
                    console.log('[i18n] ✅ 备用 CDN 加载成功');
                    // 再次检查并加载初始化脚本
                    setTimeout(() => {
                        if (typeof i18nextHttpBackend !== 'undefined') {
                            const script = document.createElement('script');
                            script.src = '/static/i18n-i18next.js';
                            document.head.appendChild(script);
                        }
                    }, 100);
                };
                backupScript.onerror = function() {
                    console.error('[i18n] ❌ 备用 CDN 也加载失败');
                    // 即使失败也加载初始化脚本，让它使用降级方案
                    const script = document.createElement('script');
                    script.src = '/static/i18n-i18next.js';
                    document.head.appendChild(script);
                };
                document.head.appendChild(backupScript);
            } else {
                // 其他库未加载，直接加载初始化脚本
                console.log('[i18n] 加载初始化脚本（使用降级方案）');
                const script = document.createElement('script');
                script.src = '/static/i18n-i18next.js';
                document.head.appendChild(script);
            }
        }
    }
    
    // 开始检查
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkDependencies);
    } else {
        checkDependencies();
    }
    
    // 安全网：10秒后强制加载初始化脚本（即使依赖未加载）
    setTimeout(function() {
        if (typeof window.t === 'undefined') {
            console.warn('[i18n] ⚠️ 10秒后仍未初始化，强制加载初始化脚本');
            const script = document.createElement('script');
            script.src = '/static/i18n-i18next.js';
            document.head.appendChild(script);
        }
    }, 10000);
})();

