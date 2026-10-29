import en from "./locales/en";

type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends (...args: infer A) => infer R
        ? (...args: A) => Widen<R>
        : T extends readonly (infer U)[]
          ? readonly Widen<U>[]
          : T extends object
            ? { [K in keyof T]: Widen<T[K]> }
            : T;

export type Messages = Omit<Widen<typeof en>, "siteLabels"> & {
  siteLabels: Record<string, string>;
};

const localeModules = import.meta.glob<{ default: Messages }>("./locales/*.ts", {
  eager: true,
});
const messagesByLocale: Record<string, Messages> = Object.fromEntries(
  Object.entries(localeModules).map(([file, module]) => [
    file.slice("./locales/".length, -".ts".length),
    module.default,
  ]),
);

export const locales = Object.keys(messagesByLocale);

export function getLocale(locale?: string): string {
  return locale && Object.hasOwn(messagesByLocale, locale) ? locale : "en";
}

export function getMessages(locale?: string): Messages {
  return messagesByLocale[getLocale(locale)];
}

export function getSiteLabel(locale: string | undefined, link: string, fallback: string) {
  return (
    getMessages(locale).siteLabels[link] ??
    getMessages("en").siteLabels[link] ??
    fallback
  );
}

export function localizedPath(locale: string, path: string): string {
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  const prefix = import.meta.env.BASE_URL.replace(/\/$/, "");
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  return `${prefix}${localePrefix}${cleanPath ? `/${cleanPath}` : "/"}`;
}
