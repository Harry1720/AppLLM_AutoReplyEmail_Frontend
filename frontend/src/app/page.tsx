"use client";
//báo hiệu file này là Client Component vì trang này có tương tác  và dùng Hook nên nó phải chạy ở trình duyệt (Client) chứ không phải Server.
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; //điều hướng chuyển trang
import Image from "next/image";
import { getAuthToken } from "@/services/api";

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect to workspace if already logged in
  useEffect(() => {
    const token = getAuthToken(); //Gọi hàm lấy token xem người dùng đã đăng nhập từ trước chưa.
    if (token) {
      router.push("/workspace");
    }
  }, [router]);

  const handleGoogleLogin = () => {
    setIsLoading(true); //Ngay khi bấm, bật chế độ "đang tải"

    // Google OAuth URL with all required parameters
    const googleAuthUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        //Tạo đường link chuẩn OAuth2 của Google.
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "", //Định danh ứng dụng
        redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || "", //Địa chỉ mà Google sẽ trả người dùng về sau khi đăng nhập xong
        response_type: "code", //Yêu cầu Google trả về một mã định danh (auth code).
        scope:
          "email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify",
        /**email, profile: Lấy tên, avatar.
        ...gmail.readonly: Quyền đọc email.
        ...gmail.send: Quyền gửi email thay người dùng.
        ...gmail.modify: Quyền sửa/xóa email. */
        access_type: "offline",
        prompt: "select_account", //Luôn hiện bảng chọn tài khoản
      }).toString();

    // Redirect to Google OAuth
    window.location.href = googleAuthUrl; //trình duyệt chuyển hướng sang trang của Google (theo chuẩn OAuth2 tạo ở trên).
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      {/* Background Image with Blur */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/login.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Glass Morphism Container */}
      <div className="max-w-2xl w-full space-y-8 text-center relative z-10 backdrop-blur-md bg-white/20 rounded-3xl border border-white/20 sm:p-12 pt-12 pb-12 pl-8 pr-8 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <div className="space-y-4">
          {/* Logo */}
          <div className="mx-auto -mb-8 -mt-20 flex items-center justify-center w-64 h-64 drop-shadow-xl/75">
            <Image
              src="/logo.png"
              alt="Logo"
              width={280}
              height={280}
              className="rounded-2xl"
              priority //priority giúp ảnh này được tải ưu tiên
            />
          </div>

          {/* App Name & Description */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3 drop-shadow-lg">
              Trợ lý Email thông minh
            </h1>
            {/* <p className="text-gray-800 text-1xl font-medium drop-shadow">
             Trả lời email tự động với Trí tuệ nhân tạo
            </p> */}
          </div>

          {/* Features */}
          <div className="mx-auto w-fit max-w-xl">
            <div className="feature-list space-y-3 text-lr text-lg text-gray-900 font-medium">
              <div className="flex items-center space-x-2 text-gray-700 font-medium hover:text-gray-900 ">
                <span className="text-blue-500">🎯</span>
                <span>Phân tích ngữ cảnh</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700 font-medium hover:text-gray-900">
                <span className="text-green-500">✨</span>
                <span>Gợi ý trả lời các email với AI</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700 font-medium hover:text-gray-900">
                <span className="text-purple-500">⚡</span>
                <span>Kết nối Gmail để bắt đầu</span>
              </div>
            </div>
          </div>
        </div>

        {/* Google Login Button */}
        <div className="">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading} //Nếu đang tải (isLoading là true) thì nút bị vô hiệu hóa
            className="mx-auto bg-white/90 backdrop-blur-sm border border-white/30 rounded-lg py-4 w-[90%] text-gray-800 font-medium hover:bg-[#faf5f5] focus:outline-none focus:ring-2 focus:ring-gray-50 focus:ring-offset-2 transition duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-blue-200 hover:shadow-xl hover:-translate-y-1 ]"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  width="32px"
                  height="32px"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-18.55z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.55 10.78l7.98-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>

                <span className="font-semibold">Đăng nhập bằng Google</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="pt-2 text-1xl -mt-5 text-gray-900 font-medium drop-shadow">
          <p>
            Bằng cách đăng nhập, bạn đồng ý với điều khoản sử dụng của chúng
            tôi.
          </p>
        </div>
        {/* <div className="pt-2 text-1xl text-black">
          <p>Thực hiện: Quốc Bảo - Thái Bình.</p>
        </div> */}
      </div>
    </div>
  );
}
