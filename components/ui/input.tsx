import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg border border-ink-900/20 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-900/40 focus:outline-none focus:ring-2 focus:ring-clay-500 ${className}`}
      {...props}
    />
  )
}