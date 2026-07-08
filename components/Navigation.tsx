"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/AuthContext";
import { useWaitlist } from "@/components/WaitlistContext";

const navLinks = [
  { label: "Why", href: "/#why" },
  { label: "What's Inside", href: "/#inside" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Navigation() {
  const { user, openAuth, logout } = useAuth();
  const { openWaitlist } = useWaitlist();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6 md:px-10 xl:px-20">
        <Link
          href="/"
          className="font-sardin text-lg font-bold uppercase tracking-tight text-foreground transition-colors hover:text-muted-foreground"
        >
          Layrrrd.
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Account menu">
                <Avatar>
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  render={<Link href="/dashboard" />}
                >
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<Link href="/dashboard/profile" />}
                >
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                >
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openAuth("sign-in")}
              >
                Log In
              </Button>
              <Button size="sm" onClick={openWaitlist}>
                Join Waitlist
              </Button>
            </>
          )}
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-label="Toggle menu"
            className="flex flex-col gap-1.5 md:hidden"
          >
            <span className="h-px w-6 bg-foreground" />
            <span className="h-px w-6 bg-foreground" />
          </SheetTrigger>
          <SheetContent side="right" className="w-3/4 sm:max-w-xs">
            <SheetHeader>
              <SheetTitle className="font-sans text-base normal-case tracking-tight font-bold">
                Layrrrd.
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-5 px-8 text-sm text-muted-foreground">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 p-8">
              {user ? (
                <>
                  <div className="mb-2 flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-bold text-foreground">
                      {user.name}
                    </span>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setMenuOpen(false)}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Profile Settings
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                      router.push("/");
                    }}
                  >
                    Log Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setMenuOpen(false);
                      openAuth("sign-in");
                    }}
                  >
                    Log In
                  </Button>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setMenuOpen(false);
                      openWaitlist();
                    }}
                  >
                    Join Waitlist
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
