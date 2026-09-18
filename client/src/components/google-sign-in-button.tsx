"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Loader2, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => Promise<void> | void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export default function GoogleSignInButton({
  onSuccess,
  onError,
  disabled = false,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    // If window.google already exists (e.g. loaded earlier)
    if (typeof window !== "undefined" && window.google?.accounts?.id) {
      setScriptLoaded(true);
    }
  }, []);

  const handleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) {
      if (onError) onError("Không nhận được chứng thực từ Google.");
      return;
    }

    try {
      setLoading(true);
      await onSuccess(response.credential);
    } catch (err: any) {
      if (onError) onError(err.message || "Đăng nhập Google thất bại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!scriptLoaded || !clientId || !containerRef.current) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Clear previous button render if any
      containerRef.current.innerHTML = "";

      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 380,
      });
    } catch (err) {
      console.error("Lỗi khởi tạo Google Sign-In:", err);
    }
  }, [scriptLoaded, clientId]);

  const handleFallbackClick = () => {
    if (!clientId) {
      setShowConfigHelp(true);
      return;
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch (err) {
        console.error("Lỗi gọi Google prompt:", err);
      }
    }
  };

  return (
    <div className="w-full space-y-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      {loading ? (
        <div className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin mr-2 text-blue-600" />
          Đang xác thực tài khoản Google...
        </div>
      ) : clientId && scriptLoaded ? (
        <div className="w-full flex justify-center overflow-hidden min-h-[44px]">
          <div ref={containerRef} className="w-full flex justify-center" />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={disabled || loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-all shadow-xs active:scale-[0.99]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.14 0 9.99 0 12s.45 3.86 1.24 5.42l4.04-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>Tiếp tục với Google</span>
        </button>
      )}

      {showConfigHelp && !clientId && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1 animate-in fade-in">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            Cần cấu hình Google Client ID
          </div>
          <p className="text-[11px] leading-relaxed text-amber-700">
            Hệ thống đã sẵn sàng kết nối Google. Vui lòng thêm biến{" "}
            <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">
              NEXT_PUBLIC_GOOGLE_CLIENT_ID
            </code>{" "}
            vào file <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">client/.env.local</code> hoặc cài đặt trên Vercel.
          </p>
        </div>
      )}
    </div>
  );
}
