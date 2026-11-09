import { useEffect, useState } from 'react';
import { primaryButton, secondaryButton } from '@/components/styles';
import { STORE_URL } from '@/core/app';
import { shouldAskForRating } from '@/core/rating';
import { t } from '@/i18n';
import { sendToBackground } from '@/messaging';
import { loadRating } from '@/storage/read';

/** Asks for a rating after real use, at most twice. Nothing is offered in return. `wide` lays it out in a row. */
export function RatingPrompt({ className, wide = false }: { className: string; wide?: boolean }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    void loadRating().then((rating) => {
      setAsk(shouldAskForRating(rating, Date.now()));
    });
  }, []);
  if (!ask) return null;
  const answer = (rated: boolean): void => {
    void sendToBackground({ type: 'ratingAnswer', rated });
    // After the click's default action, so the link still opens.
    setTimeout(() => {
      setAsk(false);
    }, 0);
  };
  const button = wide ? '' : 'w-full';
  return (
    <section
      className={`${className} flex rounded-md border border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950 ${
        wide ? 'flex-wrap items-center gap-x-6 gap-y-3 p-4' : 'flex-col gap-1.5 p-2.5'
      }`}
    >
      <div className={wide ? 'min-w-60 flex-1' : ''}>
        <p aria-hidden="true" className="text-xs leading-none tracking-widest text-orange-600 dark:text-orange-400">
          ★★★★★
        </p>
        <p className="mt-1.5 text-sm font-medium">{t('popup.ratePrompt')}</p>
      </div>
      <div className={wide ? 'flex gap-2' : 'flex flex-col gap-1.5'}>
        <a
          href={`${STORE_URL}/reviews`}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            answer(true);
          }}
          className={`${primaryButton} ${button}`}
        >
          {t('options.rate')}
        </a>
        <button
          type="button"
          onClick={() => {
            answer(false);
          }}
          className={`${secondaryButton} ${button}`}
        >
          {t('popup.rateLater')}
        </button>
      </div>
    </section>
  );
}
