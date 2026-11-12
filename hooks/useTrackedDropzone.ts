'use client';

import { useCallback, useEffect } from 'react';
import { useDropzone, type DropzoneOptions, type DropzoneState, type FileRejection } from 'react-dropzone';
import { trackFileUpload, type UploadSource } from '@/lib/analytics';
import { acceptsFile, takeHandoff } from '@/lib/file-handoff';

export interface TrackedDropzoneOptions extends DropzoneOptions {
  /**
   * Which slot this dropzone fills, emitted as upload_role. Leave unset for
   * the file the tool operates on; set it on secondary dropzones (watermark
   * image, spreadsheet of form data) so they can be segmented out in GA4.
   */
  uploadRole?: string;
  /** Defaults to 'local'. */
  uploadSource?: UploadSource;
}

/**
 * Drop-in replacement for react-dropzone's useDropzone that fires the
 * file_upload event for every accepted file before delegating to the caller's
 * onDrop.
 *
 * Every tool page used to call useDropzone directly and only UploadZone
 * remembered to track, so file_upload undercounted the funnel by ~15x. Routing
 * the tracking through the hook makes it impossible to forget, the same way
 * downloadBlob owns trackDownload for the download side.
 *
 * Files rejected by the dropzone itself (wrong type, oversized, too many) are
 * not counted; files accepted here but later rejected by the page's own
 * validateFile are, since the user did hand them to us.
 *
 * The tool's main dropzone (no uploadRole) also picks up a file handed over by
 * "Keep working on this file" (lib/file-handoff) when it mounts, and passes it
 * to onDrop as if it had been dropped, so every tool page accepts one without
 * changes of its own.
 */
export function useTrackedDropzone({
  uploadRole,
  uploadSource = 'local',
  onDrop,
  ...options
}: TrackedDropzoneOptions = {}): DropzoneState {
  const trackedOnDrop = useCallback<NonNullable<DropzoneOptions['onDrop']>>(
    (acceptedFiles, fileRejections, event) => {
      trackFileUpload(acceptedFiles, uploadSource, uploadRole);
      onDrop?.(acceptedFiles, fileRejections, event);
    },
    [onDrop, uploadRole, uploadSource]
  );

  // Mount only: the handoff is one-shot, and later renders must not take a newer one
  useEffect(() => {
    if (uploadRole || options.disabled) return;
    const handoff = takeHandoff();
    if (!handoff || !acceptsFile(options.accept, handoff.file)) return;
    const { file } = handoff;
    const event = new Event('drop');
    if (options.maxSize !== undefined && file.size > options.maxSize) {
      const rejections: FileRejection[] = [
        { file, errors: [{ code: 'file-too-large', message: `File is larger than ${options.maxSize} bytes` }] },
      ];
      options.onDropRejected?.(rejections, event);
      onDrop?.([], rejections, event);
      return;
    }
    // A drop on the home page's "Drop a PDF to start" is the visitor's own file, not a previous result
    trackFileUpload([file], handoff.from === 'home' ? 'home' : 'keep_working', 'document');
    onDrop?.([file], [], event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useDropzone({ ...options, onDrop: trackedOnDrop });
}
