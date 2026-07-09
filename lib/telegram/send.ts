/**
 * Send a message via the Telegram Bot API (free). No-ops gracefully if the bot
 * token or chat id is missing so the digest job never hard-fails on config.
 * Retries once on transient network errors.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        },
      );
      return res.ok; // an HTTP error response isn't transient — don't retry
    } catch (err) {
      console.error(`Telegram send failed (attempt ${attempt})`, err);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return false;
}

/** Show "typing…" in the chat — makes multi-message replies feel human. */
export async function sendTelegramTyping(chatId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });
  } catch {
    // cosmetic only — never fail the reply over it
  }
}
