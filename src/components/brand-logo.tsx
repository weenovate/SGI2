import Image from "next/image";

/**
 * Logo institucional FuENN. Tamaños recomendados: header (h-8) y sidebar (h-10).
 */
export function BrandLogo({ className, height = 32 }: { className?: string; height?: number }) {
  return (
    <Image
      src="/branding/logo.png"
      alt="FuENN"
      width={Math.round(height * (3.0))} // logo es ~3:1
      height={height}
      priority
      className={className}
    />
  );
}
