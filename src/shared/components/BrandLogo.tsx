export function BrandLogo({ decorative = false }: { decorative?: boolean }) {
  return (
    <img
      className="brand-logo"
      src={`${import.meta.env.BASE_URL}SUNVIKA_Logo.png`}
      alt={decorative ? '' : 'Sunvika'}
      width={2145}
      height={733}
      decoding="async"
    />
  );
}
