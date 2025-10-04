console.log('--- markers start ---');
const root = document.documentElement;
console.log('root styles', getComputedStyle(root).overflow, getComputedStyle(root).clipPath);
const body = document.body;
console.log('body styles', getComputedStyle(body).overflow, getComputedStyle(body).clipPath);
const videos = document.querySelectorAll('video');
console.log('video count', videos.length);
videos.forEach((video, index) => {
  const style = getComputedStyle(video);
  console.log('video', index, 'position', style.position, 'mixBlendMode', style.mixBlendMode, 'zIndex', style.zIndex, 'filter', style.filter, 'clipPath', style.clipPath);
});
const fixed = document.querySelectorAll('[data-debug-fixed]');
console.log('fixed debug nodes', fixed.length);
fixed.forEach((node, index) => {
  const rect = node.getBoundingClientRect();
  console.log('fixed rect', index, rect.top, rect.bottom, rect.left, rect.right);
});
console.log('--- markers end ---');
