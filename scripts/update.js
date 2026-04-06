function parseItem(item) {
  const rawTitle = item.title || '';

  // Extract version first (before cleaning)
  const versionMatch = rawTitle.match(/v?(\d+[\d.]*[a-zA-Z0-9]*)/);
  const version = versionMatch ? versionMatch[1] : null;

  let name = rawTitle;

  // Remove everything in brackets [...] and parentheses (...)
  name = name.replace(/\[.*?\]/g, '');
  name = name.replace(/\(.*?\)/g, '');

  // Remove common repack/edition suffixes
  name = name.replace(/\b(RePack|Repack|REPACK)\b.*/gi, '');
  name = name.replace(/\b(Complete Edition|Digital Deluxe|Deluxe Edition|Gold Edition|Ultimate Edition)\b.*/gi, '');
  name = name.replace(/\b(MULTi\d+|multi\d+)\b.*/gi, '');
  name = name.replace(/\bFrom\s+\w+\b.*/gi, '');
  name = name.replace(/–.*/g, '');
  name = name.replace(/\+\s*(All\s+)?DLC.*/gi, '');
  name = name.replace(/\bBuild\s+[\d\w]+/gi, '');
  name = name.replace(/\bPatch\b.*/gi, '');
  name = name.replace(/\bv\d[\d.]*\b/gi, '');
  name = name.replace(/\b\d[\d.]*\b/g, '');

  // Clean leftover punctuation and spaces
  name = name.replace(/[,;:\-\/\\]+\s*$/g, '');
  name = name.replace(/\s{2,}/g, ' ');
  name = name.trim();

  return {
    name:       name || rawTitle,
    version:    version,
    size:       item.fileSize || null,
    magnet:     (item.uris && item.uris[0]) || null,
    uploadDate: item.uploadDate || null,
    cover:      null,
  };
}
