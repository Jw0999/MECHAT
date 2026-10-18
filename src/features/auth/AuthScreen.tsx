import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { MessageCircle, LogIn, UserPlus, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const AuthScreen: React.FC = () => {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const isConfigured = useAuthStore((s) => s.isConfigured);

  const [mode, setMode] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    const res = await login(email, password);
    setIsLoading(false);

    if (!res.success) {
      toast.error(res.error || 'Invalid credentials');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName || !username) {
      toast.error('All fields are required');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    const res = await register(email, password, displayName, username);
    setIsLoading(false);

    if (res.success) {
      toast.success('Account created! Logging in...');
    } else {
      toast.error(res.error || 'Registration failed');
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0B0F10] text-[#F5F7F7] flex flex-col justify-between overflow-hidden select-none">
      {/* Top Background Visual Art inspired by Screen 1 */}
      <div className="relative w-full h-[55vh] sm:h-[60vh] overflow-hidden flex items-center justify-center">
        {/* Lime Green Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#8BCF32] via-[#5E9B1A] to-[#0B0F10] opacity-90" />

        {/* Floating playful emoticons / badges */}
        <div className="absolute top-12 left-10 w-12 h-12 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-2xl shadow-lg animate-bounce">
          😎
        </div>
        <div className="absolute top-28 right-8 w-11 h-11 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-xl shadow-lg">
          🤩
        </div>
        <div className="absolute bottom-28 left-8 w-10 h-10 rounded-full bg-black/20 backdrop-blur flex items-center justify-center text-xl shadow-lg">
          🥰
        </div>

        {/* Central Illustration / Photo Portrait Card */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80"
              alt="MeChat"
              className="w-56 h-72 sm:w-64 sm:h-80 object-cover rounded-3xl shadow-2xl border-2 border-white/20"
            />

            {/* Floating Audio Wave Pill */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0B0F10]/85 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 shadow-xl">
              <span className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-[#0B0F10]">
                ▶
              </span>
              <div className="flex items-center gap-1 h-3">
                {[40, 70, 30, 90, 60, 100, 45, 80].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-brand"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Content / Actions Container */}
      <div className="relative z-20 px-6 pb-8 pt-4 max-w-md mx-auto w-full flex flex-col items-center text-center">
        {/* Welcome Tag */}
        <span className="inline-block bg-[#1E2325] text-xs font-semibold px-3 py-1 rounded-full text-[#9BA5A8] border border-[#252C2E] mb-3">
          Welcome Back!
        </span>

        {/* Main Heading */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 leading-tight">
          Connect Together With Your Friends
        </h1>

        <p className="text-xs sm:text-sm text-[#9BA5A8] max-w-xs mb-6">
          Login to continue connecting with your friends across chats, groups and calls.
        </p>

        {/* Action Buttons matching Screen 1 */}
        <div className="flex items-center gap-3 w-full mb-3">
          <button
            onClick={() => setMode('login')}
            className="flex-1 bg-brand hover:bg-brand-hover text-[#0B0F10] font-bold text-sm py-3.5 rounded-full shadow-lg shadow-brand/20 active:scale-95 transition"
          >
            Login
          </button>
          <button
            onClick={() => setMode('signup')}
            className="flex-1 bg-[#151A1C] hover:bg-[#1E2325] text-[#F5F7F7] border border-[#252C2E] font-bold text-sm py-3.5 rounded-full active:scale-95 transition"
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* LOGIN MODAL */}
      {mode === 'login' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-[#151A1C] border border-[#252C2E] rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#252C2E]">
              <div className="flex items-center gap-2">
                <LogIn size={20} className="text-brand" />
                <h3 className="text-base font-bold text-white">Login to MeChat</h3>
              </div>
              <button
                onClick={() => setMode('welcome')}
                className="p-1 text-[#9BA5A8] hover:text-white rounded-full transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#1E2325] text-sm text-white placeholder-[#9BA5A8] rounded-xl px-3.5 py-2.5 border border-[#252C2E] focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#1E2325] text-sm text-white placeholder-[#9BA5A8] rounded-xl pl-3.5 pr-10 py-2.5 border border-[#252C2E] focus:outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA5A8] hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand hover:bg-brand-hover text-[#0B0F10] font-bold text-sm py-3.5 rounded-full transition shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                <span>Login</span>
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setMode('signup')}
                className="text-xs text-[#9BA5A8] hover:text-brand"
              >
                Don&apos;t have an account? <span className="font-bold text-brand">Sign Up</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIGN UP MODAL */}
      {mode === 'signup' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-[#151A1C] border border-[#252C2E] rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#252C2E]">
              <div className="flex items-center gap-2">
                <UserPlus size={20} className="text-brand" />
                <h3 className="text-base font-bold text-white">Create an Account</h3>
              </div>
              <button
                onClick={() => setMode('welcome')}
                className="p-1 text-[#9BA5A8] hover:text-white rounded-full transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Kelvin Cole"
                  className="w-full bg-[#1E2325] text-sm text-white placeholder-[#9BA5A8] rounded-xl px-3.5 py-2.5 border border-[#252C2E] focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. kelvin"
                  className="w-full bg-[#1E2325] text-sm text-white placeholder-[#9BA5A8] rounded-xl px-3.5 py-2.5 border border-[#252C2E] focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#1E2325] text-sm text-white placeholder-[#9BA5A8] rounded-xl px-3.5 py-2.5 border border-[#252C2E] focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-[#1E2325] text-sm text-white placeholder-[#9BA5A8] rounded-xl px-3.5 py-2.5 border border-[#252C2E] focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9BA5A8] mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full bg-[#1E2325] text-sm text-white placeholder-[#9BA5A8] rounded-xl px-3.5 py-2.5 border border-[#252C2E] focus:outline-none focus:border-brand"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand hover:bg-brand-hover text-[#0B0F10] font-bold text-sm py-3.5 rounded-full transition shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                <span>Register</span>
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => setMode('login')}
                className="text-xs text-[#9BA5A8] hover:text-brand"
              >
                Already have an account? <span className="font-bold text-brand">Login</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
