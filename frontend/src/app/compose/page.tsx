'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Email } from '@/types/email';
import EmailList from '@/components/EmailList';
import EmailComposer from '@/components/EmailComposer';
import EmailDetail from '@/components/EmailDetail';
import Header from '@/components/Header';
import { fetchSentEmails, fetchEmailDetail, getAuthToken, sendEmail } from '@/services/api';
import { useToast } from '@/components/ToastContainer';

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

  // Check authentication on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/');
    }
  }, [router]);

  // Load sent emails
  const loadSentEmails = useCallback(async (pageToken?: string, showLoading = true, append = false) => {
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
      
      console.log('Sent emails data:', data);
      
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
      const transformedEmails: Email[] = data.emails.map((email: EmailFromAPI) => {
          console.log('Processing email:', email.id, 'to:', email.to, 'from:', email.from);
          
          // Parse "To" header for sent emails  
          const parseTo = (toHeader?: string) => {
            // Xử lý trường hợp null, undefined hoặc chuỗi rỗng ""
            if (!toHeader || toHeader.trim() === '') {
              return { 
                name: 'Người nhận ẩn danh (BCC)', 
                email: 'Không hiển thị' 
              };
            }

            // Extract first recipient only (if multiple recipients)
            const firstRecipient = toHeader.split(',')[0].trim();
            
            // Check if has <email> format
            // Logic Regex tương tự file Workspace: Tách Tên và Email
            const emailMatch = firstRecipient.match(/<(.+?)>/);
            
            if (emailMatch) {
              // Format: "Name <email@domain.com>"
              const emailAddr = emailMatch[1].trim();
              let name = firstRecipient.replace(/<.*>/, '').trim();
              // Remove surrounding quotes (both single and double)
              name = name.replace(/^["']|["']$/g, '');
              // If name is empty, use email username
              name = name || emailAddr.split('@')[0];
              return { name, email: emailAddr };
            } else {
              // Plain email address: "email@domain.com"
              const emailAddr = firstRecipient.trim();
              const name = emailAddr.split('@')[0];
              return { name, email: emailAddr };
            }
          };

          // For sent emails, use "to" field to show recipient
          // Lấy thông tin người nhận
          const { name: recipientName, email: recipientEmail } = parseTo(email.to);

          return {
            id: email.id,
            sender: recipientName,
            senderEmail: recipientEmail,
            subject: email.subject?.trim() || '(No Subject)',
            snippet: email.snippet || '',
            body: email.snippet || '',
            timestamp: email.date || new Date().toISOString(),
          };
        });
      
      if (append) {
        setEmails(prev => [...prev, ...transformedEmails]);
      } else {
        setEmails(transformedEmails);
      }
      
      // Lưu token trang sau
      // Backend có thể trả về nextPageToken hoặc next_page_token
      setNextPageToken(data.nextPageToken || data.next_page_token || null);
      // console.log('Next page token:', data.nextPageToken || data.next_page_token);
    } catch (error: any) {
      console.error('Error loading sent emails:', error);
      setError(error.message || 'Failed to load sent emails');
      
      if (error.message.includes('Authentication expired')) {
        router.push('/');
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
      setIsLoadingMore(false);
    }
  }, [router]);

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
      
      console.log('Email detail response:', detail);
      
      const emailData = detail.data || detail;
      
      // Cập nhật selectedEmail với body và attachments đầy đủ
      setSelectedEmail({
        ...email,
        body: emailData.body || emailData.snippet || '',
        attachments: emailData.attachments || [],
      });
    } catch (error: any) {
      console.error('Error loading email detail:', error);
      setError(error.message || 'Failed to load email detail');
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
  const handleSendEmail = async (to: string, subject: string, body: string, files?: File[]) => {
    try {

      // 1. Gọi API gửi email
      await sendEmail(to, subject, body, files);
      
      // 2. Clear draft from localStorage
      localStorage.removeItem('email_draft');
      
      // 3. Hiện thông báo thành công
      showToast('Email đã được gửi thành công!', 'success');
      
      // 4. Tự động tải lại danh sách để thấy email vừa gửi xuất hiện ngay lập tức 
      await loadSentEmails();
      
      // 5. Đóng khung soạn thảo
      setShowComposer(false);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error sending email:', error);
      throw error;
    }
  };

  const handleLoadMore = () => {
    if (nextPageToken && !isLoadingMore) {
      loadSentEmails(nextPageToken, true);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Left Panel - Email List */}
      <div className="w-90 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 py-0.5">Hộp thư đã gửi</h2>
          <button
            onClick={handleNewEmail}
            className="text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Soạn email mới"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
          
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center">
                <p className="text-red-600 mb-2">{error}</p>
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
              emails={emails}
              selectedEmail={showComposer ? null : selectedEmail}
              onEmailSelect={handleEmailSelect}
              onLoadMore={handleLoadMore}
              hasNextPage={!!nextPageToken}
              isLoadingMore={isLoadingMore}
            />
          )}
        </div>
      </div>

      {/* Right Content Area with Header */}
      <div className="flex-1 flex flex-col overflow-hidden">
          <Header onSync={handleSyncFromHeader} isSyncing={isSyncing} />
        <div className="flex-1 bg-white overflow-hidden">
          {showComposer ? (
            <EmailComposer onSend={handleSendEmail} />
          ) : isLoadingDetail ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-gray-500">Đang tải email...</p>
              </div>
            </div>
          ) : selectedEmail ? (
            <EmailDetail email={selectedEmail} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-lg">Chọn một email để xem hoặc nhấn + để soạn email mới</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

  );
}
