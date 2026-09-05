import React from "react";
import PropTypes from "prop-types";

export default function ScoreSparkline({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
        No data
      </div>
    );
  }
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 60;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-24"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#667eea" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#sparkGrad)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#667eea"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="1.5"
            fill="#667eea"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

ScoreSparkline.propTypes = {
  data: PropTypes.arrayOf(PropTypes.number),
};
