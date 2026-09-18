"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Upload,
  Home,
  Target,
  FileCheck,
  User as UserIcon,
  LogIn,
  LogOut,
  Sparkles,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import AuthModal from "./auth-modal";
import { Button } from "./ui/button";

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  const navItems = [
    { name: "Trang chủ", href: "/", icon: Home },
    { name: "Luyện đề ngay", href: "/exam", icon: FileCheck },
    { name: "Tải tài liệu", href: "/upload", icon: Upload },
    { name: "Ôn luyện", href: "/practice", icon: Target },
  ];

  return (
    <>
      <nav className="border-b bg-white sticky top-0 z-30 shadow-xs">
        <div className="container mx-auto flex h-16 items-center px-4 justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg sm:text-xl text-primary flex-shrink-0"
          >
            <div className="p-1.5 bg-blue-600 text-white rounded-xl">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="hidden sm:inline">Luyện Thi Thông Minh</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1 sm:gap-5 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-2.5 py-1.5 rounded-lg transition-colors",
                  pathname === item.href
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.name}</span>
              </Link>
            ))}
          </div>

          {/* User Auth Section */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs sm:text-sm font-semibold",
                    pathname === "/profile"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800"
                  )}
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {user.full_name ? user.full_name[0].toUpperCase() : "U"}
                  </div>
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {user.full_name}
                  </span>
                </Link>

                <button
                  onClick={logout}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAuthTab("login");
                    setAuthModalOpen(true);
                  }}
                  className="text-xs sm:text-sm font-semibold border-slate-300"
                >
                  <LogIn className="w-4 h-4 mr-1.5 hidden sm:inline" />
                  Đăng nhập
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setAuthTab("register");
                    setAuthModalOpen(true);
                  }}
                  className="text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-700"
                >
                  Đăng ký
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Auth Modal Popup */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authTab}
      />
    </>
  );
}
