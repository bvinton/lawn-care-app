/**
 * @typedef {'pdf' | 'docx' | 'image'} GuideKind
 */

/**
 * Absolute URL for a guide in /public (works on Vercel, not local-only paths).
 * @param {string} file Path like /The Spring Pack.docx
 */
export function getGuideUrl(file) {
  return new URL(file, window.location.origin).href;
}

/**
 * Open a guide on mobile/PWA — target="_blank" often fails in standalone mode.
 * @param {{ file: string, kind: GuideKind, title?: string }} guide
 */
export function openGuide(guide) {
  const url = getGuideUrl(guide.file);

  if (guide.kind === 'pdf') {
    window.location.assign(url);
    return;
  }

  if (guide.kind === 'docx') {
    const link = document.createElement('a');
    link.href = url;
    link.download = guide.file.split('/').pop() ?? 'guide.docx';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
}
