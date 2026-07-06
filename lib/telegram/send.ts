/**
 * Send a message via the Telegram Bot API (free). No-ops gracefully if the bot
 * token or chat id is missing so the digest job never hard-fails on config.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;

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
    return res.ok;
  } catch (err) {
    console.error("Telegram send failed", err);
    return false;
  }
}
