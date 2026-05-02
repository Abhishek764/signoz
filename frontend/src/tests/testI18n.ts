import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const testI18n = i18n.createInstance();

void testI18n.use(initReactI18next).init({
	lng: 'en',
	fallbackLng: 'en',
	debug: false,
	interpolation: { escapeValue: false },
	resources: { en: { translation: {} } },
	react: { useSuspense: false },
});
