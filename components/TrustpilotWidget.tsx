'use client';

import { useEffect, useRef } from 'react';

interface TrustpilotWidgetProps {
  /**
   * Trustpilot Business Unit ID
   * Get this from: https://www.trustpilot.com/review/blendpdf.com
   */
  businessUnitId?: string;
  /**
   * Template ID for the widget type
   * Common templates:
   * - '54ad5defc6454f065c28af8b' - TrustBox (full widget)
   * - '56278e9abfbbba0becde1865' - Mini TrustBox
   * - '54ad5defc6454f065c28af8c' - Carousel
   */
  templateId?: string;
  /**
   * Locale for reviews (en-US, ar-SA, etc.)
   */
  locale?: string;
  /**
   * Widget style variant
   */
  variant?: 'full' | 'mini' | 'carousel';
  /**
   * Height for the widget container
   */
  height?: string;
  /**
   * Width for the widget container
   */
  width?: string;
}

export function TrustpilotWidget({
  businessUnitId = process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID || '',
  templateId,
  locale = 'en-US',
  variant = 'full',
  height = 'auto',
  width = '100%',
}: TrustpilotWidgetProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  // Default template IDs based on variant
  const defaultTemplates = {
    full: '54ad5defc6454f065c28af8b',
    mini: '56278e9abfbbba0becde1865',
    carousel: '54ad5defc6454f065c28af8c',
  };

  const finalTemplateId = templateId || defaultTemplates[variant];

  useEffect(() => {
    // Load Trustpilot script
    if (!scriptLoadedRef.current) {
      const script = document.createElement('script');
      script.src = '//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';
      script.async = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        loadWidget();
      };
      document.head.appendChild(script);
    } else {
      loadWidget();
    }

    function loadWidget() {
      if (window.Trustpilot && widgetRef.current) {
        try {
          window.Trustpilot.loadFromElement(widgetRef.current, true);
        } catch (error) {
          console.error('Error loading Trustpilot widget:', error);
        }
      }
    }
  }, [businessUnitId, finalTemplateId, locale]);

  if (!businessUnitId) {
    console.warn('Trustpilot Business Unit ID is not set. Set NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID environment variable.');
    return null;
  }

  return (
    <div
      ref={widgetRef}
      className="trustpilot-widget"
      data-locale={locale}
      data-template-id={finalTemplateId}
      data-businessunit-id={businessUnitId}
      data-style-height={height}
      data-style-width={width}
      style={{ minHeight: height === 'auto' ? '200px' : height }}
    />
  );
}

// TypeScript declaration for Trustpilot global
declare global {
  interface Window {
    Trustpilot?: {
      loadFromElement: (element: HTMLElement, reload?: boolean) => void;
    };
  }
}
