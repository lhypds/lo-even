// Measuring type for a screen that has one type size and no way to ask how wide
// anything is.
//
// Everything here counts *cells* rather than characters, because lo is read in
// three languages and two of them are not one cell per character: 日本語 is five
// characters and ten cells wide, and a column measured in characters would run a
// Japanese post clean off the right of the screen while leaving an English one
// half empty. The rule is the terminal one — the CJK and fullwidth blocks take
// two cells, combining marks take none, everything else takes one — and it is
// the same rule the display's own fixed-width face is laid out on.

/** How many cells one code point covers: 0 for a combining mark, 2 for wide, else 1. */
function codePointCells(code: number): number {
  // Combining marks hang off the character before them and take no room of
  // their own; counted as 1 they would push every accented line a cell short.
  if (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  ) {
    return 0;
  }
  // The wide blocks, in the order the Unicode charts have them: Hangul jamo,
  // the CJK ideographs and the kana with them, the fullwidth forms, and the
  // emoji that lo's posts are full of.
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

/** How wide a string is, in cells. */
export function cells(value: string): number {
  let total = 0;
  for (const character of value) {
    total += codePointCells(character.codePointAt(0) ?? 0);
  }
  return total;
}

/**
 * The same string cut to fit, with an ellipsis where anything was taken off.
 * The ellipsis costs a cell of its own, so what comes back is never wider than
 * asked for — which is the whole point of it: a column that overruns by one
 * cell is a column that has stopped being a column.
 */
export function clip(value: string, width: number): string {
  const text = value.trim();
  if (width <= 0) return "";
  if (cells(text) <= width) return text;
  let kept = "";
  let used = 0;
  for (const character of text) {
    const size = codePointCells(character.codePointAt(0) ?? 0);
    if (used + size > width - 1) break;
    kept += character;
    used += size;
  }
  return `${kept.trimEnd()}…`;
}

/**
 * Pushed to the right end of a width. This is how the meta half of a heading, the
 * pager in the footer and the value column of a readout all land hard against
 * their right edge: a container has no alignment to set, so the alignment is
 * spaces.
 *
 * There is no `padRight` beside this, and there is no need for one. Every column
 * here is a container of its own with its own left edge, so left alignment is
 * where the text already starts — padding it out would only be writing spaces
 * into empty screen.
 */
export function padLeft(value: string, width: number): string {
  const text = clip(value, width);
  return " ".repeat(Math.max(0, width - cells(text))) + text;
}

/**
 * Broken onto as many lines as it takes, breaking between words where there are
 * words to break between and mid-string where there are not — which is most of
 * the time in Japanese and Chinese, neither of which puts spaces anywhere.
 */
export function wrap(value: string, width: number, maxLines = Infinity): string[] {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || width <= 0) return [];
  const lines: string[] = [];
  let line = "";

  const push = () => {
    if (line) lines.push(line);
    line = "";
  };

  for (const word of text.split(" ")) {
    if (!word) continue;
    const candidate = line ? `${line} ${word}` : word;
    if (cells(candidate) <= width) {
      line = candidate;
      continue;
    }
    push();
    // A single run longer than the line — a Japanese sentence, or a URL — is cut
    // wherever the width runs out, because there is nowhere else to cut it.
    let rest = word;
    while (cells(rest) > width) {
      let piece = "";
      let used = 0;
      for (const character of rest) {
        const size = codePointCells(character.codePointAt(0) ?? 0);
        if (used + size > width) break;
        piece += character;
        used += size;
      }
      if (!piece) break;
      lines.push(piece);
      rest = rest.slice(piece.length);
      if (lines.length >= maxLines) return lines.slice(0, maxLines);
    }
    line = rest;
  }
  push();

  if (lines.length <= maxLines) return lines;
  // Cut short rather than run on, and say so on the last line that survives.
  const kept = lines.slice(0, maxLines);
  kept[kept.length - 1] = clip(`${kept[kept.length - 1]}…`, width);
  return kept;
}
