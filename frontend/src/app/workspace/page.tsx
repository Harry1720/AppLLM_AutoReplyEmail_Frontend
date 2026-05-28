"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Email } from "@/types/email";
import EmailList from "@/components/EmailList";
import EmailContent from "@/components/EmailContent";
import AiSuggestionPanel from "@/components/AiSuggestionPanel";
import Header from "@/components/Header";
import FloatingAiButton from "@/components/FloatingAiButton";

// Import các hàm gọi API (Service)
import {
  fetchEmails,
  fetchEmailDetail,
  getAuthToken,
  getUserInfo,
  generateAiReply,
  sendEmail,
  getAllDrafts,
  getSentEmails,
} from "@/services/api";

import { useToast } from "@/components/ToastContainer";

export default function WorkspacePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]); // Lưu danh sách tất cả email đang hiển thị
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null); // Lưu email đang được click chọn xem
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); // Trạng thái khi bấm nút "Đồng bộ"
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null); // Token để tải trang tiếp theo (Pagination)
  const [isLoadingMore, setIsLoadingMore] = useState(false); // Trạng thái khi cuộn xuống để tải thêm
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set()); // Lưu ID các email đã được trả lời (để hiện icon đã gửi)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false); // Trạng thái khi tải chi tiết email

  // Checkbox states
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]); // Danh sách ID các email được tích chọn checkbox
  const [isGeneratingAi, setIsGeneratingAi] = useState(false); // Trạng thái đang đợi AI viết

  // AI Panel visibility state
  const [isAiPanelVisible, setIsAiPanelVisible] = useState(true); // Quản lý hiển thị/ẩn panel AI

  // HÀM TẢI EMAIL
  // Sử dụng useCallback để tránh re-create function
  const loadEmails = useCallback(
    async (pageToken?: string, showLoading = true, append = false) => {
      try {
        // Bật loading spinner tùy theo trường hợp (tải mới hay tải thêm)
        if (showLoading) {
          if (append) {
            setIsLoadingMore(true);
          } else {
            setIsLoading(true);
          }
        }
        setError(null);

        // 1. GỌI API LẤY DANH SÁCH EMAIL TỪ GMAIL
        const data = await fetchEmails(20, pageToken);

        // Transform backend email format to frontend format
        interface EmailFromAPI {
          id: string;
          threadId?: string;
          subject?: string;
          snippet?: string;
          from?: string;
          date?: string;
          labelIds?: string[];
        }

        // 2. XỬ LÝ DỮ LIỆU: Format lại thông tin người gửi
        // API Gmail trả về chuỗi kiểu: "Nguyen Van A <nguyena@gmail.com>"
        // Ta cần tách riêng Tên và Email.
        const transformedEmails: Email[] = data.emails.map(
          (email: EmailFromAPI) => {
            // Parse "From" header: "Nguyen Van A <nguyen.a@gmail.com>" hoặc "\"Bảo Huỳnh\" <baohuynh4107@gmail.com>"
            const parseFrom = (fromHeader?: string) => {
              if (!fromHeader) return { name: "Unknown", email: "" };

              // Check if fromHeader has <email> format
              const emailMatch = fromHeader.match(/<(.+?)>/);

              if (emailMatch) {
                // Format: "Name <email@domain.com>"
                const emailAddr = emailMatch[1].trim();
                let name = fromHeader.replace(/<.*>/, "").trim();
                // Remove surrounding quotes (both single and double)
                name = name.replace(/^["']|["']$/g, "");
                // If name is empty after removing email part, use email username
                name = name || emailAddr.split("@")[0];
                return { name, email: emailAddr };
              } else {
                // Plain email address without name: "email@domain.com"
                const emailAddr = fromHeader.trim();
                const name = emailAddr.split("@")[0]; // Extract username before @
                return { name, email: emailAddr };
              }
            };

            const { name: senderName, email: senderEmail } = parseFrom(
              email.from,
            );

            // Trả về object Email chuẩn cho frontend dùng
            return {
              id: email.id,
              sender: senderName,
              senderEmail: senderEmail,
              subject: email.subject?.trim() || "(No Subject)",
              snippet: email.snippet || "",
              body: email.snippet || "",
              timestamp: email.date || new Date().toISOString(),
              hasAiSuggestion: false,
              aiReplyGenerated: false,
            };
          },
        );

        // 3. Fetch drafts from Supabase to mark emails with existing drafts
        let emailsWithDrafts = transformedEmails;
        try {
          console.log("Fetching drafts from Supabase...");
          const draftsResponse = await getAllDrafts(); // Lấy danh sách bản nháp từ Supabase
          console.log("Drafts response:", draftsResponse);
          const drafts = draftsResponse.drafts || [];
          console.log("Number of drafts found:", drafts.length);

          // Fetch sent email IDs from server
          console.log("Fetching sent emails from server...");
          const sentResponse = await getSentEmails(); // Lấy danh sách email đã gửi trả lời
          const sentEmailIds = new Set<string>(
            sentResponse.sent_email_ids || [],
          );
          console.log("Number of sent emails:", sentEmailIds.size);
          setSentEmails(sentEmailIds);

          // Create map of email_id -> draft_id
          const draftMap = new Map();
          drafts.forEach((draft: { email_id: string; draft_id: string }) => {
            console.log(
              `Mapping email_id ${draft.email_id} -> draft_id ${draft.draft_id}`,
            );
            draftMap.set(draft.email_id, draft.draft_id);
          });

          // Mark emails that have drafts or have been sent
          emailsWithDrafts = transformedEmails.map((email) => {
            const hasDraft = draftMap.has(email.id);
            const draftId = draftMap.get(email.id);
            const isSent = sentEmailIds.has(email.id);
            console.log(
              `Email ${email.id}: hasDraft=${hasDraft}, draftId=${draftId}, isSent=${isSent}`,
            );
            return {
              ...email,
              aiReplyGenerated: hasDraft && !isSent, // Nếu có nháp và chưa gửi -> Đánh dấu là AI đã tạo
              draftId: draftId || undefined, // Lưu lại ID bản nháp
              hasAiSuggestion: hasDraft && !isSent, // Đánh dấu là đã gửi
              replySent: isSent,
            };
          });
          console.log("Final emails with drafts:", emailsWithDrafts);
        } catch (draftErr) {
          console.error("Error fetching drafts:", draftErr);
        }

        // 4. CẬP NHẬT STATE
        if (append) {
          setEmails((prev) => [...prev, ...emailsWithDrafts]); // Nối thêm vào danh sách cũ
        } else {
          setEmails(emailsWithDrafts); // Thay thế hoàn toàn (làm mới)
        }
        setNextPageToken(data.next_page_token); // Lưu token trang sau
      } catch (err: unknown) {
        console.error("Error loading emails:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Không thể tải email. Vui lòng thử lại.";
        setError(errorMessage);

        // If authentication error, redirect to login
        if (err instanceof Error && err.message.includes("Authentication")) {
          setTimeout(() => {
            router.push("/");
          }, 2000);
        }
      } finally {
        setIsLoading(false);
        setIsSyncing(false);
        setIsLoadingMore(false);
      }
    },
    [router],
  );

  // Load emails on mount - chỉ chạy 1 lần
  useEffect(() => {
    const token = getAuthToken();
    const userInfo = getUserInfo();

    if (!token || !userInfo) {
      router.push("/");
      return;
    }

    // Load emails lần đầu
    loadEmails(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency - chỉ chạy 1 lần khi mount

  // Handler cho sync từ header (đồng bộ thủ công) - không reload toàn bộ trang
  const handleSyncFromHeader = useCallback(async () => {
    if (isSyncing) return; // Tránh sync nhiều lần

    setIsSyncing(true);
    await loadEmails(undefined, false); // Sync mà không show loading spinner
  }, [isSyncing, loadEmails]);

  // Handler khi xóa draft - tự động tải lại trang
  const handleDraftDeleted = useCallback(() => {
    // Đợi 1 giây rồi tải lại trang để người dùng thấy toast message
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }, []);

  //Chọn xem chi tiết 1 Email
  const handleEmailSelect = async (email: Email) => {
    setIsLoadingDetail(true); // Bật loading spinner
    try {
      const detailResponse = await fetchEmailDetail(email.id); // Khi click vào email, ta gọi API lấy chi tiết (fetchEmailDetail)
      const emailDetail = detailResponse.data;

      const parseFrom = (fromHeader?: string) => {
        if (!fromHeader) return { name: "Unknown", email: "" };

        // Check if fromHeader has <email> format (tương tự như trên emailList)
        const emailMatch = fromHeader.match(/<(.+?)>/);

        if (emailMatch) {
          // Format: "Name <email@domain.com>"
          const emailAddr = emailMatch[1].trim();
          let name = fromHeader.replace(/<.*>/, "").trim();
          // Remove surrounding quotes (both single and double)
          name = name.replace(/^["']|["']$/g, "");
          // Remove escaped quotes
          name = name.replace(/\\"/g, '"');
          // If name is empty after removing email part, use email username
          name = name || emailAddr.split("@")[0];
          return { name, email: emailAddr };
        } else {
          // Plain email address without name: "email@domain.com"
          const emailAddr = fromHeader.trim();
          const name = emailAddr.split("@")[0]; // Extract username before @
          return { name, email: emailAddr };
        }
      };

      const { name: senderName, email: senderEmail } = parseFrom(
        emailDetail.from,
      );

      // Extract body - ưu tiên HTML, fallback về plain text
      let body = emailDetail.body || emailDetail.snippet || "";

      // Nếu body là object với parts (multipart email)
      if (typeof body === "object" && body.parts) {
        // Tìm HTML part trước
        const htmlPart = body.parts.find(
          (p: { mimeType: string }) => p.mimeType === "text/html",
        );
        const textPart = body.parts.find(
          (p: { mimeType: string }) => p.mimeType === "text/plain",
        );
        body = htmlPart?.body || textPart?.body || emailDetail.snippet || "";
      }

      const fullEmail: Email = {
        id: email.id,
        sender: senderName || "Unknown",
        senderEmail: senderEmail || "",
        subject: emailDetail.subject || "(No Subject)",
        snippet: emailDetail.snippet || "",
        body: body,
        timestamp: emailDetail.date || email.timestamp,
        hasAiSuggestion: email.hasAiSuggestion || false,
        isRead: true,
        draftId: email.draftId, // draft from original email
        aiReplyGenerated: email.aiReplyGenerated || false,
        replySent: email.replySent || false,
      };

      console.log("Selected email with draft info:", fullEmail);
      setSelectedEmail(fullEmail);

      // Tự động mở panel AI nếu có draft
      if (fullEmail.draftId) {
        setIsAiPanelVisible(true);
      }

      // Đánh dấu email trong danh sách là "Đã đọc"
      setEmails((prev: Email[]) =>
        prev.map((e: Email) =>
          e.id === email.id ? { ...e, isRead: true } : e,
        ),
      );
    } catch (err) {
      console.error("Error loading email detail:", err);
      setSelectedEmail(email);
      setEmails((prev: Email[]) =>
        prev.map((e: Email) =>
          e.id === email.id ? { ...e, isRead: true } : e,
        ),
      );
    } finally {
      setIsLoadingDetail(false); // Tắt loading spinner
    }
  };

  //Gửi trả lời
  const handleSendReply = async (content: string) => {
    if (!selectedEmail) return;

    try {
      // Extract reply subject - add "Re: " prefix if not already present
      const replySubject = selectedEmail.subject.startsWith("Re: ")
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`;

      await sendEmail(selectedEmail.senderEmail, replySubject, content);

      // Mark email as sent (status will be saved to DB by backend)
      setEmails((prev) =>
        prev.map((e) =>
          e.id === selectedEmail.id ? { ...e, replySent: true } : e,
        ),
      );

      // Update selected email
      setSelectedEmail({
        ...selectedEmail,
        replySent: true,
      });

      // Update local sentEmails state
      const newSentEmails = new Set<string>(sentEmails);
      newSentEmails.add(selectedEmail.id);
      setSentEmails(newSentEmails);
    } catch (err) {
      console.error("Error updating reply status:", err);
    }
  };

  //Tạo AI cho nhiều email
  const handleRegenerateAi = async (emailId: string) => {
    console.log("Regenerating AI suggestion for:", emailId);
    try {
      setIsGeneratingAi(true); // Bật loading trên nút bấm
      const response = await generateAiReply(emailId);

      // Update email with draft info
      setEmails((prev) =>
        prev.map((e) =>
          e.id === emailId
            ? {
                ...e,
                aiReplyGenerated: true,
                draftId: response.draft_id,
                hasAiSuggestion: true,
              }
            : e,
        ),
      );

      // Update selected email if it's the current one - force new object to trigger re-render
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({
          ...selectedEmail,
          aiReplyGenerated: true,
          draftId: response.draft_id,
          hasAiSuggestion: true,
        });

        // Tự động mở panel AI khi tạo gợi ý mới
        setIsAiPanelVisible(true);
      }

      showToast("Gợi ý AI đã được tạo!", "success");
    } catch (err) {
      console.error("Error regenerating AI:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Không thể tạo gợi ý AI";
      showToast(`Lỗi: ${errorMessage}`, "error");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Handle checkbox change
  const handleEmailCheckboxChange = (emailId: string, checked: boolean) => {
    if (checked && selectedEmailIds.length >= 5) {
      showToast("Bạn chỉ có thể chọn tối đa 5 email", "warning");
      return;
    }

    setSelectedEmailIds((prev) => {
      if (checked) {
        return [...prev, emailId];
      } else {
        return prev.filter((id) => id !== emailId);
      }
    });
  };

  // Generate AI replies for selected emails
  const handleGenerateAiReplies = async () => {
    if (selectedEmailIds.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 email", "warning");
      return;
    }

    setIsGeneratingAi(true); // Bật loading trên nút bấm
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const emailId of selectedEmailIds) {
      // Duyệt qua từng ID email đã chọn
      try {
        const response = await generateAiReply(emailId); // Gọi API sinh câu trả lời

        // Update email with draft info + update icon đã tạo thành công trên emailList
        setEmails((prev) =>
          prev.map((e) =>
            e.id === emailId
              ? {
                  ...e,
                  aiReplyGenerated: true,
                  draftId: response.draft_id,
                  hasAiSuggestion: true,
                }
              : e,
          ),
        );

        // Update selected email if it's the current one
        if (selectedEmail?.id === emailId) {
          setSelectedEmail({
            ...selectedEmail,
            aiReplyGenerated: true,
            draftId: response.draft_id,
            hasAiSuggestion: true,
          });
        }

        results.push({ id: emailId, success: true });
      } catch (err) {
        console.error(`Error generating AI reply for ${emailId}:`, err);
        results.push({
          id: emailId,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    setIsGeneratingAi(false);
    setSelectedEmailIds([]); // Bỏ chọn checkbox sau khi làm xong

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    showToast(
      `Đã tạo xong!\nThành công: ${successCount}\nThất bại: ${failCount}`,
      "info",
      5000,
    ); // Hiện thông báo kết quả
  };

  // Load more emails
  const handleLoadMore = () => {
    if (nextPageToken && !isLoadingMore) {
      loadEmails(nextPageToken, true, true);
    }
  };

  const renderEmptyState = () => (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md rounded-[28px] border border-white/70 bg-white/70 p-8 text-center shadow-[0_20px_60px_rgba(93,141,255,0.12)] backdrop-blur-xl">
        <div className="mx-auto mb-5 flex items-center justify-center">
          <svg
            className="h-14 w-14 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">
          Chọn email để AI gợi ý câu trả lời
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Xem nội dung chi tiết, nhận gợi ý phản hồi phù hợp và giữ luồng xử lý
          email thật gọn.
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-transparent text-slate-900">
      {/* Left Panel - Email List */}
      <div className="w-90 mx-4 my-4 flex flex-col overflow-hidden rounded-[18px] border border-white/70 bg-white/60 backdrop-blur-xl">
        <div className="shrink-0 border-b border-white/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-blue-500/80">
                INBOX
              </p>
              <h2 className="pt-1 text-lg font-semibold text-slate-900">
                Hộp thư của bạn
              </h2>
              {selectedEmailIds.length > 0 && (
                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-xs text-slate-500">
                    Đã chọn {selectedEmailIds.length}/5 email
                  </p>
                  {!isGeneratingAi && (
                    <button
                      onClick={() => setSelectedEmailIds([])}
                      className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                    >
                      Bỏ chọn tất cả
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {/* Generate AI Button */}
              {selectedEmailIds.length > 0 && (
                <button
                  onClick={handleGenerateAiReplies}
                  disabled={isGeneratingAi}
                  className="flex items-center space-x-2 rounded-full bg-linear-to-r from-blue-600 to-indigo-500 px-4 py-2 text-white font-medium shadow-[0_10px_24px_rgba(93,141,255,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(93,141,255,0.28)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title="Tạo câu trả lời với AI"
                >
                  {isGeneratingAi ? (
                    <svg
                      className="animate-spin h-5 w-5"
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
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                      <span className="font-medium">
                        ({selectedEmailIds.length})
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center">
                <p className="mb-2 text-red-600">{error}</p>
                <button
                  onClick={() => loadEmails()}
                  className="text-blue-600 hover:underline"
                >
                  Thử lại
                </button>
              </div>
            </div>
          ) : (
            <EmailList
              emails={emails}
              selectedEmail={selectedEmail}
              onEmailSelect={handleEmailSelect}
              selectedEmailIds={selectedEmailIds}
              onEmailCheckboxChange={handleEmailCheckboxChange}
              hasNextPage={!!nextPageToken}
              onLoadMore={handleLoadMore}
              isLoadingMore={isLoadingMore}
            />
          )}
        </div>
      </div>

      {/* Right Content Area with Header */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onSync={handleSyncFromHeader} isSyncing={isSyncing} />

        <div className="flex-1 flex overflow-hidden px-4 pb-4 pt-4 gap-4">
          {/* Middle Panel - Email Content */}
          <div className="flex-1 w-2xl overflow-hidden rounded-[18px] border border-white/70 bg-white/60 flex flex-col">
            {/* Email Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingDetail ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="animate-spin h-12 w-12 mx-auto text-blue-600"
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
                    <p className="mt-4 text-sm text-slate-600">
                      Đang tải nội dung email...
                    </p>
                  </div>
                </div>
              ) : selectedEmail ? (
                <EmailContent email={selectedEmail} />
              ) : (
                renderEmptyState()
              )}
            </div>
          </div>

          {/* Right Panel - AI Suggestions */}
          {/* Hiển thị panel AI chỉ khi có draft và không đang loading email detail */}
          {selectedEmail &&
            selectedEmail.draftId &&
            !isLoadingDetail &&
            isAiPanelVisible && (
              <div className="flex-1 max-w-90 overflow-hidden rounded-[18px] border border-white/70 bg-white/60 shadow-[0_18px_60px_rgba(93,141,255,0.10)] backdrop-blur-xl transition-all duration-300 ease-in-out">
                <AiSuggestionPanel
                  key={`${selectedEmail.id}-${selectedEmail.replySent}`}
                  email={selectedEmail}
                  onSendReply={handleSendReply}
                  onRegenerateAi={handleRegenerateAi}
                  onClose={() => setIsAiPanelVisible(false)}
                  onDraftDeleted={handleDraftDeleted}
                />
              </div>
            )}

          {/* Nút xem lại gợi ý khi panel bị đóng */}
          {selectedEmail && selectedEmail.draftId && !isAiPanelVisible && (
            <button
              onClick={() => setIsAiPanelVisible(true)}
              className="fixed right-4 top-1/2 z-10 flex -translate-y-1/2 items-center space-x-2 rounded-l-2xl bg-linear-to-r from-blue-600 to-indigo-500 px-4 py-3 text-white shadow-[0_14px_30px_rgba(93,141,255,0.24)] transition-all duration-200 hover:-translate-y-1/2 hover:shadow-[0_18px_36px_rgba(93,141,255,0.30)] cursor-pointer"
              title="Xem nội dung gợi ý"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="font-medium">
                {selectedEmail.replySent ? "Xem trả lời" : "Xem gợi ý"}
              </span>
            </button>
          )}

          {/* Floating AI Button - Chỉ hiện khi mở email detail, chưa có draft và chưa gửi */}
          {selectedEmail &&
            !selectedEmail.draftId &&
            !selectedEmail.replySent &&
            !isLoadingDetail && (
              <FloatingAiButton
                onClick={() => handleRegenerateAi(selectedEmail.id)}
                isGenerating={isGeneratingAi}
              />
            )}
        </div>
      </div>
    </div>
  );
}
