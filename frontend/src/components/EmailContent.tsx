"use client";

import { Email } from "@/types/email";
import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";

interface EmailContentProps {
  email: Email;
}

export default function EmailContent({ email }: EmailContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Sanitize và render HTML content
  const getSanitizedHTML = (html: string) => {
    // Cấu hình DOMPurify cho phép các thẻ
    const config = {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "b",
        "i",
        "em",
        "u",
        "a",
        "img",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "table",
        "thead",
        "tbody",
        "tr",
        "td",
        "th",
        "div",
        "span",
        "pre",
        "code",
      ],
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "class",
        "style",
        "width",
        "height",
        "target",
        "rel",
      ],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    };

    return DOMPurify.sanitize(html, config);
  };

  // Xử lý styles cho email content
  useEffect(() => {
    if (contentRef.current) {
      // Reset các styles không mong muốn
      const emailBody = contentRef.current;

      // Remove inline styles có thể gây lỗi layout
      const elements = emailBody.querySelectorAll("*");
      elements.forEach((el) => {
        const element = el as HTMLElement;
        // Loại bỏ các style có thể làm vỡ layout
        if (
          element.style.position === "absolute" ||
          element.style.position === "fixed"
        ) {
          element.style.position = "relative";
        }
        if (element.style.width && parseInt(element.style.width) > 800) {
          element.style.width = "100%";
        }
      });

      // Xử lý links - mở trong tab mới
      const links = emailBody.querySelectorAll("a");
      links.forEach((link) => {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      });

      const images = emailBody.querySelectorAll("img");
      images.forEach((img) => {
        img.style.maxWidth = "100%";
        img.style.height = "auto";
      });
    }
  }, [email.body]);

  // Kiểm tra xem content có phải HTML không
  const isHTML = email.body.trim().startsWith("<");

  return (
    <div className="flex flex-col h-full">
      {/* Email Header */}
      <div className="border-b border-white/70 bg-white/75 p-6 backdrop-blur-md">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            {email.subject}
          </h1>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-linear-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-[0_8px_18px_rgba(93,141,255,0.16)]">
                <span className="text-white font-medium text-sm">
                  {email.sender
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
              </div>
              <div>
                <p className="font-medium text-slate-900">{email.sender}</p>
                <p className="text-sm text-slate-500">{email.senderEmail}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">
                {formatDateTime(email.timestamp)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="p-6 bg-transparent">
        {isHTML ? (
          <div
            ref={contentRef}
            className="email-content"
            dangerouslySetInnerHTML={{
              __html: getSanitizedHTML(email.body),
            }}
          />
        ) : (
          <div className="prose max-w-none">
            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
              {email.body}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
