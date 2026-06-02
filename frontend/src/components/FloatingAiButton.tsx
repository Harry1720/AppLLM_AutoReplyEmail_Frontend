"use client";

import LoadingSpinner from "@/components/LoadingSpinner";

interface FloatingAiButtonProps {
  onClick: () => void;
  isGenerating: boolean;
}

export default function FloatingAiButton({
  onClick,
  isGenerating,
}: FloatingAiButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isGenerating}
      className="fixed bottom-8 right-8 w-16 h-16 bg-linear-to-br from-amber-200 to-yellow-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
      title="Tạo câu trả lời với AI"
    >
      {isGenerating ? (
        <LoadingSpinner
          className="h-7 w-7"
          trackClassName="text-white/35"
          arcClassName="text-white"
        />
      ) : (
        <svg
          className="w-8 h-8 group-hover:scale-110 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      )}

      {/* Ripple effect on hover */}
      <span className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></span>
    </button>
  );
}
