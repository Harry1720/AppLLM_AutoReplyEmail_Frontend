"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // Dùng để đọc dữ liệu trên thanh địa chỉ (URL)
import Image from "next/image";
import {
  exchangeCodeForToken,
  syncAiData,
  checkSyncStatus,
} from "@/services/api";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [syncMessage, setSyncMessage] = useState<string>("Đang xác thực...");
  const hasHandledCallback = useRef(false);

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }

    hasHandledCallback.current = true;

    const handleCallback = async () => {
      // Get the authorization code from URL
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");

      // Nếu Google báo lỗi hoặc không tìm thấy code -> Báo lỗi và chuyển về trang chủ sau 3s
      if (errorParam) {
        setError("Đăng nhập bị hủy hoặc thất bại");
        setIsProcessing(false);
        setTimeout(() => {
          router.push("/");
        }, 3000);
        return;
      }

      if (!code) {
        setError("Không tìm thấy mã xác thực");
        setIsProcessing(false);
        setTimeout(() => {
          router.push("/");
        }, 3000);
        return;
      }

      try {
        // Exchange code for token
        setSyncMessage("Đang xác thực...");
        const data = await exchangeCodeForToken(code); // Gọi API gửi code lên server, server sẽ trả về Token đăng nhập

        console.log("Login successful:", data);

        // Check if sync is needed
        setSyncMessage("Kiểm tra ngữ cảnh..."); // Đổi thông báo
        const syncStatus = await checkSyncStatus(); // Hỏi server xem user này đã đồng bộ dữ liệu AI chưa

        if (!syncStatus.synced) {
          // Nếu server trả về là chưa đồng bộ
          // Chỉ khởi tạo sync một lần rồi chuyển sang workspace để tránh polling dày trên UI
          setSyncMessage("Đang khởi tạo xử lý ngữ cảnh từ email đã gửi...");
          await syncAiData(); //gọi Server bắt đầu quá trình đọc email (Vector embedding)

          setSyncMessage(
            "Bắt đầu xử lý ngữ cảnh ở nền. Đang chuyển vào workspace...",
          );
        } else {
          setSyncMessage(`✅ Đã có ngữ cảnh`);
        }

        // Wait a moment before redirect
        await new Promise((resolve) => setTimeout(resolve, 1000)); //Chờ 1 giây để người dùng thấy UI "Đã lấy ngữ cảnh" trước khi chuyển trang.

        // Redirect to workspace
        router.push("/workspace");
      } catch (err: unknown) {
        //Nếu bất kỳ lệnh await nào ở trên bị lỗi -> nhảy thẳng xuống đây
        console.error("Authentication error:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Đăng nhập thất bại. Vui lòng thử lại.";
        setError(errorMessage);
        setIsProcessing(false);
        setTimeout(() => {
          router.push("/");
        }, 3000);
      }
    };

    handleCallback(); // Gọi hàm async vừa định nghĩa ở trên để nó bắt đầu chạy
  }, [searchParams, router]); // useEffect sẽ chạy lại nếu searchParams hoặc router thay đổi (thực tế chỉ chạy 1 lần khi load trang)

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/context.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-white/30"></div>
      </div>

      <div className="max-w-md w-full bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-8 text-center relative z-10">
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {syncMessage.includes("✅") ? "Hoàn tất!" : "Đang xử lý..."}
              {/* Nếu tiến trình đồng bộ thành công thì hiển thị Hoàn tất */}
            </h2>
            <p className="text-gray-600">{syncMessage}</p>
            {syncMessage.includes("Đang xử lý lấy ngữ cảnh") && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full animate-pulse"
                    style={{ width: "60%" }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Hệ thống đang phân tích email đã gửi để cải thiện chất lượng
                  gợi ý AI. Vui lòng đợi một lát.
                </p>
              </div>
            )}
          </>
        ) : error ? (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-500"
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
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Lỗi xác thực
            </h2>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              Đang chuyển hướng về trang chủ...
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
