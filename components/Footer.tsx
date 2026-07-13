import Link from "next/link";
import { FadeUp } from "@/components/FadeUp";

const links = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund Policy", href: "/refund" },
  { label: "Contact", href: "/#contact" },
];

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

const socialLinks = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/layrrrd/",
    Icon: LinkedinIcon,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/layrrrd?igsh=MWFzcnV5ZTJ2cGZ6cQ==",
    Icon: InstagramIcon,
  },
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
                Keep up, without keeping track.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-8">
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

              <div className="flex items-center gap-4 text-muted-foreground">
                {socialLinks.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="transition-colors hover:text-foreground"
                  >
                    <Icon className="size-5" />
                  </a>
                ))}
              </div>
            </div>
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
