import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, ReactNode } from "react";
import { scanType3Fonts, type ContentElement } from "./content.ts";
import { exportAnnotatedPdf } from "./exportPdf.ts";
import { clamp } from "./geometry.ts";
import { useHistory } from "./history.ts";
import { Inspector } from "./Inspector.tsx";
import { PageStage } from "./PageStage.tsx";
import { loadPdf, type LoadedPdf } from "./pdf.ts";
import { navigate, plainClick } from "./router.ts";
import { createSession, listSessions, persistAnnotations, readSession, readySessions, type SessionInfo } from "./session.ts";
import type { Brush } from "./brushes.ts";
import { isBoxShape, isLinearShape, isOpenShape, SHAPE_LABEL, shapeFromLine, type ShapeId } from "./shapes.ts";
import { measureTextWidth } from "./textMeasure.ts";
import { ChevronDown, Download, Minus, Plus, Redo2, RotateCw, Undo2, UnfoldHorizontal, UnfoldVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeSelect } from "./ThemeSelect.tsx";
import { LogoMark } from "./site/Logo.tsx";
import { PRODUCT, routeHref, ROUTES } from "./data/product.ts";
import { ToolDock } from "./ToolDock.tsx";
import { ToolRail } from "./ToolRail.tsx";
import {
  isStrokeAnnotation,
  type Align,
  type Annotation,
  type FontId,
  type LineCap,
  type StrokeStyle,
  type TextAnnotation,
  type EmojiAnnotation,
  type SignatureAnnotation,
  type TextStyle,
  type Tool,
  uid,
} from "./types.ts";
import "./App.css";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const DEFAULT_STROKE: StrokeStyle = {
  color: "#1d4ed8",
  strokeWidth: 2,
  fill: null,
  fillOpacity: 1,
  opacity: 1,
  cap: "round",
  dash: null,
  brush: "pen",
};

function paintAnnotation(item: Annotation, partial: Partial<StrokeStyle>): Annotation {
  if (item.kind === "ink") {
    return {
      ...item,
      color: partial.color ?? item.color,
      strokeWidth: partial.strokeWidth ?? item.strokeWidth,
      opacity: partial.opacity ?? item.opacity,
      cap: partial.cap ?? item.cap,
      dash: partial.dash === undefined ? item.dash : partial.dash,
      brush: partial.brush ?? item.brush,
    };
  }
  if (item.kind === "line") {
    return {
      ...item,
      color: partial.color ?? item.color,
      strokeWidth: partial.strokeWidth ?? item.strokeWidth,
    };
  }
  if (isBoxShape(item)) {
    return {
      ...item,
      color: partial.color ?? item.color,
      strokeWidth: partial.strokeWidth ?? item.strokeWidth,
      fill: partial.fill === undefined ? item.fill : partial.fill,
      fillOpacity: partial.fillOpacity ?? item.fillOpacity ?? 1,
    };
  }
  return item;
}
const DEFAULT_TEXT: TextStyle = {
  fontId: "helvetica",
  fontSize: 18,
  color: "#111111",
  bold: false,
  italic: false,
  underline: false,
  align: "left",
  width: 220,
  autoWidth: true,
  height: null,
};

function mergeText(item: TextAnnotation, partial: Partial<TextStyle>): TextAnnotation {
  const next = { ...item, ...partial };
  if (partial.width !== undefined) next.autoWidth = false;
  if (
    next.autoWidth &&
    (partial.autoWidth ||
      partial.fontId !== undefined ||
      partial.fontSize !== undefined ||
      partial.bold !== undefined ||
      partial.italic !== undefined)
  ) {
    next.width = measureTextWidth(next);
  }
  return next;
}

function zoomLabel(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

type PageReadout = {
  index: number;
  tipTop: number;
  tipRight: number;
  canScroll: boolean;
};

function readPageScroll(node: HTMLElement): PageReadout {
  const wraps = node.querySelectorAll<HTMLElement>(".page-wrap");
  const view = node.getBoundingClientRect();
  const mid = view.top + view.height / 2;
  let index = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < wraps.length; i += 1) {
    const rect = wraps[i].getBoundingClientRect();
    if (rect.top <= mid && rect.bottom >= mid) {
      index = i;
      break;
    }
    const distance = Math.abs(rect.top + rect.height / 2 - mid);
    if (distance < best) {
      best = distance;
      index = i;
    }
  }
  const maxScroll = node.scrollHeight - node.clientHeight;
  const ratio = maxScroll <= 0 ? 0 : node.scrollTop / maxScroll;
  const thumbHeight = Math.max(
    28,
    (node.clientHeight / Math.max(node.scrollHeight, 1)) * node.clientHeight,
  );
  const travel = Math.max(0, node.clientHeight - thumbHeight);
  const measured = node.offsetWidth - node.clientWidth;
  const bar = measured > 0 ? measured : 14;
  return {
    index,
    tipTop: ratio * travel + thumbHeight / 2,
    tipRight: bar + 10,
    canScroll: maxScroll > 1,
  };
}

function IconTip({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-disabled={disabled}
          className={disabled ? "opacity-50" : undefined}
          onClick={() => {
            if (!disabled) onClick();
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ArrangeButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

type PageRotation = 0 | 90 | 180 | 270;

function isPageRotation(value: unknown): value is PageRotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

const TOOLS = ["select", "pencil", "shape", "emoji", "signature", "text", "eraser"] as const;

function isTool(value: unknown): value is Tool {
  return typeof value === "string" && (TOOLS as readonly string[]).includes(value);
}

function isShapeId(value: unknown): value is ShapeId {
  return typeof value === "string" && value in SHAPE_LABEL;
}

function chromeKey(sessionId: string): string {
  return `pdf-editor:chrome:${sessionId}`;
}

const ZOOM_KEY = "pdf-editor:zoom";

function readZoom(): number {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    const value = raw == null ? 1 : Number(raw);
    if (!Number.isFinite(value)) return 1;
    return clamp(value, MIN_ZOOM, MAX_ZOOM);
  } catch {
    return 1;
  }
}

function readChrome(sessionId: string): { tool: Tool; shape: ShapeId; rotation: PageRotation } {
  const fallback = { tool: "select" as const, shape: "rect" as const, rotation: 0 as const };
  try {
    const raw = sessionStorage.getItem(chromeKey(sessionId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { tool?: unknown; shape?: unknown; rotation?: unknown };
    return {
      tool: isTool(parsed.tool) ? parsed.tool : "select",
      shape: isShapeId(parsed.shape) ? parsed.shape : "rect",
      rotation: isPageRotation(parsed.rotation) ? parsed.rotation : 0,
    };
  } catch {
    return fallback;
  }
}

export function Editor({ sessionId }: { sessionId: string }) {
  const history = useHistory<Annotation[]>([]);
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>(() => listSessions());
  const [tool, setTool] = useState<Tool>(() => readChrome(sessionId).tool);
  const [shape, setShape] = useState<ShapeId>(() => readChrome(sessionId).shape);
  const [dockKind, setDockKind] = useState<"pencil" | "shape" | "emoji" | "signature">(() => {
    const restored = readChrome(sessionId).tool;
    if (restored === "pencil" || restored === "shape" || restored === "emoji" || restored === "signature") return restored;
    return "shape";
  });
  const [dockOpen, setDockOpen] = useState(() => {
    const initial = readChrome(sessionId).tool;
    return initial === "pencil" || initial === "shape" || initial === "emoji" || initial === "signature";
  });
  const [pageRotation, setPageRotation] = useState<PageRotation>(() => readChrome(sessionId).rotation);
  const [spin, setSpin] = useState<number>(() => readChrome(sessionId).rotation);
  const [viewReady, setViewReady] = useState(false);
  const [scale, setScale] = useState(readZoom);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>(DEFAULT_STROKE);
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contentSelection, setContentSelection] = useState<ContentElement | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [missing, setMissing] = useState(false);
  const [readout, setReadout] = useState<PageReadout>({
    index: 0,
    tipTop: 24,
    tipRight: 24,
    canScroll: false,
  });
  const [scrollTip, setScrollTip] = useState(false);
  const [barHover, setBarHover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const scrollTipTimer = useRef(0);
  const loadedRef = useRef<LoadedPdf | null>(null);
  const loadId = useRef(0);
  const styleBaseline = useRef<Annotation[] | null>(null);
  const epochRef = useRef(0);
  const selectedRef = useRef<string | null>(null);
  const downloadRef = useRef<() => void>(() => undefined);
  const hydrated = useRef(false);
  const scaleRef = useRef(scale);
  const pinchOrigin = useRef(1);
  const toolRef = useRef(tool);
  scaleRef.current = scale;
  toolRef.current = tool;

  selectedRef.current = selectedId;

  const syncPageReadout = useCallback(() => {
    const node = pagesRef.current;
    if (!node) return;
    const next = readPageScroll(node);
    setReadout((current) =>
      current.index === next.index &&
      current.canScroll === next.canScroll &&
      current.tipRight === next.tipRight &&
      Math.abs(current.tipTop - next.tipTop) < 0.5
        ? current
        : next,
    );
  }, []);

  const revealScrollTip = useCallback(() => {
    syncPageReadout();
    setScrollTip(true);
    window.clearTimeout(scrollTipTimer.current);
    scrollTipTimer.current = window.setTimeout(() => setScrollTip(false), 800);
  }, [syncPageReadout]);

  useEffect(() => {
    syncPageReadout();
    const node = pagesRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => syncPageReadout());
    observer.observe(node);
    return () => observer.disconnect();
  }, [loaded, scale, pageRotation, syncPageReadout]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const node = pagesRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const measured = node.offsetWidth - node.clientWidth;
      const bar = measured > 0 ? measured : 14;
      const over =
        event.clientX >= rect.right - bar &&
        event.clientX <= rect.right + 1 &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      setBarHover((current) => (current === over ? current : over));
      if (over) syncPageReadout();
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [syncPageReadout]);

  useEffect(() => () => window.clearTimeout(scrollTipTimer.current), []);

  useEffect(() => {
    if (!loaded) return;
    const frame = requestAnimationFrame(() => setViewReady(true));
    return () => cancelAnimationFrame(frame);
  }, [loaded]);

  useEffect(() => {
    const refresh = () => setSessions(listSessions());
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [sessionId, loaded?.name]);

  const bump = useCallback(() => {
    epochRef.current += 1;
  }, []);

  const getAnnotations = useCallback(() => history.valueRef.current, [history.valueRef]);
  const getEpoch = useCallback(() => epochRef.current, []);
  const consumeFocus = useCallback(() => setFocusId(null), []);
  const requestFocus = useCallback((id: string) => setFocusId(id), []);

  const chooseTool = useCallback((next: Tool) => {
    if (next === "pencil" || next === "shape" || next === "emoji" || next === "signature") {
      if (toolRef.current === next) {
        setDockOpen((open) => !open);
        return;
      }
      setDockKind(next);
      setTool(next);
      setDockOpen(true);
      return;
    }
    setTool(next);
    setDockOpen(false);
  }, []);

  const remember = useCallback(
    (baseline: Annotation[]) => {
      if (history.pushBaseline(baseline)) bump();
    },
    [history.pushBaseline, bump],
  );

  const save = useCallback(
    (next: Annotation[]) => {
      if (history.commit(next)) bump();
    },
    [history.commit, bump],
  );

  useEffect(() => {
    document.title = loaded ? `${loaded.name} — ${PRODUCT.name}` : PRODUCT.name;
  }, [loaded]);

  useEffect(() => {
    try {
      sessionStorage.setItem(chromeKey(sessionId), JSON.stringify({ tool, shape, rotation: pageRotation }));
      localStorage.setItem(ZOOM_KEY, String(scale));
    } catch {
      // Storage can be blocked in private browsing.
    }
  }, [sessionId, tool, shape, pageRotation, scale]);

  useEffect(() => {
    let cancelled = false;
    const id = ++loadId.current;
    void (async () => {
      try {
        await readySessions();
        const session = await readSession(sessionId);
        if (cancelled || loadId.current !== id) return;
        if (!session) {
          setMissing(true);
          hydrated.current = true;
          return;
        }
        const next = await loadPdf(session.bytes, session.name);
        if (cancelled || loadId.current !== id) {
          await next.doc.cleanup();
          return;
        }
        history.reset(session.annotations);
        setContentSelection(null);
        loadedRef.current = next;
        hydrated.current = true;
        // Pages printed from a browser draw their text with Type3 fonts, one per run; pooling
        // the whole document's glyphs lets the faces rebuilt for the open pages cover the
        // letters the other pages drew. The scan starts before the first page is read, which
        // waits a moment for it.
        void scanType3Fonts(next.bytes, next.doc.loadingTask.docId);
        setLoaded(next);
      } catch (cause) {
        if (!cancelled && loadId.current === id) {
          setError(cause instanceof Error ? cause.message : "Could not open this document");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [history.reset, sessionId]);

  useEffect(() => {
    if (!hydrated.current || !loaded || missing) return;
    const timer = window.setTimeout(() => persistAnnotations(sessionId, history.value), 80);
    const flush = () => persistAnnotations(sessionId, history.valueRef.current);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [loaded, missing, history.value, history.valueRef, sessionId]);

  useEffect(() => {
    let gestureAt = 0;
    const insideApp = (event: Event) => {
      const root = document.querySelector(".app");
      return event.target instanceof Node && !!root?.contains(event.target);
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (!insideApp(event)) return;
      event.preventDefault();
      if (performance.now() - gestureAt < 80) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = event.deltaY * unit;
      setScale((value) => clamp(value * Math.exp(-delta * 0.0025), MIN_ZOOM, MAX_ZOOM));
    };
    const onGestureStart = (event: Event) => {
      if (!insideApp(event)) return;
      event.preventDefault();
      gestureAt = performance.now();
      pinchOrigin.current = scaleRef.current;
    };
    const onGestureChange = (event: Event) => {
      if (!insideApp(event)) return;
      event.preventDefault();
      gestureAt = performance.now();
      const factor = (event as Event & { scale?: number }).scale ?? 1;
      setScale(clamp(pinchOrigin.current * factor, MIN_ZOOM, MAX_ZOOM));
    };
    const onGestureEnd = () => {
      gestureAt = performance.now();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("gesturestart", onGestureStart, { passive: false });
    window.addEventListener("gesturechange", onGestureChange, { passive: false });
    window.addEventListener("gestureend", onGestureEnd);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("gesturestart", onGestureStart);
      window.removeEventListener("gesturechange", onGestureChange);
      window.removeEventListener("gestureend", onGestureEnd);
    };
  }, []);

  useEffect(() => {
    if (selectedId && !history.value.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [history.value, selectedId]);

  const openFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfs.length === 0) {
      setError("Choose a PDF file.");
      return;
    }
    setError(null);
    let firstId = "";
    try {
      for (const file of pdfs) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const parsed = await loadPdf(bytes, file.name);
        await parsed.doc.cleanup();
        const id = await createSession(file.name, bytes, []);
        if (!firstId) firstId = id;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not open this PDF";
      setError(
        message.toLowerCase().includes("password")
          ? "This PDF is password protected."
          : "Could not open this PDF.",
      );
    }
    if (firstId) navigate(`/edit/${firstId}`);
  }, []);

  const download = useCallback(async () => {
    const current = loadedRef.current;
    if (!current || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const bytes = await exportAnnotatedPdf(
        current.bytes,
        history.valueRef.current,
        (page, x, y) => {
          const viewport = current.viewports[page];
          if (!viewport) return { x, y };
          const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y) as number[];
          return { x: pdfX ?? x, y: pdfY ?? y };
        },
        pageRotation,
        current.pages,
      );
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = current.name.replace(/\.pdf$/i, "") + "-annotated.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export the PDF");
    } finally {
      setExporting(false);
    }
  }, [exporting, history.valueRef, pageRotation]);

  downloadRef.current = () => {
    void download();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        bump();
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        downloadRef.current();
        return;
      }
      if (meta && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        setScale((value) => clamp(value + 0.25, MIN_ZOOM, MAX_ZOOM));
        return;
      }
      if (meta && event.key === "-") {
        event.preventDefault();
        setScale((value) => clamp(value - 0.25, MIN_ZOOM, MAX_ZOOM));
        return;
      }
      if (typing || meta || event.altKey) return;
      const key = event.key.toLowerCase();
      const shapeShortcuts: Record<string, ShapeId> = {
        l: "line",
        r: "rect",
        o: "ellipse",
      };
      const pickedShape = shapeShortcuts[key];
      if (key === "s") {
        chooseTool("shape");
        return;
      }
      if (pickedShape) {
        setShape(pickedShape);
        setDockKind("shape");
        setTool("shape");
        setDockOpen(true);
        return;
      }
      const shortcuts: Record<string, Tool> = {
        v: "select",
        p: "pencil",
        m: "emoji",
        g: "signature",
        t: "text",
        e: "eraser",
      };
      const nextTool = shortcuts[key];
      if (nextTool) {
        chooseTool(nextTool);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedRef.current) {
        event.preventDefault();
        const id = selectedRef.current;
        const removed = history.valueRef.current.find((item) => item.id === id);
        save(history.valueRef.current.filter((item) => item.id !== id));
        setSelectedId(null);
        if (removed?.kind === "patch") setContentSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history.redo, history.undo, history.valueRef, bump, save, chooseTool]);

  const placeEmoji = (emojiId: string) => {
    const document = loadedRef.current;
    if (!document || document.pages.length === 0) return;
    const page = Math.min(readout.index, document.pages.length - 1);
    const viewport = document.viewports[page];
    if (!viewport) return;
    const size = 72;
    const placed = history.valueRef.current.filter((item) => item.kind === "emoji" && item.page === page).length;
    const nudge = (placed % 8) * 16;
    const annotation: EmojiAnnotation = {
      id: uid(),
      page,
      kind: "emoji",
      emoji: emojiId,
      x: Math.max(8, viewport.width / 2 - size / 2 + nudge),
      y: Math.max(8, viewport.height / 2 - size / 2 + nudge),
      w: size,
      h: size,
      rotation: 0,
    };
    save([...history.valueRef.current, annotation]);
    setSelectedId(annotation.id);
  };

  const placeSignature = (src: string, pixelWidth: number, pixelHeight: number) => {
    const document = loadedRef.current;
    if (!document || document.pages.length === 0) return;
    const page = Math.min(readout.index, document.pages.length - 1);
    const viewport = document.viewports[page];
    if (!viewport) return;
    const aspect = pixelWidth / Math.max(1, pixelHeight);
    let height = 56;
    let width = Math.max(48, height * aspect);
    const maxWidth = Math.max(48, viewport.width - 24);
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspect;
    }
    const placed = history.valueRef.current.filter((item) => item.kind === "signature" && item.page === page).length;
    const nudge = (placed % 8) * 16;
    const annotation: SignatureAnnotation = {
      id: uid(),
      page,
      kind: "signature",
      src,
      x: Math.max(8, viewport.width / 2 - width / 2 + nudge),
      y: Math.max(8, viewport.height / 2 - height / 2 + nudge),
      w: width,
      h: height,
      rotation: 0,
    };
    save([...history.valueRef.current, annotation]);
    setSelectedId(annotation.id);
  };

  const fitZoom = (mode: "page" | "width" | "height") => {
    const node = pagesRef.current;
    const viewport = loadedRef.current?.viewports[0];
    if (!node || !viewport || viewport.width === 0 || viewport.height === 0) return;
    const sideways = pageRotation === 90 || pageRotation === 270;
    const pageWidth = sideways ? viewport.height : viewport.width;
    const pageHeight = sideways ? viewport.width : viewport.height;
    const widthScale = (node.clientWidth - 48) / pageWidth;
    const heightScale = (node.clientHeight - 88) / pageHeight;
    const next =
      mode === "width" ? widthScale : mode === "height" ? heightScale : Math.min(widthScale, heightScale);
    setScale(clamp(next, MIN_ZOOM, MAX_ZOOM));
  };

  const matchedPreset = ZOOM_PRESETS.find((preset) => Math.abs(preset - scale) < 0.008);

  const selected = history.value.find((item) => item.id === selectedId) ?? null;
  const selectedShape =
    selected?.kind === "line"
      ? shapeFromLine(selected.head)
      : selected && isBoxShape(selected)
        ? selected.kind
        : null;
  const stroke: StrokeStyle =
    selected && isStrokeAnnotation(selected)
      ? {
          color: selected.color,
          strokeWidth: selected.strokeWidth,
          fill: isBoxShape(selected) ? (selected.fill ?? null) : strokeStyle.fill,
          fillOpacity: isBoxShape(selected) ? (selected.fillOpacity ?? 1) : strokeStyle.fillOpacity,
          opacity: selected.kind === "ink" ? (selected.opacity ?? 1) : strokeStyle.opacity,
          cap: selected.kind === "ink" ? (selected.cap ?? "round") : strokeStyle.cap,
          dash: selected.kind === "ink" ? (selected.dash ?? null) : strokeStyle.dash,
          brush: selected.kind === "ink" ? (selected.brush ?? "pen") : strokeStyle.brush,
        }
      : strokeStyle;
  const showFill = selected
    ? isBoxShape(selected) && !isOpenShape(selected.kind)
    : tool === "shape" && !isLinearShape(shape) && !isOpenShape(shape);
  const showInk = selected ? selected.kind === "ink" : tool === "pencil";
  const text: TextStyle =
    selected?.kind === "text"
      ? {
          fontId: selected.fontId,
          fontSize: selected.fontSize,
          color: selected.color,
          bold: selected.bold,
          italic: selected.italic,
          underline: selected.underline,
          align: selected.align,
          width: selected.width,
          autoWidth: selected.autoWidth,
          height: selected.height,
        }
      : textStyle;

  const beginAdjust = () => {
    if (!styleBaseline.current) styleBaseline.current = history.valueRef.current;
  };

  const endAdjust = () => {
    const baseline = styleBaseline.current;
    if (!baseline) return;
    styleBaseline.current = null;
    remember(baseline);
  };

  const applyStroke = (partial: Partial<StrokeStyle>, live: boolean) => {
    setStrokeStyle((current) => ({ ...current, ...partial }));
    const chosen = history.valueRef.current.find((item) => item.id === selectedRef.current);
    if (!chosen || !isStrokeAnnotation(chosen)) return;
    const base = styleBaseline.current ?? history.valueRef.current;
    const next = base.map((item) => (item.id === chosen.id ? paintAnnotation(item, partial) : item));
    if (live && styleBaseline.current) history.replace(next);
    else save(next);
  };

  const applyText = (partial: Partial<TextStyle>, live: boolean) => {
    setTextStyle((current) => {
      const next = { ...current, ...partial };
      if (partial.width !== undefined) next.autoWidth = false;
      return next;
    });
    const chosen = history.valueRef.current.find((item) => item.id === selectedRef.current);
    if (!chosen || chosen.kind !== "text") return;
    const base = styleBaseline.current ?? history.valueRef.current;
    const next = base.map((item) =>
      item.id === chosen.id && item.kind === "text" ? mergeText(item, partial) : item,
    );
    if (chosen.text.length === 0) {
      history.replace(next);
      return;
    }
    if (live && styleBaseline.current) history.replace(next);
    else save(next);
  };

  const onDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    void openFiles([...event.dataTransfer.files]);
  };

  const pageTotal = loaded?.pages.length ?? 0;
  const pageNumber = pageTotal === 0 ? 1 : Math.min(readout.index, pageTotal - 1) + 1;
  const showScrollTip = readout.canScroll && (scrollTip || barHover);

  if (missing) {
    return (
      <div className="app missing">
        <p>This document is not saved in this browser.</p>
        <a href={routeHref(ROUTES.app)} onClick={(event) => { if (plainClick(event)) { event.preventDefault(); navigate(ROUTES.app); } }}>
          Back to documents
        </a>
      </div>
    );
  }

  return (
    <div
      className="app"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <header className="topbar">
        <div className="brand">
          <a
            className="home-link"
            href={ROUTES.app}
            aria-label="Documents"
            onClick={(event) => {
              if (!plainClick(event)) return;
              event.preventDefault();
              navigate(ROUTES.app);
            }}
          >
            <LogoMark size={26} />
            <strong>{PRODUCT.name}</strong>
          </a>
          <div className="doc-switch">
            <span className="file-name" title={loaded?.name ?? undefined}>
              {loaded?.name ?? "Opening…"}
            </span>
            {sessions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Switch document"
                  >
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuRadioGroup
                    value={sessionId}
                    onValueChange={(id) => navigate(`/edit/${id}`)}
                  >
                    {sessions.map((session) => (
                      <DropdownMenuRadioItem key={session.id} value={session.id}>
                        <span className="truncate">{session.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="top-actions">
          <IconTip
            label="Undo"
            disabled={!history.canUndo}
            onClick={() => {
              history.undo();
              bump();
            }}
          >
            <Undo2 />
          </IconTip>
          <IconTip
            label="Redo"
            disabled={!history.canRedo}
            onClick={() => {
              history.redo();
              bump();
            }}
          >
            <Redo2 />
          </IconTip>
          <ThemeSelect />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            Edit another PDF
          </Button>
          <Button type="button" disabled={!loaded || exporting} onClick={() => void download()}>
            <Download />
            {exporting ? "Saving…" : "Download"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              if (files.length > 0) void openFiles(files);
            }}
          />
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="body">
        <ToolRail tool={tool} shape={shape} panelOpen={dockOpen} onTool={chooseTool} />
        <div className={dockOpen ? "tool-dock-slot open" : "tool-dock-slot"} inert={!dockOpen}>
          <ToolDock
            tool={dockKind}
            shape={shape}
            stroke={stroke}
            onShape={(id) => {
              setShape(id);
              setTool("shape");
              setSelectedId(null);
            }}
            onBrush={(brush: Brush) => {
              setTool("pencil");
              setSelectedId(null);
              setStrokeStyle((current) => ({
                ...current,
                brush: brush.id,
                strokeWidth: brush.width,
                opacity: brush.opacity,
                cap: brush.cap,
                dash: brush.dash,
              }));
            }}
            onStrokeColor={(color) => applyStroke({ color }, styleBaseline.current !== null)}
            onStrokeWidth={(strokeWidth) =>
              applyStroke({ strokeWidth }, styleBaseline.current !== null)
            }
            onOpacity={(opacity) => applyStroke({ opacity }, styleBaseline.current !== null)}
            onCap={(cap: LineCap) => applyStroke({ cap }, false)}
            onDash={(dash) => applyStroke({ dash }, false)}
            onEmoji={placeEmoji}
            onSignature={placeSignature}
            onAdjustStart={beginAdjust}
            onAdjustEnd={endAdjust}
          />
        </div>
        <main className="workspace">
          {loaded ? (
            <div
              className={viewReady ? "pages view-ready" : "pages"}
              key={sessionId}
              ref={pagesRef}
              onScroll={revealScrollTip}
            >
              {loaded.name === "Untitled.pdf" && history.value.length === 0 && (
                <p className="blank-hint">Open a PDF, or draw and type on this blank page.</p>
              )}
              {loaded.pages.map((page, index) => (
                <PageStage
                  key={`${sessionId}-${index}`}
                  page={page}
                  pageIndex={index}
                  scale={scale}
                  baseWidth={loaded.viewports[index]?.width ?? 612}
                  baseHeight={loaded.viewports[index]?.height ?? 792}
                  rotation={pageRotation}
                  spin={spin}
                  annotations={history.value}
                  tool={tool}
                  shape={shape}
                  stroke={strokeStyle}
                  textStyle={textStyle}
                  selectedId={selectedId}
                  focusId={focusId}
                  getAnnotations={getAnnotations}
                  getEpoch={getEpoch}
                  onReplace={history.replace}
                  onPushBaseline={remember}
                  onSelect={setSelectedId}
                  selectedContent={contentSelection}
                  onSelectContent={setContentSelection}
                  onRequestFocus={requestFocus}
                  onConsumeFocus={consumeFocus}
                />
              ))}
            </div>
          ) : (
            <p className="blank-hint">Opening a blank page…</p>
          )}
          {loaded && readout.canScroll && (
            <div
              className={showScrollTip ? "page-scroll-tip visible" : "page-scroll-tip"}
              style={{ top: readout.tipTop, right: readout.tipRight }}
              aria-hidden="true"
            >
              Page {pageNumber}
            </div>
          )}
          {pageTotal > 0 && (
            <div
              className="page-count"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`Page ${pageNumber} of ${pageTotal}`}
            >
              {pageNumber} / {pageTotal}
            </div>
          )}
          <div className="editor-footer">
          <div className="zoom-dock">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              onClick={() => setScale((value) => clamp(value / 1.1, MIN_ZOOM, MAX_ZOOM))}
            >
              <Minus />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="zoom-label" aria-label="Zoom options">
                  {zoomLabel(scale)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center" className="w-44!">
                <DropdownMenuItem onSelect={() => setScale(1)}>Set to 100%</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fitZoom("page")}>Set to fit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fitZoom("width")}>Set to width</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fitZoom("height")}>Set to height</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={matchedPreset === undefined ? "" : String(matchedPreset)}
                  onValueChange={(value) => setScale(Number(value))}
                >
                  {ZOOM_PRESETS.map((preset) => (
                    <DropdownMenuRadioItem key={preset} value={String(preset)}>
                      {Math.round(preset * 100)}%
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              onClick={() => setScale((value) => clamp(value * 1.1, MIN_ZOOM, MAX_ZOOM))}
            >
              <Plus />
            </Button>
            <Slider
              className="w-28"
              aria-label="Zoom"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={[scale]}
              onValueChange={(next) => setScale(clamp(next[0] ?? scale, MIN_ZOOM, MAX_ZOOM))}
            />
          </div>
          <div className="arrange-dock">
            <ArrangeButton label="Fit to height" onClick={() => fitZoom("height")}>
              <UnfoldVertical />
            </ArrangeButton>
            <ArrangeButton label="Fit to width" onClick={() => fitZoom("width")}>
              <UnfoldHorizontal />
            </ArrangeButton>
            <span className="arrange-dock-gap" />
            <ArrangeButton
              label="Rotate"
              onClick={() => {
                setPageRotation((current) => ((current + 90) % 360) as PageRotation);
                setSpin((current) => current + 90);
              }}
            >
              <RotateCw />
            </ArrangeButton>
          </div>
          </div>
        </main>
        <Inspector
          tool={tool}
          shape={shape}
          selectedShape={selectedShape}
          selectedKind={selected?.kind ?? null}
          stroke={stroke}
          text={text}
          showFill={showFill}
          showInk={showInk}
          canDelete={selected !== null}
          onDelete={() => {
            if (!selectedId) return;
            const removed = history.valueRef.current.find((item) => item.id === selectedId);
            save(history.valueRef.current.filter((item) => item.id !== selectedId));
            setSelectedId(null);
            if (removed?.kind === "patch") setContentSelection(null);
          }}
          onAdjustStart={beginAdjust}
          onAdjustEnd={endAdjust}
          onStrokeColor={(color) => applyStroke({ color }, styleBaseline.current !== null)}
          onStrokeWidth={(strokeWidth) =>
            applyStroke({ strokeWidth }, styleBaseline.current !== null)
          }
          onFill={(fill) => applyStroke({ fill }, styleBaseline.current !== null)}
          onFillOpacity={(fillOpacity) =>
            applyStroke({ fillOpacity }, styleBaseline.current !== null)
          }
          onOpacity={(opacity) => applyStroke({ opacity }, styleBaseline.current !== null)}
          onCap={(cap) => applyStroke({ cap }, false)}
          onDash={(dash) => applyStroke({ dash }, false)}
          onFont={(fontId: FontId) => applyText({ fontId }, false)}
          onFontSize={(fontSize) => applyText({ fontSize }, styleBaseline.current !== null)}
          onTextColor={(color) => applyText({ color }, styleBaseline.current !== null)}
          onToggle={(key) => applyText({ [key]: !text[key] }, false)}
          onAlign={(align: Align) => applyText({ align }, false)}
          onWidth={(width) => applyText({ width }, styleBaseline.current !== null)}
          onAutoWidth={(autoWidth) =>
            applyText(autoWidth ? { autoWidth, height: null } : { autoWidth }, false)
          }
          content={selected && selected.kind !== "patch" ? null : contentSelection}
          patch={selected?.kind === "patch" ? selected : null}
        />
      </div>
    </div>
  );
}
