document.addEventListener('DOMContentLoaded', () => {
  // 加载部分页面
  const includeTargets = document.querySelectorAll('[data-include]');
  includeTargets.forEach(async (el) => {
    const originalUrl = el.getAttribute('data-include');
    if (!originalUrl) return;
    
    // 定义要尝试的路径列表
    let pathsToTry = [];
    
    // 总是尝试原始路径和html前缀的路径
    pathsToTry.push(originalUrl);
    
    if (originalUrl.startsWith('partials/')) {
      // 如果原始路径以partials/开头，也尝试html/partials/路径
      pathsToTry.push(`html/${originalUrl}`);
    }
    
    // 逐个尝试路径，直到成功加载
    for (const url of pathsToTry) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) {
          const html = await res.text();
          el.outerHTML = html;
          highlightCurrentPage();
          console.log('Successfully loaded:', url);
          return; // 成功加载后退出循环
        }
      } catch (e) {
        console.warn('Path failed:', url, e);
      }
    }
    
    // 如果所有路径都失败
    console.error('Failed to load partial:', originalUrl);
  });
  
  // 直接执行一次页面高亮（如果没有动态加载的情况）
  highlightCurrentPage();
});

// 高亮当前页面的导航菜单
function highlightCurrentPage() {
  const currentPath = window.location.pathname;
  const currentFilename = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';
  
  const navLinks = document.querySelectorAll('.menu li a');
  navLinks.forEach(link => {
    const linkFilename = link.getAttribute('href');
    if (linkFilename === currentFilename) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
