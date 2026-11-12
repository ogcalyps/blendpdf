import { describe, it, expect, afterEach } from 'vitest';
import { trackFileUpload, fileSizeMeta, trackDownload, trackToolError, responseError } from '../lib/analytics';
import { EditPdfError } from '../lib/edit-pdf/types';

type GtagCall = [string, string, Record<string, unknown>];

/**
 * The event layer is a deliberate no-op without gtag, so every assertion here
 * installs a fake window (the suite runs in the node environment).
 */
function installWindow(pathname: string): GtagCall[] {
  const calls: GtagCall[] = [];
  (globalThis as any).window = {
    location: { pathname },
    gtag: (...args: GtagCall) => {
      calls.push(args);
    },
  };
  return calls;
}

function makeFile(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
}

describe('fileSizeMeta', () => {
  it('reports the count and the total size rounded to two decimals', () => {
    const meta = fileSizeMeta([makeFile('a.pdf', 1_500_000), makeFile('b.pdf', 500_000)]);
    expect(meta).toEqual({ file_count: 2, total_size_mb: 1.91 });
  });

  it('reports zeroes for an empty set', () => {
    expect(fileSizeMeta([])).toEqual({ file_count: 0, total_size_mb: 0 });
  });
});

describe('trackFileUpload', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('emits file_upload with the tool derived from the path', () => {
    const calls = installWindow('/en/merge-pdf');

    trackFileUpload([makeFile('a.pdf', 1_048_576)]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      'event',
      'file_upload',
      {
        tool_name: 'merge_pdf',
        upload_source: 'local',
        upload_role: 'document',
        file_count: 1,
        total_size_mb: 1,
      },
    ]);
  });

  it('carries the upload source and role when given', () => {
    const calls = installWindow('/ar/watermark-pdf');

    trackFileUpload([makeFile('logo.png', 0)], 'keep_working', 'watermark_image');

    expect(calls[0][2]).toMatchObject({
      tool_name: 'watermark_pdf',
      upload_source: 'keep_working',
      upload_role: 'watermark_image',
    });
  });

  it('stays silent when nothing was accepted', () => {
    const calls = installWindow('/en/split-pdf');

    trackFileUpload([]);

    expect(calls).toHaveLength(0);
  });

  it('is a no-op without gtag, so a blocked analytics script cannot break an upload', () => {
    (globalThis as any).window = { location: { pathname: '/en/split-pdf' } };

    expect(() => trackFileUpload([makeFile('a.pdf', 10)])).not.toThrow();
  });

  it('never lets a throwing gtag escape into the upload path', () => {
    (globalThis as any).window = {
      location: { pathname: '/en/split-pdf' },
      gtag: () => {
        throw new Error('gtag exploded');
      },
    };

    expect(() => trackFileUpload([makeFile('a.pdf', 10)])).not.toThrow();
  });
});

describe('trackDownload', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('emits file_download alongside the upload event on the same tool slug', () => {
    const calls = installWindow('/en/pdf-to-word');

    trackDownload('result.docx');

    expect(calls[0][2]).toEqual({
      tool_name: 'pdf_to_word',
      file_extension: 'docx',
    });
  });

  // Download names are built from the visitor's upload, and gtag sends event
  // params even when analytics consent was declined (Consent Mode advanced).
  it('never sends any part of the filename except a plain extension', () => {
    const calls = installWindow('/en/add-page-numbers');

    trackDownload('Contrat de bail - Dupont_numbered.pdf');
    trackDownload('Jean.Dupont passport scan');
    trackDownload('no-extension');

    const params = calls.map((call) => call[2]);
    expect(params.map((p) => p.file_extension)).toEqual(['pdf', 'unknown', 'unknown']);
    for (const p of params) {
      expect(Object.keys(p).sort()).toEqual(['file_extension', 'tool_name']);
      expect(JSON.stringify(p)).not.toMatch(/Dupont|passport/);
    }
  });
});

/**
 * A 4xx means the tool looked at the input and correctly declined it; a 5xx (or
 * a thrown error with no status, i.e. a client-side crash) means the tool broke.
 * Before these were split, `tool_process_error` counted both, which is why
 * unlock_pdf read as failing 5 times out of 6 when all five were wrong passwords.
 */
describe('trackToolError classification', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  const eventNames = (calls: GtagCall[]) => calls.map((c) => c[1]);

  it('counts a correctly-declined 4xx as tool_input_rejected, not a failure', () => {
    const calls = installWindow('/en/unlock-pdf');

    trackToolError('unlock_pdf', responseError({ status: 400 }, 'Wrong password', 'WRONG_PASSWORD'));

    expect(eventNames(calls)).toEqual(['tool_input_rejected']);
    expect(calls[0][2]).toMatchObject({
      tool_name: 'unlock_pdf',
      status_code: 400,
      error_code: 'WRONG_PASSWORD',
    });
  });

  it('counts a 429 as a rejection too — rate limiting is the tool working', () => {
    const calls = installWindow('/en/pdf-to-word');
    trackToolError('pdf_to_word', responseError({ status: 429 }, 'Too many requests', 'RATE_LIMITED'));
    expect(eventNames(calls)).toEqual(['tool_input_rejected']);
  });

  it('counts the editor declining a file (refused page, encrypted, unreadable) as tool_input_rejected', () => {
    for (const code of ['REPLACE_REFUSED', 'ENCRYPTED', 'UNREADABLE'] as const) {
      const calls = installWindow('/en/edit-pdf');
      trackToolError('edit_pdf', new EditPdfError(code));
      expect(eventNames(calls)).toEqual(['tool_input_rejected']);
      expect(calls[0][2]).toMatchObject({ tool_name: 'edit_pdf', error_code: code });
    }
  });

  it('counts the editor failing (engine missing, unverified removal, bad request) as tool_process_error', () => {
    for (const code of ['REPLACE_FAILED', 'REPLACE_UNAVAILABLE', 'INVALID_REQUEST'] as const) {
      const calls = installWindow('/en/edit-pdf');
      trackToolError('edit_pdf', new EditPdfError(code));
      expect(eventNames(calls)).toEqual(['tool_process_error']);
    }
  });

  it('counts a 5xx as tool_process_error', () => {
    const calls = installWindow('/en/pdf-to-word');

    trackToolError('pdf_to_word', responseError({ status: 500 }, 'Conversion failed', 'CONVERTER_CRASHED'));

    expect(eventNames(calls)).toEqual(['tool_process_error']);
    expect(calls[0][2]).toMatchObject({ status_code: 500, error_code: 'CONVERTER_CRASHED' });
  });

  it('counts a statusless throw — a client-side crash — as tool_process_error', () => {
    const calls = installWindow('/en/rotate-pdf');

    trackToolError('rotate_pdf', new Error('Cannot read properties of undefined'));

    expect(eventNames(calls)).toEqual(['tool_process_error']);
    expect(calls[0][2]).not.toHaveProperty('status_code');
  });

  it('truncates the error message to 100 characters', () => {
    const calls = installWindow('/en/merge-pdf');
    trackToolError('merge_pdf', new Error('x'.repeat(250)));
    expect((calls[0][2].error_message as string).length).toBe(100);
  });
});

describe('responseError', () => {
  it('carries the status so the tracker can classify it', () => {
    const error = responseError({ status: 413 }, 'Too large', 'FILE_TOO_LARGE');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Too large');
    expect(error.status).toBe(413);
    expect(error.errorCode).toBe('FILE_TOO_LARGE');
  });

  it('leaves errorCode unset when the server did not send one', () => {
    expect(responseError({ status: 500 }, 'Boom').errorCode).toBeUndefined();
  });
});
