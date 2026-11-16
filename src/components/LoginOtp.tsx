import { useState, type FormEvent } from 'react'

function issueCode() {
  const [number] = crypto.getRandomValues(new Uint32Array(1))
  return {
    code: String(number % 1_000_000).padStart(6, '0'),
    expiresAt: Date.now() + 5 * 60 * 1000,
  }
}

export default function LoginOtp({ onVerify, onBack }: { onVerify: () => void; onBack: () => void }) {
  const [challenge, setChallenge] = useState(issueCode)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (Date.now() >= challenge.expiresAt) {
      setError('This code has expired. Get a new code to continue.')
      return
    }
    if (value !== challenge.code) {
      setError('The code doesn’t match. Check it and try again.')
      return
    }
    onVerify()
  }

  return (
    <form className="mt-6 space-y-5" onSubmit={verify} aria-label="Sign-in verification">
      <p id="otp-code" className="rounded-xl border border-slate-200 bg-[#F8FAFB] p-4 text-sm leading-6">
        Verification code for this browser: <strong className="tracking-widest">{challenge.code}</strong>.
        The code expires after five minutes.
      </p>
      <div>
        <label htmlFor="login-otp" className="mb-2 block text-sm">Verification code</label>
        <input
          id="login-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value.replace(/\D/g, '').slice(0, 6))
            setError('')
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'otp-code otp-error' : 'otp-code'}
          className="settings-input w-full tracking-widest"
        />
        {error && <p id="otp-error" role="alert" className="mt-2 text-sm text-[#C34C4C]">{error}</p>}
      </div>
      <button type="submit" disabled={value.length !== 6} className="settings-button w-full">Verify and sign in</button>
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className="text-sm text-teal underline underline-offset-4" onClick={onBack}>Back to sign in</button>
        <button type="button" className="text-sm text-teal underline underline-offset-4" onClick={() => {
          setChallenge(issueCode())
          setValue('')
          setError('')
        }}>Get a new code</button>
      </div>
    </form>
  )
}
