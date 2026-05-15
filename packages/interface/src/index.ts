export {
  connectMongo,
  getEnv,
  isBotConfigured,
  isGoogleOAuthConfigured,
  signToken,
  User,
  verifyTelegramInitData,
  verifyToken,
  type TelegramInitData,
  type TelegramInitDataUser,
  type UserDoc,
  type UserModel,
  type WaveEnv,
} from "@wave/shared";
export {
  pickLang,
  pickWebLang,
  SUPPORTED_WEB_LANGS,
  t,
  type I18nKey,
  type Lang,
} from "./i18n";
