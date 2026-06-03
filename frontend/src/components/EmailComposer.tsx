"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useToast } from "./ToastContainer";
import { useConfirm } from "./ConfirmDialogContainer";
import LoadingSpinner from "@/components/LoadingSpinner";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] flex items-center justify-center bg-gray-50 border border-gray-200 rounded">
      <LoadingSpinner />
    </div>
  ),
});
// @ts-expect-error - CSS import for react-quill-new does not have type declarations
import "react-quill-new/dist/quill.snow.css";

interface EmailComposerProps {
  onSend: (
    to: string,
    subject: string,
    body: string,
    files?: File[],
  ) => Promise<{ success: boolean }>;
}

interface DraftData {
  to: string;
  subject: string;
  body: string;
}

export default function EmailComposer({ onSend }: EmailComposerProps) {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("email_draft");
    if (savedDraft) {
      try {
        const draft: DraftData = JSON.parse(savedDraft);
        setTo(draft.to || "");
        setSubject(draft.subject || "");
        setBody(draft.body || "");
      } catch (e) {
        console.error("Error loading draft:", e);
      }
    }
  }, []);

  // Save draft to localStorage whenever fields change
  useEffect(() => {
    const draft: DraftData = { to, subject, body };
    localStorage.setItem("email_draft", JSON.stringify(draft));
  }, [to, subject, body]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    // Validate
    if (!to.trim()) {
      showToast("Vui lòng nhập địa chỉ email người nhận", "warning");
      return;
    }

    if (!body.trim()) {
      showToast("Vui lòng nhập nội dung email", "warning");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      showToast("Địa chỉ email không hợp lệ", "error");
      return;
    }

    // Confirm before sending
    const confirmed = await confirm({
      title: "Xác nhận gửi email",
      message: `Bạn có chắc chắn muốn gửi email này đến ${to.trim()}?`,
      confirmText: "Gửi",
      cancelText: "Hủy",
      type: "info",
    });

    if (!confirmed) {
      return;
    }

    setIsSending(true);

    try {
      await onSend(
        to.trim(),
        subject.trim(),
        body.trim(),
        files.length > 0 ? files : undefined,
      );

      // Clear form
      setTo("");
      setSubject("");
      setBody("");
      setFiles([]);

      showToast("Đã gửi email thành công!", "success");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Không thể gửi email. Vui lòng thử lại.";
      showToast(errorMessage, "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Overlay khi đang gửi */}
      {isSending && (
        <div className="absolute inset-0 bg-white bg-opacity-70 z-50 flex items-center justify-center">
          <div className="text-center">
            <LoadingSpinner className="mx-auto mb-4 h-12 w-12" />
            <p className="text-lg font-medium text-gray-900">
              Đang gửi email...
            </p>
            <p className="text-sm text-gray-500 mt-2">Vui lòng đợi</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 pb-2 border-b border-gray-200 hidden 2xl:block">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-blue-500/80">
          COMPOSE
        </p>
        <h2 className="text-lg font-semibold text-gray-900">SOẠN THƯ MỚI</h2>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* To Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email người nhận <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              disabled={isSending}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tiêu đề
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Nhập tiêu đề email"
              disabled={isSending}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          {/* Body Field */}
          <div className="flex flex-col h-[500px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nội dung <span className="text-red-500">* </span>{" "}
              <i>(Vui lòng sử dụng phần Đính kèm tệp bên dưới)</i>
            </label>
            <div
              className={`flex-1 flex flex-col ${isSending ? "opacity-60 pointer-events-none" : ""}`}
            >
              <ReactQuill
                theme="snow"
                value={body}
                onChange={setBody}
                placeholder="Nhập nội dung email..."
                className="bg-white flex-1 flex flex-col [&_.ql-container]:flex-1 [&_.ql-container]:overflow-y-auto [&_.ql-editor]:min-h-[300px]"
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline", "strike"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link", "image"],
                    ["clean"],
                  ],
                }}
              />
            </div>
          </div>

          {/* File Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Đính kèm tệp <i>(Ứng dụng chỉ hiện hỗ trợ gửi 1 tệp)</i>
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              multiple
              disabled={isSending}
              className="block text-sm text-gray-500 
                file:mr-4 file:py-2 file:px-4 
                file:rounded-lg file:border-0 
                file:text-sm file:font-semibold 
                file:bg-blue-50 file:text-blue-700 
                hover:file:bg-blue-100
                file:cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-2 space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      disabled={isSending}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with Send Button */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto flex justify-end">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 cursor-pointer"
          >
            {isSending ? (
              <>
                <LoadingSpinner
                  className="h-4 w-4"
                  trackClassName="text-white/35"
                  arcClassName="text-white"
                />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                <span>Gửi email</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
