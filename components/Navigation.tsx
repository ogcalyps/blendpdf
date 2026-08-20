'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Menu, X } from 'lucide-react';
import { NavDropdown } from '@/components/NavDropdown';
import { MobileNav } from '@/components/MobileNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Logo } from '@/components/Logo';
import { getOrganizeTools, getConvertTools, getOptimizeTools, getSecurityTools, getEditTools } from '@/lib/navigation';

export function Navigation() {
  const t = useTranslations();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b border-orange-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-16 min-w-0">
          {/* Logo (left) */}
          <Link href="/" className="no-underline flex-shrink-0 min-w-0">
            <Logo size={40} showText={true} />
          </Link>

          {/* Desktop Navigation groups (center) */}
          <div className="hidden lg:flex items-center gap-1">
            <NavDropdown title={t('nav.organize')} items={getOrganizeTools(t)} />
            <NavDropdown title={t('nav.convert')} items={getConvertTools(t)} />
            <NavDropdown title={t('nav.optimize')} items={getOptimizeTools(t)} />
            <NavDropdown title={t('nav.security')} items={getSecurityTools(t)} />
            <NavDropdown title={t('nav.edit')} items={getEditTools(t)} />
            <Link
              href="/forms"
              className="px-3 py-2 text-gray-700 hover:text-primary font-medium transition-colors rounded-lg hover:bg-orange-50"
            >
              {t('nav.formTemplates')}
            </Link>
            <Link
              href="/blog"
              className="px-3 py-2 text-gray-700 hover:text-primary font-medium transition-colors rounded-lg hover:bg-orange-50"
            >
              {t('nav.blog')}
            </Link>
          </div>

          {/* Right side: Language switcher and mobile menu */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Language switcher */}
            <div className="hidden lg:block">
              <LanguageSwitcher />
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0"
              aria-label={t('nav.toggleMenu')}
              type="button"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Language switcher on mobile (stays accessible while the menu is open) */}
            <div className="lg:hidden flex-shrink-0">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile navigation menu */}
      <MobileNav isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </nav>
  );
}

