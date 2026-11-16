export default function BrandLogo({ className }: { className: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}Lebathi%20Logo.svg`}
      alt="Lebathi"
      width={24893}
      height={4702}
      className={`block h-auto max-w-full ${className}`}
    />
  )
}
