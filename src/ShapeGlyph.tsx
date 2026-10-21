import { isLinearShape, isOpenShape, lineHeadFor, outlinePoints, pointsToPath, type ShapeId } from "./shapes.ts";

export function ShapeGlyph({ id, className = "size-4" }: { id: ShapeId; className?: string }) {
  if (isLinearShape(id)) {
    const head = lineHeadFor(id);
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <line
          x1="5"
          y1="17"
          x2="19"
          y2="7"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        {head !== "none" && (
          <polyline
            points="13,7 19,7 19,13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {head === "both" && (
          <polyline
            points="5,11 5,17 11,17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d={pointsToPath(outlinePoints(id, 3.5, 3.5, 17, 17), !isOpenShape(id))}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
