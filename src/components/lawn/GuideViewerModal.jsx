import React, { useState } from 'react';
import { useRegisterBackHandler } from '../../hooks/useMobileBackNavigation';

/**
 * Build an inline-viewer URL for a guide hosted on this origin.
 * - PDF  → Google Docs Viewer (renders inline)
 * - DOCX → Microsoft Office Online Viewer (renders inline)
 * @param {string} fileUrl Absolute URL of the hosted file
 * @param {'pdf' | 'docx'} kind
 */
function buildViewerUrl(fileUrl, kind) {
  const encoded = encodeURIComponent(fileUrl);
  if (kind === 'pdf') {
    return `https://docs.google.com/viewer?url=${encoded}&embedded=true`;
  }
  return `https://view.officeapps.live.com/op/view.aspx?src=${encoded}`;
}

/**
 * @param {{
 *   guide: { file: string, kind: 'pdf' | 'docx', title: string } | null,
 *   onClose: () => void,
 * }} props
 */
export default function GuideViewerModal({ guide, onClose }) {
  const [loading, setLoading] = useState(true);

  useRegisterBackHandler(() => {
    if (guide) {
      onClose();
      return true;
    }
    return false;
  }, Boolean(guide));

  if (!guide) return null;

  const fileUrl = new URL(guide.file, window.location.origin).href;
  const viewerUrl = buildViewerUrl(fileUrl, guide.kind);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={guide.title}>
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <p className="text-sm font-bold text-gray-900 truncate flex-1">{guide.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-base shrink-0"
          aria-label="Close guide"
        >
          ✕
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 top-14 flex flex-col items-center justify-center gap-3 bg-gray-50 z-10 pointer-events-none">
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Loading guide…</p>
        </div>
      )}

      {/* Viewer iframe */}
      <iframe
        src={viewerUrl}
        title={guide.title}
        className="flex-1 w-full border-0"
        onLoad={() => setLoading(false)}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}
