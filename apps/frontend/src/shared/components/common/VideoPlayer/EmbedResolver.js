/**
 * Detect if a URL is an embeddable hosted video (YouTube, Vimeo, Google Drive)
 * Keeps original regex from VideoPlayer.jsx getEmbedInfo
 * @param {string} url
 * @returns {{ type: string, embedUrl: string } | null}
 */
export function getEmbedInfo(url) {
  if (!url) return null;

  // YouTube: youtube.com/watch?v=ID or youtu.be/ID or youtube.com/embed/ID
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  if (ytMatch) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1`,
    };
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  const vimeoMatch = url.match(
    /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/,
  );
  if (vimeoMatch) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
    };
  }

  // Google Drive: drive.google.com/file/d/ID/view
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return {
      type: "gdrive",
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    };
  }

  return null; // direct file URL
}

export default getEmbedInfo;
