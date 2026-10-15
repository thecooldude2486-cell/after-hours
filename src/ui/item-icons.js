const drawings = {
  calm: '<rect x="4" y="7" width="16" height="15" rx="2"/><path d="M9 7V4h6v3m-3 5v6m-3-3h6"/>',
  flashlight:
    '<path d="m9 7 4-3 7 7-3 4-3-2-7 7-3-3 7-7z"/><path d="m13 4 7 7M7 17l3 3"/>',
  battery:
    '<rect x="7" y="5" width="10" height="17" rx="2"/><path d="M10 5V2h4v3M9 10h6m-3-3v6m-3 5h6"/>',
  key: '<circle cx="8" cy="8" r="5"/><path d="m11.5 11.5 9 9m-3-3 3-3m-6 0 3-3"/>',
  fuse: '<path d="M8 7h8v12H8zM9 3h6v4M9 19h6v4m-3-14v8"/>',
  tool: '<path d="m5 22 7-10 7 10M5 22l-2-2 7-10-5-6 3-2 4 6 4-6 3 2-5 6 7 10-2 2"/>',
};
export function itemIcon(type) {
  return `<svg viewBox="0 0 24 26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${drawings[type] || drawings.key}</svg>`;
}
