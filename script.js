document.addEventListener('DOMContentLoaded', () => {
  // 加载部分页面
  const includeTargets = document.querySelectorAll('[data-include]');
  includeTargets.forEach(async (el) => {
    const url = el.getAttribute('data-include');
    if (!url) return;
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.statusText);
      const html = await res.text();
      el.outerHTML = html;
      
      // 加载完成后执行页面高亮
      highlightCurrentPage();
    } catch (e) {
      console.error('Include failed:', url, e);
    }
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
