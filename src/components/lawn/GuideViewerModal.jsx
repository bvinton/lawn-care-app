import React, { useEffect, useState } from 'react';
import { useRegisterBackHandler } from '../../hooks/useMobileBackNavigation';

/**
 * Render a DOCX file as formatted HTML using mammoth (lazy-loaded).
 * @param {{ fileUrl: string, title: string }} props
 */
function DocxViewer({ fileUrl, title }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    setHtml('');

    let cancelled = false;

    Promise.all([
      import('mammoth'),
      fetch(fileUrl).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      }),
    ])
      .then(([mammoth, buf]) => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then((result) => { if (!cancelled) setHtml(result.value); })
      .catch((err) => { if (!cancelled) setError(err.message ?? 'Could not load guide.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [fileUrl]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState title={title} message={error} />;

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-5"
      style={{
        fontFamily: 'system-ui, sans-serif',
        lineHeight: '1.65',
        fontSize: '0.875rem',
        color: '#1a1a1a',
      }}
      /* eslint-disable-next-line react/no-danger */
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Render a PDF via Google Docs Viewer in an iframe.
 * @param {{ fileUrl: string, title: string }} props
 */
function PdfViewer({ fileUrl, title }) {
  const [loading, setLoading] = useState(true);
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10 pointer-events-none">
          <LoadingSpinner />
        </div>
      )}
      <iframe
        src={viewerUrl}
        title={title}
        className="flex-1 w-full border-0"
        onLoad={() => setLoading(false)}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8">
      <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin" />
      <p className="text-xs text-gray-500 font-medium">Loading guide…</p>
    </div>
  );
}

/** @param {{ title: string, message: string }} props */
function ErrorState({ title, message }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-2 px-6 py-8 text-center">
      <p className="text-2xl">⚠️</p>
      <p className="text-sm font-bold text-gray-800">Could not load {title}</p>
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  );
}

/**
 * @param {{
 *   guide: { file: string, kind: 'pdf' | 'docx', title: string } | null,
 *   onClose: () => void,
 * }} props
 */
export default function GuideViewerModal({ guide, onClose }) {
  useRegisterBackHandler(() => {
    if (guide) { onClose(); return true; }
    return false;
  }, Boolean(guide));

  if (!guide) return null;

  const fileUrl = new URL(guide.file, window.location.origin).href;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={guide.title}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <p className="text-sm font-bold text-gray-900 truncate flex-1">{guide.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold shrink-0"
          aria-label="Close guide"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {guide.kind === 'docx' ? (
          <DocxViewer fileUrl={fileUrl} title={guide.title} />
        ) : (
          <PdfViewer fileUrl={fileUrl} title={guide.title} />
        )}
      </div>
    </div>
  );
}
