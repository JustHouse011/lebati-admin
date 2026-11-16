import { APP_NAME } from '../appName'

export default function BrandLogo({ className }: { className: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}Lebathi%20Logo.svg`}
      alt={APP_NAME}
      width={17000}
      height={5284}
      className={`block h-auto max-w-full ${className}`}
    />
  )
}
