// Chunking: ~1800 chars (~450 tokens) with 250-char overlap, split per page so every chunk keeps its page number.
export function chunkPages(pages: string[], size = 1800, overlap = 250) {
  const out: { content: string; page: number }[] = [];
  pages.forEach((raw, p) => {
    const text = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    let s = 0;
    while (s < text.length) {
      let e = Math.min(s + size, text.length);
      if (e < text.length) { // prefer ending at a sentence boundary
        const cut = text.lastIndexOf(". ", e);
        if (cut > s + size * 0.6) e = cut + 1;
      }
      const c = text.slice(s, e).trim();
      if (c.length > 80) out.push({ content: c, page: p + 1 });
      if (e >= text.length) break;
      s = e - overlap;
    }
  });
  return out;
}
