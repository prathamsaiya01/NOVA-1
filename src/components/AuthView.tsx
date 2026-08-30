import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, User, Check, AlertCircle, RefreshCw, ArrowRight, ShieldCheck, ChevronDown, LockKeyhole, UserRound, Sparkles, Plus, CalendarDays, Clock3 } from 'lucide-react';
import { apiUrl } from '../services/apiClient';
import { COUNTRIES, Country } from '../utils/countries';
import { useI18n } from '../i18n';

interface AuthViewProps {
  onLoginSuccess: (name: string, email: string, phone: string, isSignUp?: boolean, address?: string, pinCode?: string, uid?: string) => void;
  onGuestContinue: () => void;
  onProceedToEmailVerification?: (email: string, name: string, address?: string, pinCode?: string, phone?: string) => void;
  initialMode?: 'login' | 'signup';
  prefilledName?: string;
  prefilledAddress?: string;
  prefilledPinCode?: string;
}

interface RegisterUser {
  uid: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  pinCode?: string;
  username?: string;
  accountType?: 'Guest' | 'Registered' | 'Premium';
  avatar?: string;
  createdAt?: string;
  lastActive?: string;
  linkedPhone?: boolean;
}

// Initial seed accounts for outstanding out-of-the-box convenience!
const SEED_USERS: RegisterUser[] = [
  { uid: 'user_arjun_001', name: 'Arjun Mehta', username: 'arjun.style', email: 'arjun.mehta@email.com', phone: '+91 98765 43210', accountType: 'Registered', createdAt: '12 Feb 2026', lastActive: 'Today', linkedPhone: true },
  { uid: 'user_pratham_001', name: 'Pratham', username: 'pratham.nova', email: 'pratham@nova.ai', phone: '+91 98765 43210', accountType: 'Premium', createdAt: '12 Feb 2026', lastActive: 'Today', linkedPhone: true },
  { uid: 'user_dad_001', name: 'Dad', username: 'shopping.profile', email: 'dad@nova.ai', phone: '+91 98765 43210', accountType: 'Registered', createdAt: '4 Jan 2026', lastActive: 'Yesterday', linkedPhone: true },
  { uid: 'user_mom_001', name: 'Mom', username: 'premium.profile', email: 'mom@nova.ai', phone: '+91 98765 43210', accountType: 'Premium', createdAt: '18 Dec 2025', lastActive: '3 days ago', linkedPhone: true },
  { uid: 'user_viju_001', name: 'Viju Saiya', username: 'vijusaiya', email: 'vijusaiya123@gmail.com', phone: '+91 91234 56789', accountType: 'Registered', createdAt: '22 May 2026', lastActive: 'Today', linkedPhone: true },
  { uid: 'guest_tester_001', name: 'Guest Tester', email: 'guest@nova.ai', phone: '+91 99999 88888', accountType: 'Guest', createdAt: '8 Jun 2026', lastActive: 'Last week', linkedPhone: false }
];

const normalizeStoredUser = (user: Partial<RegisterUser>, index: number): RegisterUser => ({
  uid: user.uid || `legacy_user_${index}_${(user.email || user.phone || 'account').replace(/[^a-z0-9]/gi, '_')}`,
  name: user.name || 'NOVA User',
  email: user.email || `legacy${index}@nova.ai`,
  phone: user.phone || '',
  address: user.address,
  pinCode: user.pinCode,
  username: user.username,
  accountType: user.accountType || 'Registered',
  avatar: user.avatar,
  createdAt: user.createdAt || 'Recently',
  lastActive: user.lastActive || 'Recently',
  linkedPhone: user.linkedPhone ?? user.accountType !== 'Guest'
});

const mergeSeedUsers = (users: RegisterUser[]) => {
  const byUid = new Map(users.map((user) => [user.uid, user]));
  SEED_USERS.forEach((seedUser) => {
    if (!byUid.has(seedUser.uid)) {
      byUid.set(seedUser.uid, seedUser);
    }
  });
  return Array.from(byUid.values());
};

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess, onGuestContinue, onProceedToEmailVerification, initialMode = 'login', prefilledName = '', prefilledAddress = '', prefilledPinCode = '' }) => {
  const { t } = useI18n();
  // If there are prefilled values, start in signup mode
  const hasPrefilledData = prefilledName || prefilledAddress || prefilledPinCode;
  const [mode, setMode] = useState<'login' | 'signup'>(hasPrefilledData ? 'signup' : initialMode);
  const [entryPath, setEntryPath] = useState<'choice' | 'signin' | 'signup' | 'account-selection'>(hasPrefilledData || initialMode === 'signup' ? 'signup' : 'choice');
  
  // Form input fields
  const [name, setName] = useState(prefilledName);
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState(prefilledAddress);
  const [pinCode, setPinCode] = useState(prefilledPinCode);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Default to India
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisterUser[]>([]);
  const [matchingAccounts, setMatchingAccounts] = useState<RegisterUser[]>([]);
  const [selectedAccountUid, setSelectedAccountUid] = useState<string | null>(null);

  useEffect(() => {
    const existing = localStorage.getItem('nova_registered_users');
    if (!existing) {
      localStorage.setItem('nova_registered_users', JSON.stringify(SEED_USERS));
      setRegisteredUsers(SEED_USERS);
    } else {
      try {
        const parsed = JSON.parse(existing) as Partial<RegisterUser>[];
        const migratedUsers = mergeSeedUsers(parsed.map(normalizeStoredUser));
        localStorage.setItem('nova_registered_users', JSON.stringify(migratedUsers));
        setRegisteredUsers(migratedUsers);
      } catch {
        setRegisteredUsers(SEED_USERS);
        localStorage.setItem('nova_registered_users', JSON.stringify(SEED_USERS));
      }
    }
  }, []);

  const normalizePhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    // For the input field, we only accept digits without country code
    // The country code will be added when submitting
    if (digits.length >= 10 && digits.length <= 12) {
      return digits;
    }
    if (digits.length > 12) {
      return digits.slice(0, 12);
    }
    return digits;
  };

  const getFullPhoneNumber = (phone: string, country: Country) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    // Combine country code with phone digits
    return `${country.dialCode}${digits}`;
  };

  const isValidPhoneNumber = (value: string) => {
  return /^\+[1-9]\d{9,14}$/.test(value);
};

  const resetAlerts = () => {
    setError(null);
    setSuccess(null);
  };

  const goToChoice = () => {
    setEntryPath('choice');
    setMode('login');
    setPhoneNumber('');
    setMatchingAccounts([]);
    setSelectedAccountUid(null);
    resetAlerts();
  };

  const goToSignIn = () => {
    setEntryPath('signin');
    setMode('login');
    resetAlerts();
  };

  const goToSignup = () => {
    setEntryPath('signup');
    setMode('signup');
    resetAlerts();
  };

  const findAccountsByPhone = (phone: string) => {
    const normalizedPhone = phone.replace(/\s+/g, '');
    return registeredUsers.filter((user) => (
      user.phone.replace(/\s+/g, '') === normalizedPhone
      && user.accountType !== 'Guest'
      && user.linkedPhone !== false
    ));
  };

  const loginWithAccount = (account: RegisterUser, phone: string, isSignUp = false, signupAddress?: string, signupPinCode?: string) => {
    setSuccess('Login successful! Redirecting you to Home.');
    setTimeout(() => {
      setIsSubmitting(false);
      onLoginSuccess(account.name, account.email, phone, isSignUp, signupAddress?.trim() || account.address, signupPinCode?.trim() || account.pinCode, account.uid);
    }, 500);
  };

  const loginWithPhone = async (phone: string, country: Country, signupEmail?: string, signupAddress?: string, signupPinCode?: string) => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const fullPhone = getFullPhoneNumber(phone, country);
    const normalizedPhone = fullPhone.replace(/\s+/g, '');
    const matches = findAccountsByPhone(normalizedPhone);

    if (mode === 'login' && matches.length === 0) {
      setError(t('auth.notRegistered'));
      setIsSubmitting(false);
      return;
    }

    if (mode === 'login' && matches.length > 1) {
      setMatchingAccounts(matches);
      setSelectedAccountUid(null);
      setEntryPath('account-selection');
      setIsSubmitting(false);
      return;
    }

    const matched = matches[0];

    const finalPhone = normalizedPhone;
    const finalName = matched?.name || name.trim() || 'NOVA User';
    const finalEmail = matched?.email || signupEmail?.trim().toLowerCase() || `${finalName.toLowerCase().replace(/\s+/g, '') || 'novauser'}@nova.ai`;

    if (mode === 'signup' && !matched) {
      const newUser: RegisterUser = {
        uid: `user_${Date.now()}`,
        name: name.trim() || 'NOVA User',
        phone: finalPhone,
        email: finalEmail,
        address: signupAddress?.trim(),
        pinCode: signupPinCode?.trim(),
        username: finalEmail.split('@')[0],
        accountType: 'Registered',
        createdAt: 'Today',
        lastActive: 'Today',
        linkedPhone: true
      };
      const updatedUsers = [newUser, ...registeredUsers.filter((u) => u.uid !== newUser.uid)];
      localStorage.setItem('nova_registered_users', JSON.stringify(updatedUsers));
      setRegisteredUsers(updatedUsers);
      loginWithAccount(newUser, finalPhone, true, signupAddress, signupPinCode);
      return;
    }

    loginWithAccount({
      uid: matched?.uid || finalEmail,
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      address: matched?.address,
      pinCode: matched?.pinCode,
      username: matched?.username,
      accountType: matched?.accountType || 'Registered',
      avatar: matched?.avatar,
      createdAt: matched?.createdAt,
      lastActive: matched?.lastActive
    }, finalPhone, mode === 'signup', signupAddress, signupPinCode);
  };

  const handleSelectAccount = (account: RegisterUser) => {
    setSelectedAccountUid(account.uid);
    setIsSubmitting(true);
    const fullPhone = getFullPhoneNumber(phoneNumber.trim(), selectedCountry).replace(/\s+/g, '');
    loginWithAccount(account, fullPhone);
  };

  const handleSignupWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate inputs
    if (!name.trim()) {
      setError('Please provide your Full Name.');
      return;
    }

    if (!email.trim()) {
      setError('Please provide your email address.');
      return;
    }

    if (pinCode.trim() && !/^\d{6}$/.test(pinCode.trim())) {
      setError('Please enter a valid 6-digit PIN code.');
      return;
    }

    let normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    if (!normalizedEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    const cleanPhone = phoneNumber.trim();
    const fullPhone = getFullPhoneNumber(cleanPhone, selectedCountry);
    if (!cleanPhone) {
      setError('Please provide a phone number for your account.');
      return;
    }
    if (!isValidPhoneNumber(fullPhone)) {
      setError(`Please provide a valid phone number for ${selectedCountry.name}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Request OTP from backend
      console.debug('OTP send request started.', { email: normalizedEmail, endpoint: apiUrl('/api/auth/send-otp') });
      const response = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const data = await response.json();
      console.debug('OTP send response received.', { status: response.status, success: data.success, expiresIn: data.expiresIn });

      if (!response.ok) {
        setError(data.error || 'Failed to send verification code. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSuccess('Verification code sent to your email!');
      
      // Proceed to email verification screen
      setTimeout(() => {
        setIsSubmitting(false);
        if (onProceedToEmailVerification) {
          onProceedToEmailVerification(normalizedEmail, name.trim(), address.trim() || undefined, pinCode.trim() || undefined, fullPhone);
        }
      }, 500);
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('Network error. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For signup, use email-based verification flow
    if (mode === 'signup') {
      await handleSignupWithEmail(e);
      return;
    }

    // For login, continue with phone-based flow
    setError(null);
    setSuccess(null);

    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone) {
      setError(`Please provide your phone number.`);
      return;
    }

    const fullPhone = getFullPhoneNumber(cleanPhone, selectedCountry);
    if (!isValidPhoneNumber(fullPhone)) {
      setError(`Please provide a valid phone number for ${selectedCountry.name}.`);
      return;
    }

    await loginWithPhone(cleanPhone, selectedCountry);
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 relative">

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white/90 backdrop-blur-3xl rounded-[28px] border border-white/80 shadow-2xl shadow-indigo-950/10 p-7 relative overflow-hidden flex flex-col"
      >
        <div className="flex flex-col items-center text-center pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-extrabold shadow-lg shadow-indigo-600/20 mb-3 hover:scale-105 transition-transform duration-300">
            N
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">{t('app.novaVisionLabs')}</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5 tracking-wider uppercase font-mono">{t('app.curationEngine')}</p>
        </div>

        <AnimatePresence mode="wait">
          {entryPath === 'choice' ? (
            <motion.div
              key="choice"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <motion.div whileHover={{ y: -3, scale: 1.01 }} className="rounded-[24px] border border-indigo-100 bg-white/70 p-4 shadow-lg shadow-indigo-950/5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <UserRound className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-slate-950">{t('auth.continueAsGuest')}</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{t('auth.guestDescription')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onGuestContinue}
                    className="mt-4 w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#2563EB] text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] overflow-hidden"
                  >
                    {t('auth.continueAsGuest')} <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>

                <motion.div whileHover={{ y: -3, scale: 1.01 }} className="rounded-[24px] border border-slate-200 bg-white/60 p-4 shadow-lg shadow-slate-950/5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-700 flex items-center justify-center">
                      <LockKeyhole className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-slate-950">{t('auth.registeredUser')}</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{t('auth.registeredDescription')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={goToSignIn}
                    className="mt-4 w-full py-3 px-4 rounded-2xl bg-white text-indigo-600 text-xs font-bold border border-indigo-200 shadow-sm flex items-center justify-center gap-1.5 transition-all hover:border-indigo-400 active:scale-[0.98]"
                  >
                    {t('auth.signIn')} <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              </div>

              <div className="pt-2 text-center space-y-2">
                <p className="text-[11px] font-semibold text-slate-500">{t('auth.savePrompt')}</p>
                <button type="button" onClick={goToSignup} className="text-xs font-black text-indigo-600 hover:text-indigo-700">
                  {t('auth.createAccount')}
                </button>
                <p className="text-[9px] text-slate-400 leading-relaxed">{t('auth.guestWarning')}</p>
              </div>
            </motion.div>
          ) : entryPath === 'account-selection' ? (
            <motion.div
              key="account-selection"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="text-center">
                <h3 className="text-xl font-black tracking-tight text-slate-950">{t('auth.chooseAccountTitle')}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">
                  {t('auth.chooseAccountFound')}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t('auth.chooseAccountPrompt')}
                </p>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 hide-scrollbar">
                {matchingAccounts.map((account, index) => {
                  const isSelected = selectedAccountUid === account.uid;
                  const initials = account.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join('') || 'N';

                  return (
                    <motion.div
                      key={account.uid}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 1.02 }}
                      className={`rounded-[24px] bg-white/75 p-[1px] shadow-lg transition-all duration-300 ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#4F46E5] to-[#2563EB] shadow-indigo-500/25'
                          : 'border border-indigo-100/80 shadow-indigo-950/5'
                      }`}
                    >
                      <div className="rounded-[23px] bg-white/90 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-100 to-blue-100 text-indigo-700 flex items-center justify-center font-black shadow-inner overflow-hidden">
                            {account.avatar ? (
                              <img src={account.avatar} alt={account.name} className="w-full h-full object-cover" />
                            ) : (
                              initials
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="text-sm font-black text-slate-950 truncate">{account.name}</h4>
                                {account.username && <p className="text-[10px] font-semibold text-slate-400 truncate">@{account.username}</p>}
                              </div>
                              <div className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${
                                account.accountType === 'Premium'
                                  ? 'bg-indigo-50 text-indigo-600'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {account.accountType || 'Registered'}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                  <CalendarDays className="w-3 h-3" /> {t('common.created')}
                                </div>
                                <p className="text-[10px] font-bold text-slate-700 mt-1">{account.createdAt || 'Recently'}</p>
                              </div>
                              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                  <Clock3 className="w-3 h-3" /> {t('common.lastActive')}
                                </div>
                                <p className="text-[10px] font-bold text-slate-700 mt-1">{account.lastActive || 'Recently'}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelectAccount(account)}
                          className={`mt-4 w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-70 ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#4F46E5] to-[#2563EB] text-white shadow-lg shadow-indigo-600/25'
                              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          }`}
                        >
                          {isSelected && isSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : isSelected ? (
                            <>
                              <Check className="w-4 h-4" /> Continue
                            </>
                          ) : (
                            <>
                              {t('auth.continue')} <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="pt-1 space-y-2 text-center">
                <button type="button" onClick={goToSignup} className="w-full py-2.5 rounded-2xl text-xs font-black text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 flex items-center justify-center gap-1.5">
                  <Plus className="w-4 h-4" /> {t('auth.createNewAccount')}
                </button>
                <button type="button" onClick={goToSignIn} className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800">
                  {t('auth.useDifferentPhone')}
                </button>
                <button type="button" onClick={goToChoice} className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-700">
                  {t('auth.back')}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key={entryPath}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleRequestOtp}
              className="space-y-4 flex-grow flex flex-col justify-between"
            >
              <div className="space-y-3.5">
                <div className="text-center pb-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">
                    {mode === 'login' ? <LockKeyhole className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {mode === 'login' ? t('auth.registeredUser') : t('auth.createAccount')}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {mode === 'login'
                      ? 'Enter your registered phone number. OTP verification is coming next.'
                      : 'Create an account to preserve your wardrobe, preferences, and profile.'}
                  </p>
                </div>

                {mode === 'signup' && (
              <>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="text"
                      placeholder="Arjun Mehta"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                      required={mode === 'signup'}
                    />
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                      required={mode === 'signup'}
                    />
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Street, locality, city"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full pl-3 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">PIN Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="560038"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-3 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                    />
                  </div>
                </div>
              </>
                )}

                <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1 leading-none">{t('auth.phoneNumber')}</label>
              <div className="flex gap-2">
                {/* Country Selector Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                    className="h-[42px] px-3 bg-slate-50/80 border border-slate-200 rounded-xl font-semibold text-xs flex items-center gap-2 hover:bg-white hover:border-indigo-600 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm whitespace-nowrap"
                  >
                    <span className="text-base">{selectedCountry.flag}</span>
                    <span className="text-slate-800">{selectedCountry.dialCode}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Country Dropdown Menu */}
                  {isCountryDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 max-h-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-y-auto">
                      <div className="sticky top-0 p-2 bg-white border-b border-slate-100">
                        <input
                          type="text"
                          placeholder="Search country..."
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                          onChange={(e) => {
                            // Could be used for filtering countries
                          }}
                        />
                      </div>
                      {COUNTRIES.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(country);
                            setIsCountryDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 hover:bg-indigo-50 transition-colors ${
                            selectedCountry.code === country.code ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700'
                          }`}
                        >
                          <span className="text-base w-6">{country.flag}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{country.name}</div>
                            <div className="text-slate-400 text-[10px]">{country.dialCode}</div>
                          </div>
                          {selectedCountry.code === country.code && (
                            <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone Number Input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4.5 h-4.5" />
                  </div>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(normalizePhoneNumber(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600 transition-all shadow-sm"
                    required
                  />
                </div>
              </div>
                  <span className="text-[9px] text-slate-400 block mt-1 ml-1 leading-tight">
                    {mode === 'login'
                      ? 'Only registered phone numbers can continue.'
                      : 'Use a valid phone number to register and continue.'}
                  </span>
                </div>

                {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex gap-2.5 text-rose-600 items-start text-left">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-[11px] font-semibold leading-relaxed">{error}</span>
                  {mode === 'login' && error === t('auth.notRegistered') && (
                    <div className="flex gap-2 mt-3">
                      <button type="button" onClick={goToSignup} className="px-3 py-2 rounded-xl bg-white text-rose-600 border border-rose-100 text-[10px] font-black">
                        {t('auth.createAccount')}
                      </button>
                      <button type="button" onClick={goToChoice} className="px-3 py-2 rounded-xl bg-rose-100/60 text-rose-600 text-[10px] font-black">
                        {t('auth.back')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
                )}

                {success && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex gap-2.5 text-emerald-600 items-start text-left">
                <Check className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <span className="text-[11px] font-semibold leading-relaxed">{success}</span>
              </div>
                )}
              </div>

              <div className="pt-6 space-y-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#2563EB] text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer disabled:opacity-70 active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {mode === 'login' ? t('auth.continue') : t('auth.createAccount')} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button type="button" onClick={goToChoice} className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-700">
                  {t('auth.back')}
                </button>
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400 font-mono tracking-wide leading-none uppercase">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-500 leading-none" /> Guest and registered flows separated
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
