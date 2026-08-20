#!/usr/bin/env node
/**
 * generate-llms-full.js
 *
 * Generates public/llms-full.txt by combining:
 *   1. public/llms.txt verbatim (header + tool list) as the preamble
 *   2. "# Tool details and FAQs" — built by walking messages/en.json for every
 *      namespace that has a `faq` object containing { question, answer } pairs
 *   3. "# Policies" — the site's limits / deletion / privacy facts
 *
 * Output is deterministic: namespaces are sorted alphabetically, and Q/A pairs
 * within a namespace keep their source order from en.json.
 *
 * Usage: node scripts/generate-llms-full.js
 * No dependencies beyond Node's built-in fs/path.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LLMS_TXT_PATH = path.join(ROOT, 'public', 'llms.txt');
const MESSAGES_EN_PATH = path.join(ROOT, 'messages', 'en.json');
const OUTPUT_PATH = path.join(ROOT, 'public', 'llms-full.txt');

/** Collapse internal whitespace/newlines into single spaces and trim. */
function normalizeText(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

/** True when the value is a { question: string, answer: string } pair. */
function isQaPair(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.question === 'string' &&
    value.question.trim() !== '' &&
    typeof value.answer === 'string' &&
    value.answer.trim() !== ''
  );
}

/**
 * A namespace qualifies when it has a `faq` object with at least one
 * question/answer pair.
 */
function hasFaq(namespaceValue) {
  if (namespaceValue === null || typeof namespaceValue !== 'object') return false;
  const faq = namespaceValue.faq;
  if (faq === null || typeof faq !== 'object' || Array.isArray(faq)) return false;
  return Object.values(faq).some(isQaPair);
}

/** Pick a human-readable title: `title`, then `meta.title`, then the namespace key. */
function resolveTitle(namespaceKey, namespaceValue) {
  if (typeof namespaceValue.title === 'string' && namespaceValue.title.trim() !== '') {
    return normalizeText(namespaceValue.title);
  }
  const meta = namespaceValue.meta;
  if (
    meta !== null &&
    typeof meta === 'object' &&
    typeof meta.title === 'string' &&
    meta.title.trim() !== ''
  ) {
    return normalizeText(meta.title);
  }
  return namespaceKey;
}

function buildFaqSection(messages) {
  const namespaces = Object.keys(messages)
    .filter((key) => hasFaq(messages[key]))
    .sort();

  if (namespaces.length === 0) {
    throw new Error('No namespaces with faq question/answer pairs found in messages/en.json');
  }

  const parts = ['# Tool details and FAQs'];

  for (const namespaceKey of namespaces) {
    const namespaceValue = messages[namespaceKey];
    const lines = ['## ' + resolveTitle(namespaceKey, namespaceValue), ''];

    for (const [entryKey, entryValue] of Object.entries(namespaceValue.faq)) {
      if (!isQaPair(entryValue)) {
        console.warn(
          'Skipping malformed faq entry ' + namespaceKey + '.faq.' + entryKey +
          ' (expected string question/answer)'
        );
        continue;
      }
      lines.push('Q: ' + normalizeText(entryValue.question));
      lines.push('A: ' + normalizeText(entryValue.answer));
      lines.push('');
    }

    parts.push(lines.join('\n').trimEnd());
  }

  return parts.join('\n\n');
}

function buildPoliciesSection() {
  return [
    '# Policies',
    '',
    '- Free to use: no account, no sign-up, no watermark on output, and no paywall.',
    '- Downloads never require an email address. An optional email-delivery feature exists if you want the result sent to your inbox.',
    '- Limits: 50 MB per file. Merge accepts up to 20 files (100 MB total per merge).',
    '- Uploaded files are deleted from our servers within 1 hour; most are deleted immediately after processing.',
    '- Privacy: document contents are never read, stored, or shared. The site uses Google Analytics for aggregate, anonymous usage measurement only.',
    '- Privacy policy: https://blendpdf.com/privacy - Terms of service: https://blendpdf.com/terms',
  ].join('\n');
}

function main() {
  const preamble = fs.readFileSync(LLMS_TXT_PATH, 'utf8').trimEnd();

  let messages;
  try {
    messages = JSON.parse(fs.readFileSync(MESSAGES_EN_PATH, 'utf8'));
  } catch (err) {
    throw new Error('Failed to parse ' + MESSAGES_EN_PATH + ': ' + err.message);
  }

  const output =
    preamble + '\n\n' + buildFaqSection(messages) + '\n\n' + buildPoliciesSection() + '\n';

  // Sanity checks: catch accidental object stringification or missing values.
  if (output.includes('[object Object]') || /\b(?:undefined|null)\b/.test(output)) {
    throw new Error('Generated output contains "[object Object]", "undefined", or "null" — refusing to write.');
  }

  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');

  const bytes = Buffer.byteLength(output, 'utf8');
  console.log('Wrote ' + path.relative(ROOT, OUTPUT_PATH) + ' (' + bytes + ' bytes)');
}

main();
