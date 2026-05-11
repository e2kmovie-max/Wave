/**
 * Minimal RU/EN translation helper shared between the bot and the web app.
 *
 * Stage 4 introduces RU+EN strings selected by Telegram `language_code` (`ru*`
 * → RU, anything else → EN). Stage 5 will widen this to the web app with
 * `Accept-Language` autodetect and a richer string table.
 *
 * Strings are stored as a flat record so adding a new key is a one-liner that
 * the TS compiler immediately enforces on every `t()` call site.
 */

export type Lang = "ru" | "en";

const strings = {
  "common.back": { ru: "← Назад", en: "← Back" },
  "common.cancel": { ru: "Отмена", en: "Cancel" },
  "common.added": { ru: "Добавлено.", en: "Added." },
  "common.removed": { ru: "Удалено.", en: "Removed." },
  "common.disabled": { ru: "Отключено.", en: "Disabled." },
  "common.enabled": { ru: "Включено.", en: "Enabled." },
  "common.error_generic": {
    ru: "Что-то пошло не так. Попробуй ещё раз.",
    en: "Something went wrong. Try again.",
  },
  "common.not_admin": {
    ru: "Эта команда только для администраторов.",
    en: "This command is for admins only.",
  },

  "start.greeting_title": {
    ru: "<b>Wave</b> — смотрим видео вместе.",
    en: "<b>Wave</b> — watch videos together.",
  },
  "start.greeting_body": {
    ru: "Пришли мне ссылку на YouTube — соберу комнату для совместного просмотра.",
    en: "Send me a YouTube link and I'll spin up a watch-room for you and your friends.",
  },
  "start.admin_hint": {
    ru: "Ты администратор. /admin откроет панель управления.",
    en: "You're an admin. /admin opens the control panel.",
  },
  "start.payload_no_room": {
    ru: "Ты пришёл с приглашением, но комнаты для него уже нет.",
    en: "You arrived with an invite, but the room for it is no longer active.",
  },
  "start.room_ready": {
    ru: "Комната готова:",
    en: "Room is ready:",
  },
  "start.open_room_btn": {
    ru: "Открыть комнату",
    en: "Open room",
  },

  "room.send_video_url": {
    ru: "Пришли мне ссылку на видео (например, с YouTube), и я создам комнату.",
    en: "Send me a video URL (YouTube etc.) and I'll start a watch room.",
  },
  "room.identify_failed": {
    ru: "Не удалось определить твою учётку Wave. Нажми /start и попробуй снова.",
    en: "I could not identify your Wave account. Press /start and try again.",
  },
  "room.preparing": {
    ru: "Готовлю комнату для просмотра…",
    en: "Preparing your watch room…",
  },
  "room.create_failed": {
    ru: "Не получилось создать комнату для этой ссылки. Попробуй позже.",
    en: "Could not create a room for this URL. Try again later.",
  },
  "room.ready_open": {
    ru: "Комната готова.\n\nОткрыть: {webUrl}\nПригласить: {invite}",
    en: "Room is ready.\n\nOpen: {webUrl}\nInvite: {invite}",
  },

  "op.title": {
    ru: "Подпишись на каналы, чтобы продолжить",
    en: "Subscribe to continue",
  },
  "op.continue_btn": {
    ru: "✅ Я подписался — продолжить",
    en: "✅ I subscribed — continue",
  },
  "op.still_missing": {
    ru: "Не все подписки оформлены. Подпишись и нажми «продолжить» ещё раз.",
    en: "Some subscriptions are still missing. Subscribe and press “continue” again.",
  },
  "op.passed": {
    ru: "Готово, ты подписан.",
    en: "Great — you're subscribed.",
  },
  "op.no_pending": {
    ru: "Нет отложенных действий после проверки подписки.",
    en: "No pending action after the subscription check.",
  },

  "admin.menu_title": {
    ru: "Панель администратора Wave",
    en: "Wave admin panel",
  },
  "admin.menu_channels": {
    ru: "📢 Обязательные каналы",
    en: "📢 Required channels",
  },
  "admin.menu_cookies": {
    ru: "🍪 Пул Google-куки",
    en: "🍪 Google cookie pool",
  },
  "admin.menu_instances": {
    ru: "🎬 Инстансы",
    en: "🎬 Streaming instances",
  },
  "admin.menu_close": {
    ru: "Закрыть",
    en: "Close",
  },

  "admin.channels.title": {
    ru: "Обязательные каналы для просмотра.",
    en: "Required channels for watch rooms.",
  },
  "admin.channels.empty": {
    ru: "Список пуст. Добавь первый канал.",
    en: "No channels yet. Add the first one.",
  },
  "admin.channels.add_prompt": {
    ru:
      "Перешли мне сообщение из канала ИЛИ пришли публичный username (например @wave_news) или числовой chat_id (-100…).",
    en:
      "Forward me a message from the channel OR send a public username (e.g. @wave_news) or a numeric chat_id (-100…).",
  },
  "admin.channels.add_btn": { ru: "➕ Добавить канал", en: "➕ Add channel" },
  "admin.channels.invalid": {
    ru:
      "Не распознал канал. Перешли сообщение из канала или пришли @username / -100…",
    en:
      "Could not parse that channel. Forward a message from the channel or send @username / -100…",
  },
  "admin.channels.duplicate": {
    ru: "Этот канал уже в списке.",
    en: "That channel is already in the list.",
  },

  "admin.cookies.title": {
    ru: "Пул Google-куки для yt-dlp. Активные ротируются автоматически по LRU.",
    en: "Google cookie pool for yt-dlp. Active records rotate LRU.",
  },
  "admin.cookies.empty": {
    ru: "Куки не загружены. Без них YouTube будет работать только в ограниченном режиме.",
    en: "No cookies uploaded. YouTube downloads will be limited without them.",
  },
  "admin.cookies.add_btn": { ru: "➕ Добавить куки", en: "➕ Add cookies" },
  "admin.cookies.label_prompt": {
    ru: "Пришли подпись (label) для этой записи — например, email или короткое имя.",
    en: "Send a label for this record — e.g. an email or a short name.",
  },
  "admin.cookies.cookies_prompt": {
    ru:
      "Теперь пришли сам файл cookies.txt (Netscape) или JSON-массив с куками. " +
      "Файл можно как текстом, так и .txt вложением.",
    en:
      "Now send the cookies.txt content (Netscape) or a JSON array of cookies. " +
      "Plain text or a .txt attachment both work.",
  },
  "admin.cookies.invalid_payload": {
    ru: "Не получилось разобрать куки: {error}",
    en: "Could not parse the cookies: {error}",
  },

  "admin.instances.title": {
    ru: "Streaming-инстансы.",
    en: "Streaming instances.",
  },
  "admin.instances.empty": {
    ru: "Инстансов нет. Добавь первый через бота или укажи в INSTANCES_JSON.",
    en: "No instances. Add the first via the bot or list it in INSTANCES_JSON.",
  },
  "admin.instances.add_btn": { ru: "➕ Добавить инстанс", en: "➕ Add instance" },
  "admin.instances.name_prompt": {
    ru: "Короткое имя инстанса (видно только в админке):",
    en: "Short instance name (admin-visible only):",
  },
  "admin.instances.url_prompt": {
    ru:
      "Базовый URL: http(s)://host[:port]. http:// допустим — он вызывается только мастером.",
    en:
      "Base URL: http(s)://host[:port]. http:// is allowed — it's only called by the master node.",
  },
  "admin.instances.url_invalid": {
    ru: "URL должен начинаться с http:// или https://",
    en: "URL must start with http:// or https://",
  },
  "admin.instances.secret_prompt": {
    ru: "HMAC-секрет инстанса (значение INSTANCE_SECRET на сервере):",
    en: "Instance HMAC secret (the server's INSTANCE_SECRET):",
  },
  "admin.instances.duplicate": {
    ru: "Инстанс с таким URL уже существует.",
    en: "An instance with that URL already exists.",
  },
} as const satisfies Record<string, { ru: string; en: string }>;

export type I18nKey = keyof typeof strings;

/** Returns `ru` when language_code looks like Russian/Ukrainian/Belarusian, else `en`. */
export function pickLang(languageCode: string | null | undefined): Lang {
  const code = (languageCode ?? "").toLowerCase();
  if (code.startsWith("ru") || code.startsWith("uk") || code.startsWith("be")) {
    return "ru";
  }
  return "en";
}

/** Interpolates `{name}` placeholders into the string. */
export function t(
  lang: Lang,
  key: I18nKey,
  vars?: Record<string, string | number>,
): string {
  const value = strings[key][lang] ?? strings[key].en;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`,
  );
}

export const __i18nTest__ = { strings };
