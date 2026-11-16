export default function BrandLogo({ className }: { className: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}Lebathi%20Logo.svg`}
      alt="Lebathi"
      width={17000}
      height={5284}
      className={`block h-auto max-w-full ${className}`}
    />
  )
}
