"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // Dùng để đọc dữ liệu trên thanh địa chỉ (URL)
import Image from "next/image";
import {
  exchangeCodeForToken,
  syncAiData,
  checkSyncStatus,
} from "@/services/api";
import LoadingSpinner from "@/components/LoadingSpinner";

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
        setSyncMessage("Đang xác thực tài khoản...");
        const data = await exchangeCodeForToken(code); // Gọi API gửi code lên server, server sẽ trả về Token đăng nhập

        console.log("Login successful:", data);

        // Check if sync is needed
        setSyncMessage("Đang chuẩn bị không gian làm việc..."); // Đổi thông báo
        const syncStatus = await checkSyncStatus(); // Hỏi server xem user này đã đồng bộ dữ liệu AI chưa

        if (!syncStatus.synced) {
          // Nếu server trả về là chưa đồng bộ
          // Chỉ khởi tạo sync một lần rồi chuyển sang workspace để tránh polling dày trên UI
          setSyncMessage("Đang khởi tạo xử lý dữ liệu từ email đã gửi...");
          await syncAiData(); //gọi Server bắt đầu quá trình đọc email (Vector embedding)

          setSyncMessage(
            "Bắt đầu xử lý dữ liệu ở nền. Đang chuyển vào workspace...",
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
    <div className="relative min-h-screen overflow-hidden px-4 py-8 flex items-center justify-center">
      {/* Background image with softer overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/context.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(247,251,255,0.40)_0%,rgba(237,244,255,0.62)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_40%),radial-gradient(circle_at_bottom,rgba(88,129,255,0.10),transparent_52%)]" />
        <div className="absolute inset-0 bg-slate-900/10" />
      </div>

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/25 bg-white/14 p-8 text-center shadow-[0_8px_40px_rgba(30,60,120,0.55)] backdrop-blur-[18px] ring-1 ring-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.54)_50%,rgba(255,255,255,0.40)_100%)]" />
        <div className="relative">
          {isProcessing ? (
            <>
              <LoadingSpinner className="mx-auto mb-5 h-24 w-24" />
              <p className="mb-3 text-[14px] font-semibold uppercase tracking-[0.28em] text-blue-500/80">
                Xác thực tài khoản
              </p>
              <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-[2rem]">
                {syncMessage.includes("✅") ? "Hoàn tất!" : "Đang xử lý..."}
                {/* Nếu tiến trình đồng bộ thành công thì hiển thị Hoàn tất */}
              </h2>
              <p className="text-sm leading-6 text-slate-700/85 sm:text-base">
                {syncMessage}
              </p>
              {syncMessage.includes("Đang xử lý lấy ngữ cảnh") && (
                <div className="mt-5">
                  <div className="h-2 w-full rounded-full bg-slate-200/70">
                    <div
                      className="h-2 rounded-full bg-linear-to-r from-sky-500 to-blue-500 animate-pulse"
                      style={{ width: "60%" }}
                    ></div>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600/80">
                    Hệ thống đang phân tích email đã gửi để cải thiện chất lượng
                    gợi ý AI. Vui lòng đợi một lát.
                  </p>
                </div>
              )}
            </>
          ) : error ? (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100/80">
                <svg
                  className="h-8 w-8 text-red-500"
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
              <h2 className="mb-2 text-2xl font-semibold tracking-[-0.03em] text-red-800">
                Lỗi xác thực
              </h2>
              <p className="mb-4 text-sm leading-6 text-red-400 sm:text-base">
                {error}
              </p>
              <p className="text-sm text-slate-600/80">
                Đang chuyển hướng về trang đăng nhập...
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
