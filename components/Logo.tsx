interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 40, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Icon */}
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 80 80" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Page 1 - Back */}
        <rect x="15" y="25" width="28" height="36" rx="2" fill="#FF6B35" opacity="0.5"/>
        <path d="M 41 25 L 41 30 L 43 25 Z" fill="#E85A2B"/>
        
        {/* Page 2 - Middle */}
        <rect x="23" y="20" width="28" height="36" rx="2" fill="#FF8B68"/>
        <path d="M 49 20 L 49 25 L 51 20 Z" fill="#E0754D"/>
        <line x1="28" y1="28" x2="46" y2="28" stroke="white" strokeWidth="1.5" opacity="0.5"/>
        <line x1="28" y1="33" x2="46" y2="33" stroke="white" strokeWidth="1.5" opacity="0.5"/>
        
        {/* Page 3 - Front */}
        <rect x="31" y="15" width="28" height="36" rx="2" fill="#00C9A7"/>
        <path d="M 57 15 L 57 20 L 59 15 Z" fill="#00B090"/>
        <line x1="36" y1="23" x2="54" y2="23" stroke="white" strokeWidth="1.5" opacity="0.6"/>
        <line x1="36" y1="28" x2="54" y2="28" stroke="white" strokeWidth="1.5" opacity="0.6"/>
        <line x1="36" y1="33" x2="50" y2="33" stroke="white" strokeWidth="1.5" opacity="0.6"/>
      </svg>
      
      {/* Text */}
      {showText && (
        <div className="text-xl sm:text-2xl font-extrabold text-dark whitespace-nowrap">
          BlendPDF
        </div>
      )}
    </div>
  );
}

