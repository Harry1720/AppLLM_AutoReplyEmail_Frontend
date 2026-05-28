"use client";

import { Email } from "@/types/email";
import { useState } from "react";
import { decodeHtmlEntities } from "@/utils/decodeHtmlEntities";

interface EmailListProps {
  emails: Email[];
  selectedEmail: Email | null;
  onEmailSelect: (email: Email) => void;
  selectedEmailIds?: string[];
  onEmailCheckboxChange?: (emailId: string, checked: boolean) => void;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export default function EmailList({
  emails,
  selectedEmail,
  onEmailSelect,
  selectedEmailIds = [],
  onEmailCheckboxChange,
  hasNextPage = false,
  onLoadMore,
  isLoadingMore = false,
}: EmailListProps) {
  const [hoveredEmailId, setHoveredEmailId] = useState<string | null>(null);
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("vi-VN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      });
    } else if (days === 1) {
      return "Hôm qua";
    } else if (days < 7) {
      return date.toLocaleDateString("vi-VN", { weekday: "short" });
    } else {
      return date.toLocaleDateString("vi-VN", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const handleCheckboxChange = (e: React.MouseEvent, emailId: string) => {
    e.stopPropagation();
    if (onEmailCheckboxChange) {
      const isChecked = selectedEmailIds.includes(emailId);
      onEmailCheckboxChange(emailId, !isChecked);
    }
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const formatSnippet = (snippet: string) => decodeHtmlEntities(snippet);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {emails.map((email) => {
          const isChecked = selectedEmailIds.includes(email.id);
          const isHovered = hoveredEmailId === email.id;
          const isDisabled = email.aiReplyGenerated || email.replySent;

          return (
            <div
              key={email.id}
              className={`mb-2 rounded-2xl border cursor-pointer transition-all duration-200 ${
                selectedEmail?.id === email.id
                  ? "border-sky-100 bg-sky-50 shadow-[0_10px_28px_rgba(93,141,255,0.12)] p-3"
                  : isChecked
                    ? "border-purple-50 bg-purple-50 shadow-[0_8px_22px_rgba(124,93,255,0.10)] p-3"
                    : "border-white/70 bg-white/55 hover:-translate-y-0.5 hover:bg-white shadow-[0_10px_26px_rgba(93,141,255,0.1)] p-3"
              } ${
                email.draftId && !email.replySent ? "ring-1 ring-amber-200" : ""
              }`}
              onMouseEnter={() => setHoveredEmailId(email.id)}
              onMouseLeave={() => setHoveredEmailId(null)}
            >
              <div className="flex items-start space-x-2">
                {/* Avatar / Checkbox */}
                <div
                  onClick={(e) =>
                    onEmailCheckboxChange && !isDisabled
                      ? handleCheckboxChange(e, email.id)
                      : undefined
                  }
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-medium transition-all shadow-[0_8px_18px_rgba(93,141,255,0.12)] ${
                    onEmailCheckboxChange && !isDisabled ? "cursor-pointer" : ""
                  } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {onEmailCheckboxChange && isChecked ? (
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  ) : onEmailCheckboxChange && isHovered && !isDisabled ? (
                    <div className="w-10 h-10 border-2 border-blue-200 rounded-full flex items-center justify-center bg-linear-to-br from-blue-600 to-indigo-700 ">
                      {getInitials(email.sender)}
                    </div>
                  ) : email.replySent ? (
                    <div className="w-10 h-10 bg-linear-to-br from-green-300 to-green-600 rounded-full flex items-center justify-center">
                      {getInitials(email.sender)}
                    </div>
                  ) : !email.replySent && email.draftId ? (
                    <div className="w-10 h-10 bg-linear-to-br from-amber-200 to-yellow-600 rounded-full flex items-center justify-center">
                      {getInitials(email.sender)}
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                      {getInitials(email.sender)}
                    </div>
                  )}
                </div>

                {/* Email Content */}
                <div
                  className="flex-1 min-w-0"
                  onClick={() => onEmailSelect(email)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <span
                        className={`font-[550] truncate max-w-1/2 ${
                          email.isRead ? "text-slate-400" : "text-slate-900"
                        }`}
                      >
                        {email.sender}
                      </span>
                      {email.replySent && (
                        <span
                          className="flex items-center space-x-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-0.5 rounded-full"
                          title="Đã gửi trả lời"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Đã trả lời</span>
                        </span>
                      )}
                      {!email.replySent && email.draftId && (
                        <span
                          className="flex items-center space-x-1 text-amber-600 text-xs font-medium bg-amber-100 px-2 py-0.5 rounded-full"
                          title="Có gợi ý AI"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span>Có gợi ý</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 shrink-0 ml-2">
                      {formatTime(email.timestamp)}
                    </span>
                  </div>

                  <h3
                    className={`text-sm mb-1 truncate ${
                      email.isRead
                        ? "text-slate-700"
                        : "text-slate-900 font-medium"
                    }`}
                  >
                    {email.subject}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2">
                    {formatSnippet(email.snippet)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Load More Button - Inside scrollable area */}
        {hasNextPage && (
          <div className="px-1 pb-2 pt-1">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="w-full rounded-2xl border border-blue-100 bg-white/70 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_22px_rgba(93,141,255,0.08)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoadingMore ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Đang tải...
                </span>
              ) : (
                "Tải thêm"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
