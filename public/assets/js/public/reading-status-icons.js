/* Small cover indicators share the site's rounded SVG line style. */
const shapes = {
  finished: '<path d="m5 12 4 4L19 6"/>',
  unread: '<path d="M6 3h13v18H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M3 17h16M7 3v14"/>',
  progress: '<path d="M12 7c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V6c-3-1-6-1-9 1Z"/><path d="M12 7v14"/>',
  'up-next': '<path d="m15 3 6 6-6 6M21 9H7a4 4 0 0 0-4 4v8"/>',
  pinned: '<path fill="currentColor" d="m16 3 5 5-4 1-4 4 1 4-2 2-7-7 2-2 4 1 4-4 1-4Z"/><path d="m8.5 15.5-5.5 5.5"/>'
};

export function readingStatusIcon(kind) {
  if (!Object.hasOwn(shapes, kind)) return "";
  return `<svg class="reading-status-icon" data-status-icon="${kind}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[kind]}</svg>`;
}
