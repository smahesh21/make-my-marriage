import Link from "next/link";

type AuthBrandProps = {
  className?: string;
  markClassName?: string;
};

export function AuthBrand({ className = "auth-design-brand", markClassName = "auth-design-brand__mark" }: AuthBrandProps) {
  return (
    <Link className={className} href="/" aria-label="Make My Marriage home">
      <svg className={markClassName} viewBox="0 0 280 64" fill="none" aria-hidden="true">
        <g transform="translate(4, 8)">
          <rect x="0" y="0" width="48" height="48" rx="14" fill="#75836D" fillOpacity="0.12" stroke="#75836D" strokeOpacity="0.3" strokeWidth="1.2" />
          <circle cx="20" cy="24" r="11" stroke="#75836D" strokeWidth="2.5" />
          <circle cx="28" cy="24" r="11" stroke="#292C29" strokeWidth="2.5" />
          <path d="M24 16.5C25.5 19 25.5 29 24 31.5" stroke="#75836D" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M17 11 18 13.5 20.5 14.5 18 15.5 17 18 16 15.5 13.5 14.5 16 13.5Z" fill="#75836D" />
          <circle cx="31" cy="14" r="1.8" fill="#292C29" />
        </g>
        <text x="64" y="29" fontFamily="'Noto Serif', Georgia, serif" fontSize="20" fontWeight="600" fill="#292C29" letterSpacing="-0.3">Make My Marriage</text>
        <text x="65" y="44" fontFamily="Inter, sans-serif" fontSize="9.5" fontWeight="500" fill="#75836D" letterSpacing="1.4">WEDDING WORKSPACE</text>
      </svg>
    </Link>
  );
}
