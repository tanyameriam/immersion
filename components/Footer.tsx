import Link from "next/link";
import { FadeUp } from "@/components/FadeUp";

const links = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund" },
  { label: "Contact", href: "/#contact" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-16">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 xl:px-20">
        <FadeUp>
          <div className="flex flex-col gap-8 pb-8 md:flex-row md:items-start md:justify-between">
            <div>
              <Link
                href="/"
                className="font-sardin text-lg font-bold uppercase tracking-tight text-foreground transition-colors hover:text-muted-foreground"
              >
                Layrrrd.
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">
                Never lose a good read again.
              </p>
            </div>

            <nav className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-t border-border pt-8">
            <p className="text-[13px] text-[#999999]">
              © {year} Layrrrd. Based in India.
            </p>
          </div>
        </FadeUp>
      </div>
    </footer>
  );
}
