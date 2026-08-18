// Hand-authored inline SVG paths, never emoji (design.md §identity). Each value is the
// inner markup of a 24×24 currentColor icon; ported verbatim from mockup-dashboard-v3.html.
export const ICONS: Record<string, string> = {
  zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  triangle: '<path d="M12 3l9 17H3z"/><path d="M12 10v5"/>',
  flame: '<path d="M12 3c3 3.5 5 6 5 9a5 5 0 0 1-10 0c0-1.7.8-3 2-4 .3 1.6 1.2 2.2 2 2.2-1-2.4-.5-5 1-7.2z"/>',
  wave: '<path d="M2 9c2.5-2.6 4.5-2.6 6 0s3.5 2.6 6 0 4.5-2.6 6 0"/><path d="M2 15c2.5-2.6 4.5-2.6 6 0s3.5 2.6 6 0 4.5-2.6 6 0"/>',
  rocket:
    '<path d="M12 3c3 1.8 4.5 5 4.5 8.5L15 16H9l-1.5-4.5C7.5 8 9 4.8 12 3z"/><path d="M9 16l-2.5 3M15 16l2.5 3"/><circle cx="12" cy="9.5" r="1.6"/>',
  satellite:
    '<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 9 5.5 5.5M15 15l3.5 3.5"/><path d="M4 8l4 4M16 12l4 4"/><path d="M15 6a3 3 0 0 1 3 3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  briefcase: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12"/>',
  book: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M18 16H7a2 2 0 0 0-2 2"/>',
  flask: '<path d="M9 3h6M10 3v6l-4.5 8a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3"/><path d="M7.5 15h9"/>',
  dumbbell: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  trophy:
    '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M12 13v4M9 20h6M10 17h4"/>',
  grad: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10.5V15c0 1.1 2.2 2.5 5 2.5s5-1.4 5-2.5v-4.5"/><path d="M21 8v5"/>',
}
