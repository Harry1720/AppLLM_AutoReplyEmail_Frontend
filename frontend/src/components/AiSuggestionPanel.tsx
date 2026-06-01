"use client";

import { useState, useEffect, useRef } from "react";
import { Email } from "@/types/email";
import {
  sendDraft,
  updateDraft,
  deleteDraft,
  getDraftDetail,
} from "@/services/api";
import { useToast } from "./ToastContainer";
import { useConfirm } from "./ConfirmDialogContainer";

interface AiSuggestionPanelProps {
  email: Email;
  onSendReply: (content: string) => Promise<void>;
  onRegenerateAi: (emailId: string) => Promise<void>;
  onClose?: () => void; // Callback để đóng panel
  onDraftDeleted?: () => void; // Callback khi xóa bản nháp thành công
}

export default function AiSuggestionPanel({
  email,
  onSendReply,
  onRegenerateAi,
  onClose,
  onDraftDeleted,
}: AiSuggestionPanelProps) {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [originalDraftContent, setOriginalDraftContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isDraftDeleted, setIsDraftDeleted] = useState(false);
  const editableRef = useRef<HTMLDivElement>(null);

  // Load draft when email changes or has draftId
  useEffect(() => {
    const loadDraft = async () => {
      console.log(
        "AiSuggestionPanel: email.id=",
        email.id,
        "draftId=",
        email.draftId,
        "isDraftDeleted=",
        isDraftDeleted,
        "replySent=",
        email.replySent,
      );

      if (email.draftId && !isDraftDeleted) {
        console.log("Loading draft with ID:", email.draftId);
        setIsLoadingDraft(true);
        try {
          const draftResponse = await getDraftDetail(email.draftId);
          console.log("Draft response:", draftResponse);
          const draftBody = draftResponse.data?.body || "";
          console.log("Draft body:", draftBody);
          setAiSuggestion(draftBody);
          setOriginalDraftContent(draftBody);
          setEditedContent(draftBody);
        } catch (err) {
          console.error("Error loading draft:", err);
          // If draft not found (e.g. already sent), don't show error
          if (email.replySent) {
            console.log(
              "Draft not found but email already sent - this is expected",
            );
            // Keep existing content if any
          } else {
            // Clear the content only if email not sent
            setAiSuggestion("");
            setOriginalDraftContent("");
            setEditedContent("");
          }
        } finally {
          setIsLoadingDraft(false);
        }
      } else if (!email.draftId) {
        console.log("No draftId, clearing content");
        setAiSuggestion("");
        setOriginalDraftContent("");
        setEditedContent("");
      }
    };

    loadDraft();
    setIsDraftDeleted(false); // Reset deleted state when email changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email.id, email.draftId]);

  // Update contentEditable innerHTML when aiSuggestion changes
  useEffect(() => {
    if (editableRef.current && aiSuggestion) {
      editableRef.current.innerHTML = aiSuggestion;
    }
  }, [aiSuggestion]);

  const handleRegenerate = async () => {
    // Show confirmation dialog
    const confirmed = await confirm({
      title: "Tạo lại gợi ý",
      message:
        "Bạn có chắc chắn muốn tạo lại gợi ý từ AI?\nBản nháp hiện tại sẽ bị xóa và thay thế bằng gợi ý mới.",
      confirmText: "Tạo lại",
      cancelText: "Hủy",
      type: "warning",
    });

    if (!confirmed) return;

    // Show loading state during AI generation
    setIsLoadingDraft(true);
    setAiSuggestion("");
    setEditedContent("");
    setOriginalDraftContent("");

    // Delete old draft first if exists
    if (email.draftId && !isDraftDeleted) {
      try {
        await deleteDraft(email.draftId);
        console.log("Old draft deleted before regenerating");
      } catch (err) {
        console.error("Error deleting old draft:", err);
      }
    }

    try {
      await onRegenerateAi(email.id);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  const handleSend = async () => {
    if (isDraftDeleted) {
      showToast("Bản nháp đã bị xóa. Vui lòng tạo lại câu trả lời.", "error");
      return;
    }

    if (!email.draftId) {
      showToast(
        "Không có draft ID. Vui lòng tạo câu trả lời AI trước.",
        "error",
      );
      return;
    }

    // Hiển thị hộp thoại xác nhận trước khi gửi
    const confirmed = await confirm({
      title: "Xác nhận gửi email",
      message: "Bạn có chắc chắn muốn gửi email trả lời này không?",
      confirmText: "Gửi",
      cancelText: "Hủy",
      type: "info",
    });

    if (!confirmed) return;

    setIsSending(true);
    try {
      // Kiểm tra xem nội dung có thay đổi không
      const contentChanged =
        editedContent.trim() !== originalDraftContent.trim();

      // Chuẩn bị thông tin email
      const replySubject = email.subject.startsWith("Re: ")
        ? email.subject
        : `Re: ${email.subject}`;

      // Gửi draft - nếu có thay đổi thì gửi kèm nội dung mới để cập nhật Supabase
      let response;
      if (contentChanged) {
        console.log(
          "Content changed, sending with updated content to Supabase...",
        );
        response = await sendDraft(
          email.draftId,
          replySubject,
          editedContent,
          email.senderEmail,
        );
      } else {
        // Không có thay đổi, chỉ gửi draft bình thường
        response = await sendDraft(email.draftId);
      }

      // Xác định nội dung cuối cùng đã gửi (ưu tiên từ response)
      const finalContent = response.draft?.body || editedContent;
      console.log("Final content sent:", finalContent);

      // Lưu nội dung vào state ngay lập tức
      setAiSuggestion(finalContent);
      setEditedContent(finalContent);
      setOriginalDraftContent(finalContent);

      // Call parent callback to update email state
      await onSendReply(finalContent);

      // Show loading state immediately để reload panel
      setIsLoadingDraft(true);

      // Ngắn delay rồi tắt loading (component sẽ remount với replySent=true)
      setTimeout(() => {
        setIsLoadingDraft(false);
      }, 100);

      showToast("Email đã được gửi thành công!", "success");
    } catch (error) {
      console.error("Failed to send email:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Không thể gửi email";
      showToast(`Lỗi: ${errorMessage}`, "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!email.draftId) {
      showToast("Không có bản nháp để xóa.", "warning");
      return;
    }

    const confirmed = await confirm({
      title: "Xóa bản nháp",
      message:
        "Bạn có chắc chắn muốn xóa bản nháp này?\nLưu ý: Nếu xóa, bản nháp trên Gmail cũng sẽ bị mất!",
      confirmText: "Xóa",
      cancelText: "Hủy",
      type: "danger",
    });

    if (!confirmed) return;

    // Show loading state while deleting
    setIsLoadingDraft(true);

    try {
      // Delete draft using dedicated endpoint (deletes from both Gmail and Supabase)
      const result = await deleteDraft(email.draftId);

      // Clear the content and mark as deleted
      setAiSuggestion("");
      setEditedContent("");
      setOriginalDraftContent("");
      setIsDraftDeleted(true);

      // Show detailed message
      if (result.supabase_deleted) {
        showToast("Bản nháp đã được xóa thành công ở Gmail!", "success");
      } else {
        showToast(
          "Bản nháp đã được xóa từ Gmail (không tìm thấy trong Supabase).",
          "success",
        );
      }

      // Call parent callback to trigger page reload
      if (onDraftDeleted) {
        onDraftDeleted();
      }
    } catch (error) {
      console.error("Failed to delete draft:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Không thể xóa bản nháp";
      showToast(`Lỗi: ${errorMessage}`, "error");
    } finally {
      setIsLoadingDraft(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="">
            {/* <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div> */}
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-blue-500/80">
              AI ASSISTANT
            </p>

            <h2 className=" pt-1 text-lg font-semibold text-gray-900">GỢI Ý TỪ AI</h2>
          </div>

          {/* Nút đóng panel */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors hidden 2xl:block"
              title="Đóng panel"
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
          )}
        </div>
        <p className="text-sm text-gray-500">
          {email.replySent
            ? ""
            : isDraftDeleted
              ? "Bản nháp đã bị xóa"
              : "Chỉnh sửa nội dung nếu muốn"}
        </p>
      </div>

      {/* AI Suggestion Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {email.replySent ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <h3 className="font-semibold text-green-900">
                  Nội dung đã trả lời
                </h3>
              </div>
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: aiSuggestion }}
              />
            </div>
          </div>
        ) : isLoadingDraft ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2"
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
              <p className="text-sm text-gray-500 font-medium">
                {email.draftId ? "Đang tải..." : "Đang tạo câu trả lời..."}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Vui lòng đợi trong giây lát
              </p>
            </div>
          </div>
        ) : !aiSuggestion && !email.draftId ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
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
              <p className="text-sm text-gray-700 font-medium mb-2">
                Chưa có câu trả lời từ AI
              </p>
              <p className="text-xs text-gray-500">
                Chọn email và nhấn &ldquo;Tạo câu trả lời với AI&rdquo; để bắt
                đầu
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              {/* <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900">
                Gợi ý trả lời
              </h3>
            </div> */}

              <div className="relative">
                <div
                  ref={editableRef}
                  contentEditable={!isDraftDeleted && !email.replySent}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onInput={(e) => setEditedContent(e.currentTarget.innerHTML)}
                  className="w-full max-h-none py-2.5 px-3.5 overflow-y-auto bg-white text-[15px] text-gray-900 focus:outline-none ring-2 ring-[rgba(93,141,255,0.1)] focus:ring-[rgba(93,141,255,0.25)] focus:border-transparent prose prose-sm max-w-none focus:shadow-[0_0px_26px_rgba(93,141,255,0.15)] rounded-2xl text-justify"
                  style={{ whiteSpace: "pre-wrap" }}
                />
              </div>
            </div>

            {/* Action Buttons - Horizontal Layout */}
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={handleSend}
                disabled={isSending || !editedContent.trim() || isDraftDeleted}
                className="text-blue-600 py-2.5 px-4 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSending ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-blue-600"
                      xmlns="http://www.w3.org/2000/svg"
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
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 text-blue-600"
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
                    <span>Gửi</span>
                  </>
                )}
              </button>

              <button
                onClick={handleRegenerate}
                disabled={isDraftDeleted}
                className="text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg
                  className="w-5 h-5 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Tạo lại</span>
              </button>

              <button
                onClick={handleDeleteDraft}
                disabled={isSending || isDraftDeleted || !email.draftId}
                className="text-red-600 py-2.5 px-4 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span>Xóa</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {/* <div className="border-t border-gray-200 p-3">
        <div className="flex items-center justify-center space-x-1 text-xs text-gray-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Đôi khi mô hình có thể đưa ra kết quả không tốt.</span>
        </div>
      </div> */}
    </div>
  );
}
