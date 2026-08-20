import JSZip from 'jszip';

export async function createZipAndDownload(files: { name: string, bytes: Uint8Array }[], zipFilename: string) {
    const zip = new JSZip();
    files.forEach(file => {
        zip.file(file.name, file.bytes);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
