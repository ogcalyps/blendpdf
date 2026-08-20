import { Dancing_Script, Great_Vibes, Pinyon_Script, Satisfy } from 'next/font/google';

// Decorative signature fonts used ONLY by the form wizards' SignaturePad.
// Kept out of the root layout so their payload doesn't tax every page.

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-dancing-script',
});

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-great-vibes',
});

const pinyonScript = Pinyon_Script({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-pinyon-script',
});

const satisfy = Satisfy({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-satisfy',
});

/** Apply on a wrapper around any UI that renders SignaturePad. */
export const signatureFontsClassName = `${dancingScript.variable} ${greatVibes.variable} ${pinyonScript.variable} ${satisfy.variable}`;
