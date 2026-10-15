import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Save a text file: download on the web, share sheet in the native apps. */
export async function saveTextFile(name: string, text: string, mime = 'application/json'): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const f = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, files: [f.uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Share a link via the native share sheet / Web Share API, falling back to the clipboard. */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title, url });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (err) {
    return (err as Error).name === 'AbortError' ? 'shared' : 'failed';
  }
}
