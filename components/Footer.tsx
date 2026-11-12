'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Shield } from 'lucide-react';
import {
  getOrganizeTools,
  getConvertTools,
  getOptimizeTools,
  getSecurityTools,
  getEditTools,
} from '@/lib/navigation';

export function Footer() {
  const t = useTranslations();

  const toolColumns = [
    { title: t('nav.organize'), items: getOrganizeTools(t) },
    { title: t('nav.convert'), items: getConvertTools(t) },
    { title: t('nav.optimize'), items: getOptimizeTools(t) },
    { title: t('nav.security'), items: getSecurityTools(t) },
    { title: t('nav.edit'), items: getEditTools(t) },
  ];

  return (
    <footer className="bg-white/60 backdrop-blur-sm border-t border-orange-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-x-8 gap-y-10">
          {toolColumns.map((column) => (
            <div key={column.title} className="min-w-[140px] flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {column.title}
              </h3>
              <ul className="space-y-2">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-600 hover:text-primary"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Resources */}
          <div className="min-w-[140px] flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {t('footer.resources')}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/guides" className="text-sm text-gray-600 hover:text-primary">
                  {t('footer.guides')}
                </Link>
              </li>
              <li>
                <Link href="/compare" className="text-sm text-gray-600 hover:text-primary">
                  {t('footer.compare')}
                </Link>
              </li>
              <li>
                <Link href="/pdf-upload-limits" className="text-sm text-gray-600 hover:text-primary">
                  {t('footer.uploadLimits')}
                </Link>
              </li>
              {/* The link needs only the domain; the business unit ID is for the homepage widget */}
              <li>
                <a
                  href={`https://www.trustpilot.com/review/${process.env.NEXT_PUBLIC_TRUSTPILOT_DOMAIN || 'blendpdf.com'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-primary inline-flex items-center gap-1"
                  aria-label={t('footer.readReviews')}
                >
                  <Shield className="w-4 h-4" />
                  <span>{t('footer.reviews')}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="min-w-[140px] flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {t('footer.legal')}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-sm text-gray-600 hover:text-primary">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-gray-600 hover:text-primary">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <a
                  href="mailto:contact@blendpdf.com"
                  className="text-sm text-gray-600 hover:text-primary"
                >
                  {t('footer.contact')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-orange-100 text-center text-sm text-gray-500">
          {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
