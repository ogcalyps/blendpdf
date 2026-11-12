import JSZip from 'jszip';
import { downloadBlob } from './utils';

export async function createZipBlob(files: { name: string, bytes: Uint8Array }[]): Promise<Blob> {
    const zip = new JSZip();
    files.forEach(file => {
        zip.file(file.name, file.bytes);
    });

    return zip.generateAsync({ type: 'blob' });
}

/** The files inside a ZIP, in archive order, folders left out. */
export async function readZipFiles(blob: Blob): Promise<{ name: string, bytes: Uint8Array }[]> {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const files = Object.values(zip.files).filter(file => !file.dir);
    return Promise.all(files.map(async file => ({ name: file.name, bytes: await file.async('uint8array') })));
}

export async function createZipAndDownload(files: { name: string, bytes: Uint8Array }[], zipFilename: string) {
    const blob = await createZipBlob(files);
    downloadBlob(blob, zipFilename);
}
