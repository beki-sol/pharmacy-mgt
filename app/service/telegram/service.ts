// services/telegram/service.ts

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface SendMessageParams {
  chatId: string;      // Telegram chat ID (can be user or group)
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  disableNotification?: boolean;
}

export async function sendTelegramMessage({
  chatId,
  text,
  parseMode = 'HTML',
  disableNotification = false,
}: SendMessageParams): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_notification: disableNotification,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

// Helper to send to multiple users
export async function sendTelegramToUsers(users: { telegramChatId: string | null }[], text: string) {
  const promises = users
    .filter(user => user.telegramChatId)
    .map(user => sendTelegramMessage({ chatId: user.telegramChatId!, text }));
  return Promise.all(promises);
}

// Helper to send to a default admin group (configured via env)
export async function sendTelegramToAdminGroup(text: string) {
  const groupChatId = process.env.TELEGRAM_ADMIN_GROUP_CHAT_ID;
  if (!groupChatId) return false;
  return sendTelegramMessage({ chatId: groupChatId, text });
}