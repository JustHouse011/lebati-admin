import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleDashed,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { z } from 'zod'
import { APP_NAME } from './appName'
import BrandLogo from './components/BrandLogo'
import DashboardShell from './features/dashboard/DashboardShell'
import OnboardingFlow from './features/onboarding/OnboardingFlow'
import { getPreferences } from './services/mockProfile'
import { logout, mockAdminUser, persistAuthenticatedUser, resetWorkspacePassword, validateMockCredentials } from './services/mockAuth'

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid business email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

const recoveryRequestSchema = z.object({
  email: z.string().trim().email('Enter the email used for account recovery.'),
})

type RecoveryRequestValues = z.infer<typeof recoveryRequestSchema>

const resetPasswordSchema = z
  .object({
    token: z.string().min(6, 'Enter the reset token.'),
    password: z.string().min(8, 'Use at least 8 characters.'),
    confirmPassword: z.string().min(8, 'Confirm the new password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs)
  })

const router = createBrowserRouter([{ path: '*', element: <LebatiApp /> }])

function App() {
  return (
    <RouterProvider router={router} />
  )
}

function LebatiApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<PasswordRecoveryPage />} />
      <Route path="/access-granted" element={<AccessGrantedPage />} />
      <Route path="/dashboard/*" element={<DashboardShell />} />
      <Route path="/settings/*" element={<DashboardShell />} />
      <Route path="/onboarding/*" element={<OnboardingFlow />} />
    </Routes>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if ((location.state as { logout?: boolean } | null)?.logout) logout()
  }, [location.state])
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })
  const [showPassword, setShowPassword] = useState(false)

  const onSubmit = async (values: LoginFormValues) => {
    clearErrors('root')
    await wait(900)

    const account = validateMockCredentials(values.email, values.password)

    if (!account) {
      setError('root', {
        message: 'Invalid email or password. Only the authorised Global Administrator account can access the portal.',
      })
      return
    }

    persistAuthenticatedUser(account)
    navigate(getPreferences().landingPage, { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#F6F8FA] px-4 py-8 text-[#102235] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(16,34,53,0.12)]">
        <div className="grid min-h-[92vh] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1.5fr_1.22fr]">
          <aside className="relative hidden overflow-hidden bg-[#102235] p-8 text-white lg:flex lg:flex-col">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(198,166,107,0.18),_transparent_45%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="mb-8 space-y-2">
                  <BrandLogo className="w-48" />
                  <div className="text-[10px] uppercase tracking-[0.38em] text-slate-300">
                    Access & compliance
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-xs font-light uppercase tracking-[0.3em] text-[#C6A66B]">
                    Secure access
                  </p>
                  <h1 className="max-w-xs font-display text-5xl leading-none text-white">
                    Secure entry to responsible gambling verification.
                  </h1>
                </div>
              </div>

              <div className="relative z-10 mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-3 text-[#C6A66B]">
                  <ShieldCheck className="h-5 w-5" />
                  <span className="text-sm font-light uppercase tracking-[0.18em]">
                    Security posture
                  </span>
                </div>
                <p className="text-sm leading-6 text-slate-200">
                  Review verification records, compliance cases, and access decisions in one workspace.
                </p>
              </div>
            </div>
          </aside>

          <div className="relative hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80"
              alt="Architectural entrance"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#102235]/70 via-[#102235]/20 to-transparent" />
          </div>

          <main className="flex items-center justify-center bg-[#FFFFFF] p-6 sm:p-8 lg:p-10">
            <div className="w-full max-w-md">
              <BrandLogo className="mb-6 w-44 lg:hidden" />
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-light text-[#087E87]">
                    {APP_NAME}
                  </p>
                  <h2 className="mt-2 text-3xl font-light text-[#102235]">Welcome back</h2>
                </div>
                <span className="rounded-full border border-[#C6A66B] bg-[#FFF7EC] px-2.5 py-1 text-[10px] font-light uppercase tracking-[0.2em] text-[#102235]">
                  Administrator
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFB] p-4">
                <p className="mb-2 text-xs font-light uppercase tracking-[0.22em] text-slate-500">
                  Account
                </p>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                  <div className="font-light text-[#102235]">Global Administrator</div>
                  <ShieldCheck className="h-5 w-5 text-[#087E87]" />
                </div>
              </div>

              <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-light text-[#102235]">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      {...register('email')}
                      className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] py-3 pl-10 pr-3 text-sm outline-none transition focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20"
                      placeholder="name@lebati.co.za"
                      aria-invalid={errors.email ? 'true' : 'false'}
                    />
                  </div>
                  {errors.email ? (
                    <p className="mt-1.5 text-sm text-[#C34C4C]">{errors.email.message}</p>
                  ) : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-light text-[#102235]">
                      Password
                    </label>
                    <Link to="/forgot-password" className="text-sm font-light text-[#087E87] hover:text-[#065d68]">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] py-3 pl-10 pr-11 text-sm outline-none transition focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20"
                      placeholder="••••••••"
                      aria-invalid={errors.password ? 'true' : 'false'}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-3.5 text-slate-500 hover:text-[#102235]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-1.5 text-sm text-[#C34C4C]">{errors.password.message}</p>
                  ) : null}
                </div>

                {errors.root ? (
                  <div className="rounded-xl border border-[#F1C5C5] bg-[#FEF3F3] px-3 py-2 text-sm text-[#C34C4C]">
                    {errors.root.message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white transition hover:bg-[#0d1d2b] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <div className="mb-2 flex items-center gap-2 font-light text-[#102235]">
                  <ShieldAlert className="h-4 w-4 text-[#C6A66B]" />
                  Security information
                </div>
                <p className="leading-6">
                  Sign in with the Global Administrator account to manage workspace records.
                </p>
                <Link to="/onboarding" className="mt-2 inline-block text-[#087E87] underline underline-offset-4">Open onboarding</Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function PasswordRecoveryPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'request' | 'confirm' | 'reset' | 'success'>('request')
  const [recoveryEmail, setRecoveryEmail] = useState('')

  const requestForm = useForm<RecoveryRequestValues>({
    resolver: zodResolver(recoveryRequestSchema),
    defaultValues: { email: recoveryEmail },
  })

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: '',
      password: '',
      confirmPassword: '',
    },
  })

  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleRecoverySubmit = async (values: RecoveryRequestValues) => {
    await wait(700)
    if (values.email.trim().toLowerCase() !== mockAdminUser.email.toLowerCase()) {
      requestForm.setError('email', { message: 'Enter the administrator account email.' })
      return
    }
    setRecoveryEmail(values.email)
    setStep('confirm')
  }

  const handleResetSubmit = async (values: ResetPasswordValues) => {
    await wait(700)
    if (values.token.toUpperCase() !== 'LBT-482153') {
      resetForm.setError('token', { message: 'Enter the reset token provided in the previous step.' })
      return
    }
    resetWorkspacePassword(values.password)
    setStep('success')
  }

  return (
    <div className="min-h-screen bg-[#F6F8FA] px-4 py-10 text-[#102235] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(16,34,53,0.08)] sm:p-8 lg:p-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-light text-[#087E87] hover:text-[#065d68]">
            <ArrowLeft className="h-4 w-4" /> Back to login
          </Link>
          <BrandLogo className="w-32" />
        </div>

        {step === 'request' ? (
          <div className="mx-auto max-w-xl">
            <div className="mb-6 flex items-center gap-3 text-[#102235]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF7F7] text-[#087E87]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#087E87]">Reset access</p>
                <h1 className="mt-2 text-3xl font-light">Forgot your password?</h1>
              </div>
            </div>

            <form onSubmit={requestForm.handleSubmit(handleRecoverySubmit)} className="space-y-5">
              <div>
                <label htmlFor="recovery-email" className="mb-2 block text-sm font-light text-[#102235]">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="recovery-email"
                    type="email"
                    {...requestForm.register('email')}
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] py-3 pl-10 pr-3 text-sm outline-none transition focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20"
                    placeholder="name@lebati.co.za"
                    aria-invalid={requestForm.formState.errors.email ? 'true' : 'false'}
                  />
                </div>
                {requestForm.formState.errors.email ? (
                  <p className="mt-1.5 text-sm text-[#C34C4C]">
                    {requestForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white transition hover:bg-[#0d1d2b]"
              >
                Request reset link
              </button>
            </form>
          </div>
        ) : null}

        {step === 'confirm' ? (
          <div className="mx-auto max-w-xl rounded-[28px] border border-slate-200 bg-[#F8FAFB] p-6">
            <div className="mb-4 flex items-center gap-3 text-[#16836B]">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-light uppercase tracking-[0.18em]">Confirmation</span>
            </div>
            <h2 className="text-3xl font-light text-[#102235]">Reset instructions ready</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A reset token is available in this browser for <span className="font-light text-[#102235]">{recoveryEmail}</span>. Email delivery is unavailable.
            </p>

            <div className="mt-6 rounded-2xl border border-[#C6A66B]/40 bg-[#FFF7EC] p-4">
              <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[#102235]">Reset token</div>
              <div className="font-light text-lg font-light text-[#102235]">LBT-482153</div>
            </div>

            <button
              type="button"
              onClick={() => setStep('reset')}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#087E87] px-4 py-3 text-sm font-light text-white transition hover:bg-[#065d68]"
            >
              Continue to reset password
            </button>
          </div>
        ) : null}

        {step === 'reset' ? (
          <div className="mx-auto max-w-xl">
            <h2 className="text-3xl font-light text-[#102235]">Set a new password</h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter the reset token from the previous step.
            </p>

            <form onSubmit={resetForm.handleSubmit(handleResetSubmit)} className="mt-6 space-y-5">
              <div>
                <label htmlFor="reset-token" className="mb-2 block text-sm font-light text-[#102235]">
                  Reset token
                </label>
                <input
                  id="reset-token"
                  type="text"
                  {...resetForm.register('token')}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] px-3 py-3 text-sm outline-none transition focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20"
                />
                {resetForm.formState.errors.token ? (
                  <p className="mt-1.5 text-sm text-[#C34C4C]">{resetForm.formState.errors.token.message}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-light text-[#102235]">
                  New password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="new-password"
                    type={showResetPassword ? 'text' : 'password'}
                    {...resetForm.register('password')}
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] py-3 pl-10 pr-11 text-sm outline-none transition focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((value) => !value)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-[#102235]"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {resetForm.formState.errors.password ? (
                  <p className="mt-1.5 text-sm text-[#C34C4C]">
                    {resetForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-light text-[#102235]">
                  Confirm password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...resetForm.register('confirmPassword')}
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFB] py-3 pl-10 pr-11 text-sm outline-none transition focus:border-[#087E87] focus:ring-2 focus:ring-[#087E87]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-3.5 text-slate-500 hover:text-[#102235]"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {resetForm.formState.errors.confirmPassword ? (
                  <p className="mt-1.5 text-sm text-[#C34C4C]">
                    {resetForm.formState.errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white transition hover:bg-[#0d1d2b]"
              >
                Reset password
              </button>
            </form>
          </div>
        ) : null}

        {step === 'success' ? (
          <div className="mx-auto max-w-xl rounded-[28px] border border-[#BFE6D8] bg-[#EAF8F3] p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#16836B] shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-3xl font-light text-[#102235]">Password reset successful</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your password was updated for this browser session. Reloading restores the original password.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-6 rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white transition hover:bg-[#0d1d2b]"
            >
              Return to login
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function AccessGrantedPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const email = (state as { email?: string } | null)?.email ?? ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F8FA] px-4 py-10 text-[#102235]">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl rounded-[30px] border border-[#CFE9E1] bg-[#F1FBF6] p-8 text-center shadow-[0_30px_80px_rgba(22,131,107,0.16)]"
      >
        <BrandLogo className="mx-auto w-44" />
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-[#16836B]">Access granted</p>
        <h1 className="mt-3 text-4xl font-light text-[#102235]">Access confirmed</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Continue to {APP_NAME}{email ? <> as <span className="font-light text-[#102235]">{email}</span></> : null}.
        </p>

        <div className="mt-8 grid gap-3 rounded-2xl border border-[#BFE6D8] bg-white p-4 text-left text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#087E87]" />
            <span>Environment: authorised admin access</span>
          </div>
          <div className="flex items-center gap-2">
            <CircleDashed className="h-4 w-4 text-[#087E87]" />
            <span>Verification reference: LBT-VERIFY-482153</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#087E87]" />
            <span>Safe status: no production credentials used</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-xl bg-[#087E87] px-4 py-3 text-sm font-light text-white transition hover:bg-[#066d75]"
          >
            Continue to dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-xl bg-[#102235] px-4 py-3 text-sm font-light text-white transition hover:bg-[#0d1d2b]"
          >
            Return to login
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default App
export { LebatiApp }
