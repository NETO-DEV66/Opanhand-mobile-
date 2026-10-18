import type { ReactElement, ReactNode } from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createInstance, type i18n as I18nInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { translationResources } from "#/i18n/resources";
import { OPENHANDS_I18N_NAMESPACE } from "#/i18n";

/**
 * A real i18next instance backed by the bundled translations, so tests assert
 * against the same strings the app renders instead of a stub `t()`.
 */
function createTestI18n(): I18nInstance {
  const instance = createInstance();

  instance.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    ns: [OPENHANDS_I18N_NAMESPACE],
    defaultNS: OPENHANDS_I18N_NAMESPACE,
    resources: {
      en: { [OPENHANDS_I18N_NAMESPACE]: translationResources.en },
    },
    interpolation: { escapeValue: false },
  });

  return instance;
}

export interface RenderWithProvidersOptions extends Omit<
  RenderOptions,
  "wrapper"
> {
  queryClient?: QueryClient;
  i18n?: I18nInstance;
}

/**
 * Renders `ui` inside the providers a component expects in the app: a React
 * Query client (retries off, so failures surface immediately) and i18next.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult {
  const {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    }),
    i18n = createTestI18n(),
    ...renderOptions
  } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
