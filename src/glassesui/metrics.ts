// Measuring type for a screen that has one type size and no way to ask how wide
// anything is.
//
// There are two measures here and the difference between them matters.
//
// **Cells**, which is what columns of type are cut to. Cells rather than
// characters because lo is read in three languages and two of them are not one
// cell per character: 日本語 is five characters and ten cells wide, and a column
// measured in characters would run a Japanese post clean off the right of the
// screen while leaving an English one half empty. The rule is the terminal one —
// the CJK and fullwidth blocks take two cells, combining marks take none,
// everything else takes one.
//
// **Pixels**, which is what the display actually sets. The face is not fixed
// width: `l` is four pixels where `@` is seventeen and 日 is twenty, every one of
// them measured off the simulator (see ADVANCE). Cells are that arithmetic
// rounded up to the widest glyph there is, which makes them safe to cut a column
// to and hopeless for anything that has to *land* somewhere — sixty pixels of
// rounding was five characters of daylight between the clock and the corner it
// was supposed to be in.
//
// So: the body is cut by the pixel, and so is anything that has to *land*
// somewhere — a corner, a centred sentence. Cutting by the cell was the older
// answer here and it was leaving about a fifth of every line on the table: a cell
// is the widest glyph there is against a face that averages ten pixels, so a
// reading cut to its last cell stopped fifty-odd pixels inside the frame while
// the clock above it ended on it. That is not a margin, it is a column that looks
// like it failed to fill.
//
// Two lines of chrome are still cut by the cell, and by decision rather than by
// omission: the heading's title and the footer's place name are cut against a
// *neighbour* — the corner the clock is in, the path beside them — rather than
// against the frame. There the cell's over-estimate is the air between two
// strings, which is worth keeping, instead of daylight at the edge of the screen.
//
// What cutting by the pixel spends is the margin that kept a line from wrapping
// if the firmware's face turns out to be a shade wider than the simulator's, and
// a wrapped line in a container cut this close is a scroll bar and a row nobody
// sees. The table below is what to re-measure on glass if that ever shows up.

// One character cell, which is what everything laid out in columns is measured
// in. It lives here rather than in theme.ts because it is a fact about the face
// the firmware sets rather than about where anything stands.
export const CHAR_WIDTH = 12;

// What a character is actually worth, in pixels. The face is not fixed-width — it
// only had to be treated as one while nothing knew any better — and every
// printable ASCII character here was measured off the Even Hub simulator: ten
// copies of one glyph span nine advances and one ink width, one copy spans the
// ink width, and the difference over nine is the advance exactly. The method and
// the caveats are written up in docs/Screen.md.
//
// The spread is the whole point: `l` is four pixels where `@` is seventeen, and
// the cell model that stood in for this was calling both of them twelve.
const ADVANCE: Record<string, number> = {
  " ": 6, "!": 4, '"': 6, "#": 14, "$": 12, "%": 14, "&": 15, "'": 4,
  "(": 6, ")": 6, "*": 8, "+": 10, ",": 5, "-": 10, ".": 5, "/": 5,
  "0": 12, "1": 7, "2": 11, "3": 12, "4": 12, "5": 12, "6": 12, "7": 12,
  "8": 12, "9": 12, ":": 4, ";": 5, "<": 10, "=": 10, ">": 10, "?": 12,
  "@": 17, "A": 13, "B": 12, "C": 11, "D": 12, "E": 10, "F": 10, "G": 12,
  "H": 12, "I": 5, "J": 8, "K": 12, "L": 9, "M": 16, "N": 12, "O": 12,
  "P": 12, "Q": 12, "R": 12, "S": 11, "T": 10, "U": 12, "V": 13, "W": 16,
  "X": 13, "Y": 13, "Z": 12, "[": 7, "\\": 5, "]": 7, "^": 10, "_": 9,
  "a": 11, "b": 11, "c": 10, "d": 11, "e": 10, "f": 7, "g": 11, "h": 11,
  "i": 5, "j": 5, "k": 9, "l": 4, "m": 16, "n": 11, "o": 10, "p": 11,
  "q": 11, "r": 7, "s": 10, "t": 6, "u": 11, "v": 11, "w": 15, "x": 11,
  "y": 11, "z": 9, "{": 8, "|": 4, "}": 8, "~": 16, "·": 5, "°": 7,
  // Measured the same way as everything above it, back when it was the mark in
  // the unread badge — the badge says `msg` now, but the measurement stands and
  // it is the one geometric shape here anything has checked. Twenty is this
  // face's full-width advance: every such shape comes to that, and so does every
  // kanji.
  "▤": 20,
};

// Symbols this face does **not** have, and what it does with them: nothing. No
// box, no blank, no fallback glyph — the character is dropped and about four
// pixels of nothing are left standing where it was. Invisible on screen, and
// worse than invisible to a right-aligned line, because `textWidth` is what
// decides how far from the corner such a line is padded: a badge measured as
// twenty pixels of envelope that draws as four pixels of nothing is a badge
// sitting sixteen pixels adrift of the edge it was aimed at.
//
//   ✉ U+2709 and ✓ U+2713 are both absent, and they are both Dingbats. Treat
//   that whole block as missing until a screenshot says otherwise.
//
// What the face does have, all of it measured on the simulator: the geometric
// shapes (● ○ ◇ ▣ ▤ ▥ ▦, twenty each), the arrows (↑ →), the interpunct · at
// five, the katakana middle dot ・ at twenty, √ at ten, and every kanji tried.
// ▭ ◫ ◧ ◨ ▮ ☐ ☰ ⊞ are not there. Anything outside that list is one screenshot
// away from being a fact rather than a hope — see docs/Screen.md.

// A character the table has no measurement for. Wide ones are twenty, which is
// what every kanji measured came to; everything else takes the widest Latin
// advance there is, so an unmeasured glyph is over-estimated rather than run off
// the end of the line it is on.
const WIDE = 20;
const UNMEASURED = 17;

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
 * How wide a string actually is, in pixels. Measured where the character has been
 * measured and rounded up to the cell where it has not, so the answer is never
 * less than the truth — a string believed narrower than it is would be a string
 * pushed off the right-hand edge of the screen.
 */
export function textWidth(value: string): number {
  let total = 0;
  for (const character of value) {
    const measured = ADVANCE[character];
    if (measured != null) {
      total += measured;
      continue;
    }
    const size = codePointCells(character.codePointAt(0) ?? 0);
    total += size === 0 ? 0 : size === 2 ? WIDE : UNMEASURED;
  }
  return total;
}

/**
 * The same string cut to fit its container, with an ellipsis where anything was
 * taken off. Measured in pixels, which is what the display sets and therefore
 * the only measure that fills a column to the width it was given (see above).
 *
 * The ellipsis costs its own width rather than a cell, so what comes back is
 * never wider than the slot asked for — which is the whole point of it: a line
 * that overruns its container wraps, and a wrapped line in a body cut to the
 * screen is a scroll bar and a row nobody sees.
 */
export function clip(value: string, slot: number): string {
  const text = value.trim();
  if (slot <= 0) return "";
  if (textWidth(text) <= slot) return text;
  const room = slot - textWidth("…");
  let kept = "";
  let used = 0;
  for (const character of text) {
    const width = textWidth(character);
    if (used + width > room) break;
    kept += character;
    used += width;
  }
  return `${kept.trimEnd()}…`;
}

/**
 * The same cut, measured in cells, and it belongs to one line: the title in the
 * heading, which is cut against a corner laid over its own rect rather than
 * against anything with an edge of its own. Over-estimating there *is* the air
 * between the two strings, and there is nowhere else for that air to come from.
 *
 * The footer used to be cut this way as well and is not any more. It has an edge
 * of its own — its rect stops a cell short of the trail's, so the air is in the
 * geometry — and being charged for it twice cost a line of Latin five or six
 * characters it had the room for (see chromePanels in layout.ts).
 */
export function clipCells(value: string, width: number): string {
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
 * Pushed to the right end of a slot, measured in pixels rather than cells. A
 * container has no alignment to set, so the alignment is spaces — and a space is
 * six pixels, which is as close to the right-hand edge as this can land. Six
 * pixels is half a character; the cell arithmetic this replaced was landing sixty
 * short, because it was counting every glyph as the widest one there is.
 *
 * The clock and the pager get closer still: their containers are cut to the width
 * of what they hold and put in the corner, so the padding here only has to make
 * up what a slot rounds off (see theme.ts).
 *
 * There is no `padRight` beside this, and there is no need for one. Every column
 * here is a container of its own with its own left edge, so left alignment is
 * where the text already starts — padding it out would only be writing spaces
 * into empty screen.
 */
export function padLeft(value: string, slot: number): string {
  const text = clip(value, slot);
  const spaces = Math.floor((slot - textWidth(text)) / textWidth(" "));
  return " ".repeat(Math.max(0, spaces)) + text;
}

/**
 * Broken onto as many lines as it takes, breaking between words where there are
 * words to break between and mid-string where there are not — which is most of
 * the time in Japanese and Chinese, neither of which puts spaces anywhere.
 *
 * Broken against the container in pixels, like everything else in the body: a
 * line broken by the cell came up a fifth short of the width it was given, which
 * on a post is a line of type and a half thrown away per screenful.
 */
export function wrap(value: string, slot: number, maxLines = Infinity): string[] {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || slot <= 0) return [];
  const lines: string[] = [];
  let line = "";

  /** Cut short rather than run on, and say so on the last line that survives. */
  const elide = (): string[] => {
    const kept = lines.slice(0, maxLines);
    kept[kept.length - 1] = clip(`${kept[kept.length - 1]}…`, slot);
    return kept;
  };

  const push = () => {
    if (line) lines.push(line);
    line = "";
  };

  for (const word of text.split(" ")) {
    if (!word) continue;
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate) <= slot) {
      line = candidate;
      continue;
    }
    push();
    // A single run longer than the line — a Japanese sentence, or a URL — is cut
    // wherever the width runs out, because there is nowhere else to cut it.
    let rest = word;
    while (textWidth(rest) > slot) {
      let piece = "";
      let used = 0;
      for (const character of rest) {
        const width = textWidth(character);
        if (used + width > slot) break;
        piece += character;
        used += width;
      }
      if (!piece) break;
      lines.push(piece);
      rest = rest.slice(piece.length);
      // Filling the last line with a run that has more of itself left is the one
      // way out of here that used to drop text in silence: a sentence with no
      // spaces in it — which is to say most Japanese and Chinese ones — was cut
      // off wherever the lines ran out and said nothing about the rest of itself.
      if (lines.length >= maxLines) return rest ? elide() : lines.slice(0, maxLines);
    }
    line = rest;
  }
  push();

  return lines.length <= maxLines ? lines : elide();
}
