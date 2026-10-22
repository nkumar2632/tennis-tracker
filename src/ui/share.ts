/**
 * Hand files to the iPhone share sheet (Messages, Mail, AirDrop, Save to Files), or download them
 * where sharing files isn't supported. Must be called directly from a tap: iOS refuses the share
 * sheet once the tap's "user activation" has passed, so build the files before the tap.
 */
export async function shareFiles(files: File[]): Promise<'shared' | 'cancelled' | 'downloaded'> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: files.map((f) => f.name).join(', ') });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Anything else (e.g. type not allowed): fall back to a download.
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'downloaded';
}

export function shareFile(file: File): Promise<'shared' | 'cancelled' | 'downloaded'> {
  return shareFiles([file]);
}
