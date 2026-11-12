'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NavItem } from '@/lib/navigation';
import { getOrganizeTools, getConvertTools, getOptimizeTools, getSecurityTools, getEditTools } from '@/lib/navigation';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const t = useTranslations();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside and prevent body scroll when open
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    // Prevent body scroll when menu is open
    document.body.style.overflow = 'hidden';

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="lg:hidden fixed inset-0 top-16 bg-white z-[60] overflow-y-auto"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      <div ref={menuRef} className="p-4 space-y-6 max-w-full w-full">
        <MobileMenuSection title={t('nav.organize')} items={getOrganizeTools(t)} onClose={onClose} />
        <MobileMenuSection title={t('nav.convert')} items={getConvertTools(t)} onClose={onClose} />
        <MobileMenuSection title={t('nav.optimize')} items={getOptimizeTools(t)} onClose={onClose} />
        <MobileMenuSection title={t('nav.security')} items={getSecurityTools(t)} onClose={onClose} />
        <MobileMenuSection title={t('nav.edit')} items={getEditTools(t)} onClose={onClose} />
        <Link
          href="/forms"
          onClick={onClose}
          className="block py-3 px-2 text-start font-bold text-gray-900 hover:text-primary border-y border-gray-100"
        >
          {t('nav.formTemplates')}
        </Link>
      </div>
    </div>
  );
}

function MobileMenuSection({ title, items, onClose }: { title: string; items: NavItem[]; onClose: () => void }) {
  const t = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 px-2 text-start font-bold text-gray-900 hover:text-primary active:bg-gray-50 transition-colors touch-manipulation"
        type="button"
        aria-expanded={isExpanded}
        aria-controls={`mobile-menu-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span>{title}</span>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5" />
        ) : (
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        )}
      </button>
      {isExpanded && (
        <div
          id={`mobile-menu-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className="ps-4 space-y-1 mt-2"
          role="region"
          aria-label={t('nav.menuItems', { title })}
        >
          {items.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`block py-3 px-3 text-sm rounded-lg transition-colors touch-manipulation ${isActive
                    ? 'bg-orange-50 text-primary font-medium'
                    : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                  </div>
                  {item.badge && (
                    <span
                      className={`ms-2 text-xs px-1.5 py-0.5 rounded font-semibold ${item.badge === 'PRO'
                          ? 'bg-yellow-100 text-yellow-800'
                          : item.badge === 'SOON'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

