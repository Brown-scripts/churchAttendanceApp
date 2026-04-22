import React from "react";

const variantClass = {
  text: "skeleton-text",
  title: "skeleton-title",
  line: "skeleton-line",
  circle: "skeleton-circle",
  block: "skeleton-block",
  kpi: "skeleton-kpi",
  chart: "skeleton-chart",
};

export function Skeleton({ variant = "text", width, height, style, className = "" }) {
  const classes = ["skeleton", variantClass[variant] || "", className].filter(Boolean).join(" ");
  const inline = { ...(width ? { width } : {}), ...(height ? { height } : {}), ...style };
  return <span className={classes} style={inline} aria-hidden="true" />;
}

export function SkeletonKpiRow({ count = 4 }) {
  return (
    <div className="kpi-row" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="kpi" />
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 300 }) {
  return <Skeleton variant="chart" height={`${height}px`} />;
}

export function SkeletonTableRows({ rows = 6, cols = 5 }) {
  return (
    <tbody aria-busy="true">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><Skeleton variant="line" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export default Skeleton;
