// How a page divides seven lines between the things it has to say.
//
// Every page here is two or three groups stacked — people over posts over
// messages, news over trends over events — and each of them could fill the screen
// on its own. Something has to decide how many lines each gets, and doing it with
// fixed quotas would mean a page that leaves four lines blank on the evening the
// newswire has nothing and cuts the posts short on the afternoon everybody is
// out.
//
// So it is dealt out rather than assigned. Every group gets its first line
// whatever happens — a group that vanished because another one was long would be
// a page whose shape moved with the news, and the reader would have to look for
// what should always be in the same place. After that the lines left over go
// round the groups a line at a time, in the order the page listed them, skipping
// whichever has run out of things to say or hit the ceiling it set itself. The
// order is the priority: the first group named gets the first spare line.
//
// A group with nothing at all still takes its line, and says why it has nothing
// there — waiting, empty, or nobody could be reached (see feed.ts). That is the
// one line a page cannot save: "no posts around here" and "the posts have not
// arrived yet" are different claims about the street.

import type { ReadingRow } from "./types";

export interface Group {
  /**
   * What this group is called where it is not being read out loud: the key its
   * words are under in the dictionary, the last part of its path, and what the
   * reader picks when they choose a group on this page (see chrome.ts, and
   * `spans` below).
   */
  id: string;
  /** The word in the margin, written on this group's first line only. */
  label: string;
  /** What this group would show, in the order it wants it shown. */
  lines: string[];
  /** What to say instead when it has nothing — never blank. */
  note: string;
  /** The most lines it will take however much room there is. */
  max: number;
}

export function stack(groups: Group[], room: number): ReadingRow[] {
  const taken = groups.map(() => 1);
  let left = room - groups.length;

  // Round by round rather than group by group, so that the second group's second
  // line beats the first group's fourth.
  for (let dealt = -1; left > 0 && dealt !== 0; ) {
    dealt = 0;
    for (let i = 0; i < groups.length && left > 0; i += 1) {
      if (taken[i] >= Math.min(groups[i].max, groups[i].lines.length)) continue;
      taken[i] += 1;
      left -= 1;
      dealt += 1;
    }
  }

  return groups.flatMap((group, index) => {
    const lines = group.lines.length > 0 ? group.lines.slice(0, taken[index]) : [group.note];
    return lines.map((value, line) => ({
      label: line === 0 ? group.label : "",
      value,
      group: group.id,
    }));
  });
}

/**
 * Which rows belong to which group, read back off the rows themselves.
 *
 * The dealing above is the only thing that knows a group turned into three lines
 * rather than one, and two screens need that back: the one that draws a box round
 * the group the reader is choosing, and the one that decides what the wheel is
 * choosing between (see layout.ts and glasses.ts). Reading it back off the rows
 * rather than returning it alongside them keeps a page's answer one thing — a
 * list of lines — and keeps the two in step, because the box is drawn round the
 * rows that are actually there.
 */
export interface Span {
  id: string;
  /** Where the group starts, counting rows from the top of what is on screen. */
  first: number;
  /** How many rows it got. */
  count: number;
}

export function spans(rows: ReadingRow[]): Span[] {
  const found: Span[] = [];
  rows.forEach((row, index) => {
    if (!row.group) return;
    const last = found[found.length - 1];
    // Same group and no gap: one more line of the one before. A page that listed
    // a group twice would get two spans, which is the truthful answer — the box
    // goes round the block the reader can see, not round every row that shares a
    // name with it.
    if (last && last.id === row.group && last.first + last.count === index) last.count += 1;
    else found.push({ id: row.group, first: index, count: 1 });
  });
  return found;
}
