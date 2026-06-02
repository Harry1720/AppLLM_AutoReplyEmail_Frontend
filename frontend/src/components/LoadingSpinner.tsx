"use client";

interface LoadingSpinnerProps {
  className?: string;
  trackClassName?: string;
  arcClassName?: string;
}

export default function LoadingSpinner({
  className = "h-6 w-6",
  trackClassName = "text-blue-200",
  arcClassName = "text-blue-500",
}: LoadingSpinnerProps) {
  return (
    <svg
      className={`animate-spin ${className}`.trim()}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="24"
        cy="24"
        r="18"
        stroke="currentColor"
        strokeWidth="5"
        className={trackClassName}
        opacity="0.45"
      />
      <circle
        cx="24"
        cy="24"
        r="18"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="34 80"
        strokeDashoffset="18"
        className={arcClassName}
      />
    </svg>
  );
}
