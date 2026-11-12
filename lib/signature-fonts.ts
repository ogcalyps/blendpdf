import { Dancing_Script, Great_Vibes, Pinyon_Script, Satisfy } from 'next/font/google';

// Decorative fonts for SignaturePad's typed styles. SignaturePad imports this
// module when it mounts and applies signatureFontsClassName on its own root,
// so every page that shows the pad (sign-pdf, the form templates, the editor)
// gets the variables without loading them up front. preload is off for the
// same reason: the pad awaits document.fonts.load() before it draws.

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  preload: false,
  weight: ['700'],
  variable: '--font-dancing-script',
});

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  preload: false,
  weight: ['400'],
  variable: '--font-great-vibes',
});

const pinyonScript = Pinyon_Script({
  subsets: ['latin'],
  preload: false,
  weight: ['400'],
  variable: '--font-pinyon-script',
});

const satisfy = Satisfy({
  subsets: ['latin'],
  preload: false,
  weight: ['400'],
  variable: '--font-satisfy',
});

/** Defines the --font-* variables SignaturePad reads (it applies this on its root). */
export const signatureFontsClassName = `${dancingScript.variable} ${greatVibes.variable} ${pinyonScript.variable} ${satisfy.variable}`;
