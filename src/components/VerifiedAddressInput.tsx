import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: any;
  }
}

export interface VerifiedAddressSelection {
  formattedAddress: string;
  placeId: string;
  latitude?: number;
  longitude?: number;
}

interface VerifiedAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerifiedChange: (selection: VerifiedAddressSelection | null) => void;
}

interface AddressPrediction {
  id: string;
  label: string;
  prediction: any;
}

let googleMapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-wallet-google-places]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No fue posible cargar Google Maps.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.walletGooglePlaces = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No fue posible cargar Google Maps.'));
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

export default function VerifiedAddressInput({ value, onChange, onVerifiedChange }: VerifiedAddressInputProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'searching' | 'verified' | 'error'>('loading');
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const placesLibraryRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!apiKey) {
      setStatus('error');
      return;
    }

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(async () => {
        if (cancelled || !window.google?.maps?.importLibrary) return;
        const placesLibrary = await window.google.maps.importLibrary('places');
        if (cancelled) return;
        placesLibraryRef.current = placesLibrary;
        sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
        setStatus('ready');
      })
      .catch((error) => {
        console.error('google_places_load_error', error);
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [apiKey]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPredictions([]);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const searchAddresses = async (input: string) => {
    const placesLibrary = placesLibraryRef.current;
    if (!placesLibrary || input.trim().length < 3) {
      setPredictions([]);
      return;
    }

    const requestId = ++requestIdRef.current;
    setStatus('searching');

    try {
      const { suggestions } = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: input.trim(),
        includedRegionCodes: ['co'],
        language: 'es-CO',
        region: 'co',
        sessionToken: sessionTokenRef.current
      });

      if (requestId !== requestIdRef.current) return;

      const nextPredictions: AddressPrediction[] = suggestions
        .map((suggestion: any) => suggestion.placePrediction)
        .filter(Boolean)
        .map((prediction: any) => ({
          id: prediction.placeId || prediction.text?.toString(),
          label: prediction.text?.toString() || '',
          prediction
        }))
        .filter((prediction: AddressPrediction) => prediction.id && prediction.label)
        .slice(0, 6);

      setPredictions(nextPredictions);
      setStatus('ready');
    } catch (error) {
      console.error('google_places_suggestions_error', error);
      if (requestId === requestIdRef.current) {
        setPredictions([]);
        setStatus('error');
      }
    }
  };

  const selectPrediction = async (option: AddressPrediction) => {
    const placesLibrary = placesLibraryRef.current;
    if (!placesLibrary) return;

    setStatus('searching');

    try {
      const place = option.prediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location'] });

      const formattedAddress = place.formattedAddress || option.label;
      const placeId = place.id || option.id;
      const selection: VerifiedAddressSelection = {
        formattedAddress,
        placeId,
        latitude: place.location?.lat?.(),
        longitude: place.location?.lng?.()
      };

      onChange(formattedAddress);
      onVerifiedChange(selection);
      setPredictions([]);
      sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
      setStatus('verified');
    } catch (error) {
      console.error('google_places_selection_error', error);
      onVerifiedChange(null);
      setStatus('error');
    }
  };

  return (
    <div ref={containerRef} className="relative space-y-1">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue);
          onVerifiedChange(null);
          setPredictions([]);

          if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);

          if (!apiKey || !placesLibraryRef.current) {
            setStatus('error');
            return;
          }

          if (nextValue.trim().length < 3) {
            setStatus('ready');
            return;
          }

          debounceRef.current = window.setTimeout(() => {
            void searchAddresses(nextValue);
          }, 300);
        }}
        className="bg-cyber-bg border border-cyber-border text-white p-2 rounded-lg w-full focus:outline-none glow-border-pink font-sans text-xs"
        placeholder="Escribe y selecciona una dirección real de la lista..."
        autoComplete="off"
        required
      />

      {predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[9999] mt-1 overflow-hidden rounded-lg border border-cyan-500/60 bg-slate-950 shadow-2xl">
          {predictions.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void selectPrediction(option)}
              className="block w-full border-b border-slate-800 px-3 py-2 text-left text-xs text-white hover:bg-cyan-950 last:border-b-0"
            >
              {option.label}
            </button>
          ))}
          <div className="bg-white px-3 py-1 text-right text-[9px] font-semibold text-slate-500">Powered by Google</div>
        </div>
      )}

      {status === 'loading' && <p className="text-[9px] text-gray-400">Cargando buscador de direcciones…</p>}
      {status === 'searching' && <p className="text-[9px] text-cyan-300">Buscando direcciones…</p>}
      {status === 'ready' && <p className="text-[9px] text-amber-300">Selecciona una opción de Google; escribirla solamente no la valida.</p>}
      {status === 'verified' && <p className="text-[9px] text-emerald-300">✓ Dirección seleccionada y verificada.</p>}
      {status === 'error' && <p className="text-[9px] text-red-300">Google no pudo consultar direcciones. Verifica Places API (New), facturación y restricciones de la clave.</p>}
    </div>
  );
}
