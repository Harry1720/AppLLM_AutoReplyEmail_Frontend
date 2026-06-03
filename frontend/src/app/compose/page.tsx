"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Email } from "@/types/email";
import EmailList from "@/components/EmailList";
import EmailComposer from "@/components/EmailComposer";
import EmailDetail from "@/components/EmailDetail";
import Header from "@/components/Header";
import LoadingSpinner from "@/components/LoadingSpinner";
import SearchBar from "@/components/SearchBar";
import {
  fetchSentEmails,
  fetchEmailDetail,
  getAuthToken,
  sendEmail,
} from "@/services/api";
import { useToast } from "@/components/ToastContainer";

export default function ComposePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]); // Danh sách email đã gửi
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null); // Email đang được chọn để xem chi tiết
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false); // Loading khi fetch email detail
  const [isSyncing, setIsSyncing] = useState(false); // Trạng thái khi bấm nút "Đồng bộ"
  const [error, setError] = useState<string | null>(null);

  // Pagination (Phân trang)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Biến này quyết định cột bên phải hiện gì?
  // true -> Hiện khung soạn thảo (EmailComposer)
  // false -> Hiện nội dung email (EmailDetail) hoặc màn hình chờ
  const [showComposer, setShowComposer] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  const getFilteredEmails = (sourceEmails: Email[]) => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();

    return sourceEmails.filter((email) => {
      if (timeFilter !== "all") {
        const ts = new Date(email.timestamp);
        const diffDays = Math.floor(
          (now.getTime() - ts.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (timeFilter === "today") {
          if (
            ts.getFullYear() !== now.getFullYear() ||
            ts.getMonth() !== now.getMonth() ||
            ts.getDate() !== now.getDate()
          ) {
            return false;
          }
        } else if (timeFilter === "7") {
          if (diffDays > 7) return false;
        } else if (timeFilter === "30") {
          if (diffDays > 30) return false;
        }
      }

      if (!term) return true;

      const haystack = (
        (email.sender || "") +
        " " +
        (email.senderEmail || "") +
        " " +
        (email.subject || "") +
        " " +
        (email.snippet || "") +
        " " +
        (email.body || "")
      ).toLowerCase();

      return haystack.includes(term);
    });
  };

  // Check authentication on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push("/");
    }
  }, [router]);

  // Load sent emails
  const loadSentEmails = useCallback(
    async (pageToken?: string, showLoading = true, append = false) => {
      try {
        if (showLoading) {
          if (append) {
            setIsLoadingMore(true);
          } else {
            setIsLoading(true);
          }
        }
        setError(null);

        // 1. Gọi API lấy danh sách thư ĐÃ GỬI
        const data = await fetchSentEmails(10, pageToken);

        console.log("Sent emails data:", data);

        // Transform backend email format to frontend format
        interface EmailFromAPI {
          id: string; // Bắt buộc phải có, kiểu chuỗi ký tự
          threadId?: string; // Dấu ? nghĩa là CÓ THỂ CÓ hoặc KHÔNG (Optional)
          subject?: string;
          snippet?: string;
          from?: string;
          to?: string;
          date?: string;
          labelIds?: string[];
        }

        // 2. Xử lý dữ liệu (Transform) -> thấy tên NGƯỜI NHẬN (To), chứ không phải tên mình (From).
        const transformedEmails: Email[] = data.emails.map(
          (email: EmailFromAPI) => {
            console.log(
              "Processing email:",
              email.id,
              "to:",
              email.to,
              "from:",
              email.from,
            );

            // Parse "To" header for sent emails
            const parseTo = (toHeader?: string) => {
              // Xử lý trường hợp null, undefined hoặc chuỗi rỗng ""
              if (!toHeader || toHeader.trim() === "") {
                return {
                  name: "Người nhận ẩn danh (BCC)",
                  email: "Không hiển thị",
                };
              }

              // Extract first recipient only (if multiple recipients)
              const firstRecipient = toHeader.split(",")[0].trim();

              // Check if has <email> format
              // Logic Regex tương tự file Workspace: Tách Tên và Email
              const emailMatch = firstRecipient.match(/<(.+?)>/);

              if (emailMatch) {
                // Format: "Name <email@domain.com>"
                const emailAddr = emailMatch[1].trim();
                let name = firstRecipient.replace(/<.*>/, "").trim();
                // Remove surrounding quotes (both single and double)
                name = name.replace(/^["']|["']$/g, "");
                // If name is empty, use email username
                name = name || emailAddr.split("@")[0];
                return { name, email: emailAddr };
              } else {
                // Plain email address: "email@domain.com"
                const emailAddr = firstRecipient.trim();
                const name = emailAddr.split("@")[0];
                return { name, email: emailAddr };
              }
            };

            // For sent emails, use "to" field to show recipient
            // Lấy thông tin người nhận
            const { name: recipientName, email: recipientEmail } = parseTo(
              email.to,
            );

            return {
              id: email.id,
              sender: recipientName,
              senderEmail: recipientEmail,
              subject: email.subject?.trim() || "(No Subject)",
              snippet: email.snippet || "",
              body: email.snippet || "",
              timestamp: email.date || new Date().toISOString(),
            };
          },
        );

        if (append) {
          setEmails((prev) => [...prev, ...transformedEmails]);
        } else {
          setEmails(transformedEmails);
        }

        // Lưu token trang sau
        // Backend có thể trả về nextPageToken hoặc next_page_token
        setNextPageToken(data.nextPageToken || data.next_page_token || null);
        // console.log('Next page token:', data.nextPageToken || data.next_page_token);
      } catch (error: unknown) {
        console.error("Error loading sent emails:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load sent emails",
        );

        if (
          error instanceof Error &&
          error.message.includes("Authentication expired")
        ) {
          router.push("/");
        }
      } finally {
        setIsLoading(false);
        setIsSyncing(false);
        setIsLoadingMore(false);
      }
    },
    [router],
  );

  // Handler cho sync từ header (đồng bộ thủ công) - không reload toàn bộ trang
  const handleSyncFromHeader = useCallback(async () => {
    if (isSyncing) return; // Tránh sync nhiều lần

    setIsSyncing(true);
    await loadSentEmails(undefined, false); // Sync mà không show loading spinner
  }, [isSyncing, loadSentEmails]);

  useEffect(() => {
    // Load sent emails on mount
    loadSentEmails(); // Tải danh sách email đã gửi
  }, [loadSentEmails]);

  //Chọn xem email
  const handleEmailSelect = async (email: Email) => {
    setIsLoadingDetail(true); // Bật loading spinner
    try {
      setShowComposer(false); // Tắt khung soạn thảo đi
      setSelectedEmail(null); // Reset chọn email
      setError(null);

      const detail = await fetchEmailDetail(email.id); // Gọi API lấy nội dung chi tiết

      console.log("Email detail response:", detail);

      const emailData = detail.data || detail;

      // Cập nhật selectedEmail với body và attachments đầy đủ
      setSelectedEmail({
        ...email,
        body: emailData.body || emailData.snippet || "",
        attachments: emailData.attachments || [],
      });
    } catch (error: unknown) {
      console.error("Error loading email detail:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load email detail",
      );
    } finally {
      setIsLoadingDetail(false); // Tắt loading spinner
    }
  };

  //Bấm nút "Soạn thư mới"
  const handleNewEmail = () => {
    setSelectedEmail(null); // Bỏ chọn email đang xem
    setShowComposer(true); // Bật khung soạn thảo lên
  };

  //Gửi email
  const handleSendEmail = async (
    to: string,
    subject: string,
    body: string,
    files?: File[],
  ) => {
    try {
      // 1. Gọi API gửi email
      await sendEmail(to, subject, body, files);

      // 2. Clear draft from localStorage
      localStorage.removeItem("email_draft");

      // 3. Hiện thông báo thành công
      showToast("Email đã được gửi thành công!", "success");

      // 4. Tự động tải lại danh sách để thấy email vừa gửi xuất hiện ngay lập tức
      await loadSentEmails();

      // 5. Đóng khung soạn thảo
      setShowComposer(false);

      return { success: true };
    } catch (error: unknown) {
      console.error("Error sending email:", error);
      throw error;
    }
  };

  const handleLoadMore = () => {
    if (nextPageToken && !isLoadingMore) {
      loadSentEmails(nextPageToken, true);
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
          Hộp thư đã gửi & Soạn thư mới
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Xem nội dung đã gửi hoặc soạn thêm thư mới để AI hiểu phong cách của
          bạn hơn.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <div className="relative flex h-screen flex-col overflow-hidden bg-transparent text-slate-900 2xl:hidden">
        <Header onSync={handleSyncFromHeader} isSyncing={isSyncing} />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="mx-4 my-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-white/70 bg-white/60 backdrop-blur-xl">
            <div className="shrink-0 border-b border-gray-200 p-5 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-blue-500/80">
                    SENT
                  </p>
                  <h2 className="pt-1 text-lg font-semibold text-slate-900">
                    THƯ ĐÃ GỬI
                  </h2>
                </div>
                <div>
                  <button
                    onClick={handleNewEmail}
                    className="text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    title="Soạn email mới"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
              <div className="p-4 shrink-0">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  timeFilter={timeFilter}
                  onTimeFilterChange={setTimeFilter}
                />
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <LoadingSpinner className="h-8 w-8" />
                  </div>
                ) : error ? (
                  <div className="flex h-full items-center justify-center p-4">
                    <div className="text-center">
                      <p className="mb-2 text-red-600">{error}</p>
                      <button
                        onClick={() => loadSentEmails()}
                        className="text-blue-600 hover:underline"
                      >
                        Thử lại
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmailList
                    emails={getFilteredEmails(emails)}
                    selectedEmail={showComposer ? null : selectedEmail}
                    onEmailSelect={handleEmailSelect}
                    onLoadMore={handleLoadMore}
                    hasNextPage={!!nextPageToken}
                    isLoadingMore={isLoadingMore}
                  />
                )}
              </div>
            </div>
          </div>

          {(selectedEmail || showComposer) && (
            <div className="absolute inset-x-4 top-4 bottom-4 z-20 flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-white/70 bg-white/90 shadow-[0_18px_60px_rgba(93,141,255,0.14)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-blue-500/80">
                    {selectedEmail ? "DETAIL" : "COMPOSE"}
                  </p>
                  <h3 className="truncate pt-1 text-base font-semibold text-slate-900">
                    {selectedEmail ? "NỘI DUNG" : "SOẠN THƯ MỚI"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowComposer(false);
                    setSelectedEmail(null);
                  }}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="Đóng"
                >
                  <svg
                    className="h-5 w-5"
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

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div>
                  {isLoadingDetail ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <LoadingSpinner className="mx-auto h-12 w-12" />
                        <p className="mt-4 text-sm text-slate-600">
                          Đang tải...
                        </p>
                      </div>
                    </div>
                  ) : showComposer ? (
                    <EmailComposer onSend={handleSendEmail} />
                  ) : selectedEmail ? (
                    <EmailDetail email={selectedEmail} />
                  ) : (
                    renderEmptyState()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden h-screen bg-transparent text-slate-900 2xl:flex">
        <div className="w-90 mx-4 my-4 flex flex-col overflow-hidden rounded-[18px] border border-white/70 bg-white/60 backdrop-blur-xl">
          <div className="shrink-0 border-b border-gray-200 p-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-blue-500/80">
                  SENT
                </p>
                <h2 className="pt-1 text-lg font-semibold text-slate-900">
                  THƯ ĐÃ GỬI
                </h2>
              </div>
              <div>
                <button
                  onClick={handleNewEmail}
                  className="text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Soạn email mới"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 shrink-0">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                timeFilter={timeFilter}
                onTimeFilterChange={setTimeFilter}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <LoadingSpinner className="h-8 w-8" />
                </div>
              ) : error ? (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center">
                    <p className="mb-2 text-red-600">{error}</p>
                    <button
                      onClick={() => loadSentEmails()}
                      className="text-blue-600 hover:underline"
                    >
                      Thử lại
                    </button>
                  </div>
                </div>
              ) : (
                <EmailList
                  emails={getFilteredEmails(emails)}
                  selectedEmail={showComposer ? null : selectedEmail}
                  onEmailSelect={handleEmailSelect}
                  onLoadMore={handleLoadMore}
                  hasNextPage={!!nextPageToken}
                  isLoadingMore={isLoadingMore}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header onSync={handleSyncFromHeader} isSyncing={isSyncing} />

          <div className="flex-1 flex overflow-hidden px-4 pb-4 pt-4 gap-4">
            <div className="flex-1 w-2xl overflow-hidden rounded-[18px] border border-white/70 bg-white/60 flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {isLoadingDetail ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <LoadingSpinner className="mx-auto h-12 w-12" />
                      <p className="mt-4 text-sm text-slate-600">Đang tải...</p>
                    </div>
                  </div>
                ) : showComposer ? (
                  <EmailComposer onSend={handleSendEmail} />
                ) : selectedEmail ? (
                  <EmailDetail email={selectedEmail} />
                ) : (
                  renderEmptyState()
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
