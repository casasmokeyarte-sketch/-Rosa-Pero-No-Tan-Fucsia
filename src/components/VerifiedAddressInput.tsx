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

let googleMapsLoader: Promise<void> | null = null;

function loadGooglePlaces(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-wallet-google-places]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No fue posible cargar Google Places.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.walletGooglePlaces = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No fue posible cargar Google Places.'));
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

export default function VerifiedAddressInput({ value, onChange, onVerifiedChange }: VerifiedAddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'verified' | 'error'>('loading');
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  useEffect(() => {
    if (!apiKey) {
      setStatus('error');
      return;
    }

    let listener: any;
    let cancelled = false;

    loadGooglePlaces(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'place_id', 'geometry'],
          types: ['address'],
          componentRestrictions: { country: 'co' }
        });

        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place?.formatted_address || !place?.place_id) {
            onVerifiedChange(null);
            setStatus('ready');
            return;
          }

          const selection: VerifiedAddressSelection = {
            formattedAddress: place.formatted_address,
            placeId: place.place_id,
            latitude: place.geometry?.location?.lat?.(),
            longitude: place.geometry?.location?.lng?.()
          };
          onChange(selection.formattedAddress);
          onVerifiedChange(selection);
          setStatus('verified');
        });
        setStatus('ready');
      })
      .catch(() => setStatus('error'));

    return () => {
      cancelled = true;
      if (listener && window.google?.maps?.event) window.google.maps.event.removeListener(listener);
    };
  }, [apiKey, onChange, onVerifiedChange]);

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          onVerifiedChange(null);
          setStatus(apiKey ? 'ready' : 'error');
        }}
        className="bg-cyber-bg border border-cyber-border text-white p-2 rounded-lg w-full focus:outline-none glow-border-pink font-sans text-xs"
        placeholder="Escribe y selecciona una dirección real de la lista..."
        autoComplete="street-address"
        required
      />
      {status === 'loading' && <p className="text-[9px] text-gray-400">Cargando buscador de direcciones…</p>}
      {status === 'ready' && <p className="text-[9px] text-amber-300">Selecciona una opción de Google; escribirla solamente no la valida.</p>}
      {status === 'verified' && <p className="text-[9px] text-emerald-300">✓ Dirección seleccionada y verificada.</p>}
      {status === 'error' && <p className="text-[9px] text-red-300">El buscador de direcciones no está configurado o no pudo cargar. No se puede confirmar domicilio.</p>}
    </div>
  );
}
