"use client";

import { useEffect, useRef, useState } from "react";
import { Blocks, Mail, MessageCircle, Send, Users } from "lucide-react";
import { TelegramConnect } from "@/components/TelegramConnect";
import { WhatsAppConnect } from "@/components/WhatsAppConnect";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/hooks/use-preferences";

const CHANNELS = [
  { key: "telegram", label: "Telegram", icon: Send, enabled: true },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, enabled: true },
  { key: "email", label: "Email", icon: Mail, enabled: false },
  { key: "teams", label: "Teams", icon: Users, enabled: false },
  { key: "slack", label: "Slack", icon: Blocks, enabled: false },
] as const;

type ChatChannel = "telegram" | "whatsapp";

/**
 * Dashboard prompt to hook up a chat channel (the core save-from-anywhere
 * loop). Stays visible until Telegram or WhatsApp is linked. When a link
 * completes here, that channel also becomes the digest channel, since that
 * was the user's evident intent.
 */
export function ChannelConnectCard() {
  const { prefs, loaded, save, reload } = usePreferences();
  const [open, setOpen] = useState<ChatChannel | null>(null);
  const wasUnlinked = useRef(false);

  const linkedChannel: ChatChannel | null = prefs.telegramChatId
    ? "telegram"
    : prefs.whatsappWaId
      ? "whatsapp"
      : null;

  useEffect(() => {
    if (!loaded) return;
    if (!linkedChannel) {
      wasUnlinked.current = true;
      return;
    }
    // Linked while this card was showing: make that channel the digest one.
    if (
      wasUnlinked.current &&
      prefs.notificationPreference !== linkedChannel
    ) {
      wasUnlinked.current = false;
      void save({ notificationPreference: linkedChannel });
    }
  }, [loaded, linkedChannel, prefs.notificationPreference, save]);

  if (!loaded || linkedChannel) return null;

  return (
    <div className="border border-border bg-card px-5 py-4">
      <p className="text-sm font-bold text-foreground">
        Where should Rudolf reach you?
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect a chat channel to save links from anywhere and get your weekly
        digest there. More channels are on the way.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {CHANNELS.map(({ key, label, icon: Icon, enabled }) => {
          if (!enabled) {
            return (
              <span
                key={key}
                title="Coming soon"
                className="flex cursor-default items-center gap-1.5 border border-border px-3 py-1.5 text-sm text-muted-foreground opacity-60"
              >
                <Icon className="size-4" />
                {label}
                <span className="text-[10px] uppercase tracking-wide">soon</span>
              </span>
            );
          }
          return (
            <Button
              key={key}
              size="sm"
              variant={open === key ? "default" : "outline"}
              onClick={() => setOpen((v) => (v === key ? null : key))}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          );
        })}
      </div>

      {open === "telegram" && (
        <div className="mt-4">
          <TelegramConnect
            chatId={prefs.telegramChatId}
            refresh={reload}
            onDisconnect={() => void save({ telegramChatId: "" })}
          />
        </div>
      )}
      {open === "whatsapp" && (
        <div className="mt-4">
          <WhatsAppConnect
            waId={prefs.whatsappWaId}
            refresh={reload}
            onDisconnect={() => void save({ whatsappWaId: "" })}
          />
        </div>
      )}
    </div>
  );
}
