"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type PreviewState = {
  name: string;
  email: string;
  photo: string | null;
  topics: string[];
  channel: "email" | "telegram";
  telegramHandle: string;
  day: string;
};

function initials(name: string, email: string) {
  const base = name.trim() || email.trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : base.slice(0, 2);
  return letters.toUpperCase();
}

/** Live "this is what you're setting up" card shown beside the onboarding steps. */
export function ProfilePreview({ state }: { state: PreviewState }) {
  const { name, email, photo, topics, channel, telegramHandle, day } = state;

  const delivery =
    channel === "telegram"
      ? `Telegram${telegramHandle ? ` ${telegramHandle}` : ""}`
      : "Email";

  return (
    <div className="w-full max-w-sm border border-border bg-card p-8">
      <p className="text-[13px] uppercase tracking-widest text-muted-foreground">
        Your profile
      </p>

      <div className="mt-6 flex items-center gap-4">
        <Avatar size="lg">
          {photo ? <AvatarImage src={photo} alt={name} /> : null}
          <AvatarFallback>{initials(name, email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">
            {name || "Your name"}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {email || "you@example.com"}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <p className="text-[13px] uppercase tracking-widest text-muted-foreground">
          Interests
        </p>
        {topics.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map((topic) => (
              <span
                key={topic}
                className="border border-border px-2.5 py-1 text-xs text-foreground"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Pick a few topics you want to see more of.
          </p>
        )}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <p className="text-[13px] uppercase tracking-widest text-muted-foreground">
          Weekly digest
        </p>
        <p className="mt-2 text-sm text-foreground">
          Every <span className="font-medium">{day}</span> via{" "}
          <span className="font-medium">{delivery}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Delivered at 8:00 AM UTC.</p>
      </div>
    </div>
  );
}
