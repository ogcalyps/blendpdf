import { ReactNode } from 'react';
import { Link } from '@/i18n/routing';

interface ToolCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: 'green' | 'orange' | 'yellow';
  href: string;
  iconBgColor?: string;
  iconColor?: string;
}

export function ToolCard({ 
  icon, 
  title, 
  description, 
  badge,
  badgeColor,
  href,
  iconBgColor = "bg-orange-100",
  iconColor = "text-primary"
}: ToolCardProps) {
  // Determine badge color based on badge text or explicit prop
  const getBadgeClasses = () => {
    if (badgeColor) {
      const colors = {
        green: 'bg-green-100 text-green-700',
        orange: 'bg-orange-100 text-orange-700',
        yellow: 'bg-yellow-100 text-yellow-700',
      };
      return colors[badgeColor];
    }
    
    // Auto-detect based on badge text
    if (badge?.toLowerCase().includes('most used') || badge?.toLowerCase().includes('most')) {
      return 'bg-green-100 text-green-700';
    }
    if (badge?.toLowerCase().includes('save') || badge?.toLowerCase().includes('90%')) {
      return 'bg-orange-100 text-orange-700';
    }
    if (badge?.toLowerCase().includes('coming soon') || badge?.toLowerCase().includes('soon')) {
      return 'bg-yellow-100 text-yellow-700';
    }
    
    // Default to green
    return 'bg-green-100 text-green-700';
  };

  return (
    <Link 
      href={href}
      className="tool-card bg-white rounded-2xl p-6 cursor-pointer border-2 border-orange-100 hover:border-primary transition-all duration-300 hover:shadow-xl hover:-translate-y-1 block no-underline"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`${iconBgColor} rounded-xl p-3`}>
          <div className={`w-7 h-7 ${iconColor}`}>
            {icon}
          </div>
        </div>
        {badge && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider ${getBadgeClasses()}`}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-dark mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );
}
