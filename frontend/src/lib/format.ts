/** "https://docs.python.org/3/tutorial" -> "docs.python.org" */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Page titles often end in " — Site Name". The site is shown separately, so drop it. */
export function cleanTitle(title: string): string {
  return title.replace(/\s+[—|–-]\s+[^—|–-]+$/, '').trim() || title;
}

export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
