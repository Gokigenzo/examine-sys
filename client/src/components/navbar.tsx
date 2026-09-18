"use client";

import Link from "next/link";
import { BookOpen, Upload, Home, Target, FileCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Trang chủ", href: "/", icon: Home },
    { name: "Luyện đề ngay", href: "/exam", icon: FileCheck },
    { name: "Tải tài liệu", href: "/upload", icon: Upload },
    { name: "Ôn luyện", href: "/practice", icon: Target },
  ];

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center px-4 justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <BookOpen className="h-6 w-6" />
          <span>Luyện Thi Thông Minh</span>
        </Link>
        <div className="flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                pathname === item.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
