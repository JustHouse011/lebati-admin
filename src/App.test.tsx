import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LebatiApp } from './App'
import { getStoredSessionUser } from './services/mockAuth'

describe('Lebati Stage A flows', () => {
  it('shows validation errors for invalid login input', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LebatiApp />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'invalid-email' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/enter a valid business email address/i)).toBeInTheDocument()
    })
  })

  it('requires the OTP after validating credentials before opening the dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LebatiApp />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'bnombamba@icloud.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: '12345678' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByRole('heading', { name: 'Verify your sign-in' }, { timeout: 3000 })
    expect(getStoredSessionUser()).toBeNull()

    const input = screen.getByLabelText('Verification code', { exact: true })
    const verify = screen.getByRole('button', { name: 'Verify and sign in' })
    const code = screen.getByText(/verification code for this browser/i).querySelector('strong')!.textContent!
    fireEvent.change(input, { target: { value: code === '000000' ? '000001' : '000000' } })
    fireEvent.click(verify)
    expect(screen.getByRole('alert')).toHaveTextContent(/code doesn’t match/i)
    expect(getStoredSessionUser()).toBeNull()

    fireEvent.change(input, { target: { value: code } })
    fireEvent.click(verify)

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: /Global Administrator/i })).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
  })

  it('resets a password with the mock recovery flow', async () => {
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <LebatiApp />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'bnombamba@icloud.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /request reset link/i }))

    await waitFor(() => {
      expect(screen.getByText(/reset instructions ready/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /continue to reset password/i }))

    fireEvent.change(screen.getByLabelText('Reset token'), {
      target: { value: 'LBT-482153' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewPassword123!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'NewPassword123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText(/password reset successful/i)).toBeInTheDocument()
    })
  })
})
