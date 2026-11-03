import { useEffect, useRef, useState } from "react";
import type { PDFPageProxy, PageViewport } from "pdfjs-dist";
import { PanelHead } from "./PanelChrome.tsx";
import { prefersReducedMotion, revealIn } from "./reveal.ts";

// The thumbnail strip beside the viewer: one small rendering per page, the shown page marked,
// a click scrolling to that page. Thumbnails are drawn when they scroll into view and rotate
// with the pages, by the same CSS turn the page frames use.

const THUMB_WIDTH = 128;

function Thumb({
  page,
  viewport,
  rotation,
  index,
  current,
  root,
  onGo,
}: {
  page: PDFPageProxy;
  viewport: PageViewport;
  rotation: number;
  index: number;
  current: boolean;
  root: React.RefObject<HTMLDivElement | null>;
  onGo: (index: number) => void;
}) {
  const itemRef = useRef<HTMLLIElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [drawn, setDrawn] = useState(false);

  // Only thumbnails near the visible part of the strip are rendered.
  useEffect(() => {
    const item = itemRef.current;
    if (!item) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { root: root.current, rootMargin: "320px 0px" },
    );
    observer.observe(item);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const scaled = page.getViewport({ scale: (THUMB_WIDTH * pixelRatio) / viewport.width });
    canvas.width = Math.max(1, Math.ceil(scaled.width));
    canvas.height = Math.max(1, Math.ceil(scaled.height));
    const task = page.render({ canvas, viewport: scaled });
    let cancelled = false;
    task.promise.then(
      () => {
        if (!cancelled) setDrawn(true);
      },
      () => {
        // A thumbnail that could not be drawn stays blank.
      },
    );
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [visible, page, viewport]);

  useEffect(() => {
    const item = itemRef.current;
    const scroller = root.current;
    if (!current || !item || !scroller) return;
    revealIn(scroller, item, "nearest", !prefersReducedMotion());
  }, [current, root]);

  const sideways = rotation % 180 !== 0;
  const shownWidth = sideways ? viewport.height : viewport.width;
  const shownHeight = sideways ? viewport.width : viewport.height;
  const boxHeight = (THUMB_WIDTH * shownHeight) / shownWidth;
  const canvasWidth = (THUMB_WIDTH * viewport.width) / shownWidth;
  const canvasHeight = (THUMB_WIDTH * viewport.height) / shownWidth;

  return (
    <li ref={itemRef} className={current ? "thumb current" : "thumb"}>
      <button
        type="button"
        className="thumb-button"
        aria-label={`Page ${index + 1}`}
        aria-current={current ? "page" : undefined}
        onClick={() => onGo(index)}
      >
        <span className={drawn ? "thumb-paper drawn" : "thumb-paper"} style={{ width: THUMB_WIDTH, height: boxHeight }}>
          <canvas
            ref={canvasRef}
            style={{
              width: canvasWidth,
              height: canvasHeight,
              left: (THUMB_WIDTH - canvasWidth) / 2,
              top: (boxHeight - canvasHeight) / 2,
              transform: `rotate(${rotation}deg)`,
            }}
          />
        </span>
        <span className="thumb-number">{index + 1}</span>
      </button>
    </li>
  );
}

export function PagesPanel({
  pages,
  viewports,
  rotation,
  current,
  onGo,
}: {
  pages: PDFPageProxy[];
  viewports: PageViewport[];
  rotation: number;
  current: number;
  onGo: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <aside className="pages-panel" aria-label="Pages">
      <PanelHead title="Pages" count={pages.length} />
      <div className="pages-panel-scroll" ref={scrollRef}>
        <ol className="thumb-list">
          {pages.map((page, index) => (
            <Thumb
              key={index}
              page={page}
              viewport={viewports[index] ?? page.getViewport({ scale: 1 })}
              rotation={rotation}
              index={index}
              current={index === current}
              root={scrollRef}
              onGo={onGo}
            />
          ))}
        </ol>
      </div>
    </aside>
  );
}
