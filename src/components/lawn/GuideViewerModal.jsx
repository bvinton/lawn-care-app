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
    <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
      <div
        className="mx-auto w-full max-w-md md:max-w-lg"
        style={{
          fontFamily: 'system-ui, sans-serif',
          lineHeight: '1.65',
          fontSize: '0.875rem',
          color: '#1a1a1a',
        }}
        /* eslint-disable-next-line react/no-danger */
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/**
 * Render a PDF in-app with pdf.js (lazy-loaded), one scrollable page stack.
 * @param {{ fileUrl: string, title: string }} props
 */
function PdfViewer({ fileUrl, title }) {
  const [pageImages, setPageImages] = useState(/** @type {string[]} */ ([]));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    setPageImages([]);

    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).href;

        const pdf = await pdfjs.getDocument(fileUrl).promise;
        const targetWidth = Math.min(window.innerWidth - 32, 720);
        const images = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = targetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas not supported');

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport, canvas }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.88));
        }

        if (!cancelled) setPageImages(images);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState title={title} message={error} />;

  return (
    <div className="flex-1 overflow-y-auto px-2 py-4 space-y-3 bg-gray-50 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-md space-y-3 md:max-w-lg">
        {pageImages.map((src, index) => (
          <img
            key={`${title}-page-${index + 1}`}
            src={src}
            alt={`${title} — page ${index + 1}`}
            className="w-full rounded-lg shadow-sm bg-white"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Scrollable image gallery (clean masterclass content extracted from Gmail PDFs).
 * Phone-sized slides stay full-bleed on mobile; on desktop they sit in a
 * centred reading column so they don't stretch across a wide monitor.
 * @param {{ images: string[], title: string }} props
 */
function GalleryViewer({ images, title }) {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-4 space-y-3 bg-gray-50 md:px-6 md:py-6">
      <div className="mx-auto w-full max-w-md space-y-3 md:max-w-lg">
        {images.map((src, index) => (
          <img
            key={src}
            src={src}
            alt={`${title} — section ${index + 1}`}
            className="w-full rounded-lg shadow-sm bg-white"
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 flex-1">
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
 *   guide: {
 *     file?: string,
 *     kind: 'pdf' | 'docx' | 'gallery',
 *     title: string,
 *     images?: string[],
 *   } | null,
 *   onClose: () => void,
 * }} props
 */
export default function GuideViewerModal({ guide, onClose }) {
  useRegisterBackHandler(() => {
    if (guide) { onClose(); return true; }
    return false;
  }, Boolean(guide));

  if (!guide) return null;

  const fileUrl = guide.file
    ? new URL(guide.file, window.location.origin).href
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-white md:items-center md:bg-black/45 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={guide.title}
    >
      {/* Click outside closes on desktop; mobile stays full-screen edge-to-edge. */}
      <button
        type="button"
        className="absolute inset-0 hidden md:block"
        aria-label="Close guide"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white md:h-[min(92vh,960px)] md:max-w-xl md:rounded-2xl md:shadow-2xl">
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

        <div className="flex flex-col flex-1 overflow-hidden relative">
          {guide.kind === 'docx' && fileUrl && (
            <DocxViewer fileUrl={fileUrl} title={guide.title} />
          )}
          {guide.kind === 'pdf' && fileUrl && (
            <PdfViewer fileUrl={fileUrl} title={guide.title} />
          )}
          {guide.kind === 'gallery' && guide.images && (
            <GalleryViewer images={guide.images} title={guide.title} />
          )}
        </div>
      </div>
    </div>
  );
}
