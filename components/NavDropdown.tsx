'use client';

import { useState, useRef, useEffect } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { ChevronDown } from 'lucide-react';
import type { NavItem } from '@/lib/navigation';

interface NavDropdownProps {
  title: string;
  items: NavItem[];
}

export function NavDropdown({ title, items }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Check if any item in this dropdown is active
  const isActive = items.some((item) => pathname === item.href || pathname?.startsWith(item.href + '/'));

  const handleMouseEnter = () => {
    // Clear any pending close timeout
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // Add a small delay before closing to allow moving to dropdown
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150); // 150ms delay
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Close on Escape (returning focus to the trigger) and on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
          isActive
            ? 'text-primary bg-orange-50'
            : 'text-gray-700 hover:text-primary hover:bg-orange-50'
        }`}
      >
        {title}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Invisible bridge to prevent gap */}
      {isOpen && (
        <div className="absolute start-0 top-full w-full h-1" />
      )}

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute start-0 top-full pt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
          <div className="p-2">
            {items.map((item) => {
              const isItemActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-2.5 text-sm rounded-lg transition-colors ${
                    isItemActive
                      ? 'bg-orange-50 text-primary'
                      : 'text-gray-700 hover:bg-orange-50 hover:text-primary'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                    </div>
                    {item.badge && (
                      <span
                        className={`ms-2 text-xs px-1.5 py-0.5 rounded font-semibold ${
                          item.badge === 'PRO'
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
        </div>
      )}
    </div>
  );
}
