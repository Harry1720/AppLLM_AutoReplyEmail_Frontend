"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchUserProfile, logout, getAuthToken } from "@/services/api";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useConfirm } from "./ConfirmDialogContainer";

interface HeaderProps {
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
}

export default function Header({ onSync, isSyncing = false }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { confirm } = useConfirm();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    id: string;
    email: string;
    name: string;
    picture?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const avatarBtnRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        return;
      }

      const profile = await fetchUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsClick = () => {
    setShowUserMenu(false);
    router.push("/settings");
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    const confirmed = await confirm({
      title: "Đăng xuất",
      message: "Bạn có chắc chắn muốn đăng xuất?",
      confirmText: "Đăng xuất",
      cancelText: "Hủy",
      type: "warning",
    });

    if (confirmed) {
      logout();
      router.push("/");
    }
  };

  const handleSync = async () => {
    if (onSync && !isSyncing) {
      await onSync();
    }
  };

  // Update menu position when showing the menu
  useEffect(() => {
    if (showUserMenu && avatarBtnRef.current) {
      const rect = avatarBtnRef.current.getBoundingClientRect();
      const menuWidth = 256; // w-64
      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      const top = rect.bottom + 8;
      setMenuPos({ top, left });
    } else {
      setMenuPos(null);
    }
  }, [showUserMenu]);

  return (
    <header className="relative mx-4 mt-4 overflow-hidden rounded-[24px] border border-white/60 bg-white/70 px-6 py-4 shadow-[0_12px_40px_rgba(93,141,255,0.10)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(122,168,255,0.2),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(93,141,255,0.12),_transparent_28%)]" />
      <div className="relative flex items-center justify-between gap-4">
        {/* Logo and Title */}
        <div className="flex items-center space-x-3">
          <div className="mx-auto mb-0 flex h-12 w-12 items-center justify-center">
            <Image
              src="/logo_tab.png"
              alt="Logo"
              width={40}
              height={40}
              priority
              className="brightness-0 drop-shadow-sm"
            />
          </div>

          <div className="ml-4">
            <h1 className="font-semibold text-slate-900">
              Trợ lý Email thông minh
            </h1>
          </div>
        </div>

        {/* Navigation - Centered */}
        <nav className="absolute left-1/2 flex -translate-x-1/2 items-center space-x-3">
          <button
            onClick={() => router.push("/workspace")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              pathname === "/workspace"
                ? "bg-linear-to-r from-blue-600 to-indigo-500 text-white shadow-[0_0px_24px_rgba(93,141,255,0.9)]"
                : "text-slate-600 hover:bg-blue-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg
                className="w-4 h-4"
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
              <span>Trả lời email với AI</span>
            </div>
          </button>

          <button
            onClick={() => router.push("/compose")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              pathname === "/compose"
                ? "bg-linear-to-r from-blue-600 to-indigo-500 text-white shadow-[0_0px_24px_rgba(93,141,255,0.9)]"
                : "text-slate-600 hover:bg-blue-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span>Soạn email mới</span>
            </div>
          </button>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center space-x-4">
          {/* Sync button */}
          {onSync && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="rounded-xl border border-white/60 bg-white/65 p-2 text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:text-slate-700 hover:shadow-[0_8px_20px_rgba(93,141,255,0.10)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={isSyncing ? "Đang đồng bộ..." : "Đồng bộ email"}
            >
              <svg
                className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`}
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
            </button>
          )}

          {/* User menu */}
          <div className="relative">
            {isLoading ? (
              <div className="flex items-center space-x-2 p-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              </div>
            ) : (
              <>
                <button
                  ref={(el) => {
                    avatarBtnRef.current = el;
                  }}
                  onClick={() => setShowUserMenu((s) => !s)}
                  className="flex items-center space-x-2 rounded-xl border border-white/60 bg-white/65 p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(93,141,255,0.10)] cursor-pointer"
                >
                  <div className="w-8 h-8 bg-linear-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center overflow-hidden">
                    {userProfile?.picture ? (
                      <Image
                        src={userProfile.picture}
                        alt={userProfile.name}
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-white">
                        {userProfile?.name?.charAt(0).toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showUserMenu &&
                  avatarBtnRef.current &&
                  typeof document !== "undefined" &&
                  createPortal(
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div
                        style={{
                          position: "fixed",
                          top: menuPos ? menuPos.top : 0,
                          left: menuPos ? menuPos.left : 0,
                          width: 256,
                        }}
                        className="z-40"
                      >
                        <div className="rounded-2xl border border-white/70 bg-white/95 shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                          <div className="py-1">
                            <div className="px-4 py-3 border-b border-slate-100">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-linear-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                                  {userProfile?.picture ? (
                                    <Image
                                      src={userProfile.picture}
                                      alt={userProfile.name}
                                      width={40}
                                      height={40}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-white font-medium">
                                      {userProfile?.name
                                        ?.charAt(0)
                                        .toUpperCase() || "U"}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">
                                    {userProfile?.name || "Người dùng"}
                                  </p>
                                  <p className="text-sm text-gray-500 truncate">
                                    {userProfile?.email || "email@example.com"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={handleSettingsClick}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 flex items-center space-x-2 cursor-pointer"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              <span>Cài đặt</span>
                            </button>

                            <button
                              onClick={handleLogout}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 border-t border-slate-100 cursor-pointer"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                />
                              </svg>
                              <span>Đăng xuất</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>,
                    document.body,
                  )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
