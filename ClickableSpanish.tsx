import React, { useEffect, useState } from 'react';
import { Languages, Volume2 } from 'lucide-react';
import { speakSpanish } from './audio';

interface ClickableSpanishProps {
  textEs: string;
  translationHy?: string;
  highlightWord?: string;
  forceShowTranslation?: boolean;
  speechEnabled?: boolean;
  className?: string;
  textClassName?: string;
  translationClassName?: string;
  compact?: boolean;
  stopPropagationOnClick?: boolean;
}

export const ClickableSpanish: React.FC<ClickableSpanishProps> = ({
  textEs,
  translationHy,
  highlightWord,
  forceShowTranslation = false,
  speechEnabled = true,
  className = '',
  textClassName = '',
  translationClassName = '',
  compact = false,
  stopPropagationOnClick = false,
}) => {
  const [revealed, setRevealed] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [textEs]);

  const isVisible = forceShowTranslation || revealed;

  const handleToggle = (e: React.MouseEvent) => {
    if (stopPropagationOnClick) {
      e.stopPropagation();
    }
    if (!translationHy) return;
    setRevealed((prev) => !prev);
  };

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSpeaking(true);
    speakSpanish(textEs, speechEnabled, () => setSpeaking(false));
  };

  const renderHighlightedEs = () => {
    if (!highlightWord) return textEs;
    const escaped = highlightWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'i');
    const parts = textEs.split(regex);
    return parts.map((part, idx) =>
      part.toLowerCase() === highlightWord.toLowerCase() ? (
        <span
          key={idx}
          className="mx-0.5 rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-700 underline decoration-rose-500 decoration-wavy underline-offset-4"
        >
          {part}
        </span>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  return (
    <div className={`group ${className}`}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={handleToggle}
          title={
            translationHy
              ? isVisible
                ? 'Haz clic para ocultar la traducción al armenio'
                : 'Haz clic para ver la traducción al armenio'
              : undefined
          }
          className={`text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md ${
            translationHy
              ? 'cursor-pointer hover:text-blue-700'
              : 'cursor-default'
          } ${textClassName}`}
        >
          <span>{renderHighlightedEs()}</span>
          {translationHy && !compact && (
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-slate-400 group-hover:text-blue-600">
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isVisible ? 'Ocultar' : 'HY'}</span>
            </span>
          )}
        </button>

        {speechEnabled && (
          <button
            type="button"
            onClick={handleSpeak}
            aria-label="Escuchar pronunciación en español"
            title="Escuchar en español"
            className={`shrink-0 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
              compact ? 'h-8 w-8' : 'h-9 w-9'
            } ${
              speaking
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {translationHy && isVisible && (
        <div
          onClick={handleToggle}
          className={`mt-1.5 cursor-pointer rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-1.5 text-amber-950 transition-all ${
            compact ? 'text-xs' : 'text-sm'
          } ${translationClassName}`}
        >
          {translationHy}
        </div>
      )}
    </div>
  );
};
