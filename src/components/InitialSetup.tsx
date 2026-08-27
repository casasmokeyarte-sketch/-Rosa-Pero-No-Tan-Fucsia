import React, { useRef, useState } from 'react';
import { Building, Check, Eye, EyeOff, Upload } from 'lucide-react';
import { BusinessConfig, User } from '../types';

interface InitialSetupProps {
  config: BusinessConfig;
  bootstrapUser: User;
  onComplete: (config: BusinessConfig, admin: User) => Promise<void>;
}

export default function InitialSetup({ config, bootstrapUser, onComplete }: InitialSetupProps) {
  const [companyName, setCompanyName] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [rut, setRut] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [slogan, setSlogan] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('FAC');
  const [taxRate, setTaxRate] = useState(0);
  const [logoUrl, setLogoUrl] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen válido.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setError('El logo debe pesar máximo 1 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(String(reader.result || ''));
      setError(null);
    };
    reader.onerror = () => setError('No fue posible leer el logo.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanUsername = adminUsername.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      setError('El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener mínimo 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSaving(true);
    try {
      await onComplete(
        {
          ...config,
          companyName: companyName.trim(),
          commercialName: commercialName.trim(),
          rut: rut.trim(),
          city: city.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          website: website.trim(),
          slogan: slogan.trim(),
          logoUrl,
          invoicePrefix: invoicePrefix.trim().toUpperCase(),
          taxRate,
          setupComplete: true
        },
        {
          ...bootstrapUser,
          username: cleanUsername,
          fullName: adminName.trim(),
          password
        }
      );
    } catch (setupError) {
      console.error('Initial company setup failed:', setupError);
      setError('No fue posible completar la configuración. Revisa Supabase e intenta nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'w-full bg-slate-950 border border-slate-700 focus:border-cyber-pink rounded-lg p-2.5 text-white text-xs outline-none';
  const labelClass = 'block text-[9px] uppercase tracking-wider text-gray-400 mb-1 font-mono';

  return (
    <div className="min-h-screen bg-cyber-bg text-gray-200 p-4 sm:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto bg-cyber-card border border-cyber-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-cyber-border bg-slate-950/70 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyber-pink/15 border border-cyber-pink/40 flex items-center justify-center text-cyber-pink">
            <Building size={24} />
          </div>
          <div>
            <p className="text-[10px] text-cyber-pink font-mono uppercase tracking-widest">Primera instalación</p>
            <h1 className="text-xl font-black text-white">Configura tu empresa</h1>
            <p className="text-xs text-gray-400 mt-1">Estos datos identificarán esta instalación y su administrador principal.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-cyber-pink uppercase font-mono border-b border-slate-800 pb-2">1. Datos de la empresa</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelClass}>Razón social *</label><input className={inputClass} value={companyName} onChange={e => setCompanyName(e.target.value)} required /></div>
              <div><label className={labelClass}>Nombre comercial *</label><input className={inputClass} value={commercialName} onChange={e => setCommercialName(e.target.value)} required /></div>
              <div><label className={labelClass}>NIT o documento *</label><input className={inputClass} value={rut} onChange={e => setRut(e.target.value)} required /></div>
              <div><label className={labelClass}>Ciudad *</label><input className={inputClass} value={city} onChange={e => setCity(e.target.value)} required /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Dirección *</label><input className={inputClass} value={address} onChange={e => setAddress(e.target.value)} required /></div>
              <div><label className={labelClass}>Teléfono *</label><input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} required /></div>
              <div><label className={labelClass}>Correo *</label><input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} required /></div>
              <div><label className={labelClass}>Sitio web</label><input className={inputClass} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." /></div>
              <div><label className={labelClass}>Eslogan</label><input className={inputClass} value={slogan} onChange={e => setSlogan(e.target.value)} /></div>
              <div><label className={labelClass}>Prefijo comprobantes *</label><input className={inputClass} value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} maxLength={10} required /></div>
              <div><label className={labelClass}>Impuesto general (%)</label><input type="number" min="0" max="100" step="0.01" className={inputClass} value={taxRate} onChange={e => setTaxRate(Number(e.target.value) || 0)} /></div>
            </div>

            <div>
              <label className={labelClass}>Logo de la empresa (máximo 1 MB)</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border border-dashed border-slate-600 hover:border-cyber-pink rounded-lg p-3 text-xs font-mono flex items-center justify-center gap-2">
                {logoUrl ? <><Check size={15} className="text-cyber-green" /> Logo seleccionado</> : <><Upload size={15} /> Seleccionar logo</>}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold text-cyber-blue uppercase font-mono border-b border-slate-800 pb-2">2. Administrador principal</h2>
            <div><label className={labelClass}>Nombre completo *</label><input className={inputClass} value={adminName} onChange={e => setAdminName(e.target.value)} required /></div>
            <div><label className={labelClass}>Nombre de usuario *</label><input className={inputClass} value={adminUsername} onChange={e => setAdminUsername(e.target.value)} autoComplete="username" required /></div>
            <div>
              <label className={labelClass}>Contraseña definitiva *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className={`${inputClass} pr-10`} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
                <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </div>
            <div><label className={labelClass}>Confirmar contraseña *</label><input type="password" className={inputClass} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required /></div>

            <div className="bg-cyber-blue/10 border border-cyber-blue/30 rounded-lg p-3 text-[10px] text-gray-300 leading-relaxed">
              El sistema permanecerá bloqueado hasta guardar correctamente la empresa y el administrador. Después ingresarás con el usuario y la contraseña definidos aquí.
            </div>

            {error && <div className="bg-red-950/40 border border-red-500/50 text-red-200 rounded-lg p-3 text-xs">{error}</div>}

            <button type="submit" disabled={isSaving} className="w-full bg-cyber-pink text-black font-black py-3 rounded-lg text-xs font-mono disabled:opacity-60 disabled:cursor-wait">
              {isSaving ? 'GUARDANDO Y VERIFICANDO...' : 'FINALIZAR CONFIGURACIÓN'}
            </button>
          </section>
        </form>
      </div>
    </div>
  );
}
