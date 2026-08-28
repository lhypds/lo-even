// The screen between saying something and it being saved.
//
// It is not one of the pages and it is not in the sequence: it takes the display
// over while it is up, and when it goes the reader is back on exactly the page
// they were on (see glasses.ts). That is the shape a question of this kind has to
// have — a reader who was asked something in the middle of the dashboard and then
// put back somewhere else would have paid for the question twice.
//
// **Why there is a question at all.** A hold used to be one verb: record, and save
// the spot with what was said as its name. There are two things a sentence spoken
// up here can be, though, and the difference between them is not a detail of
// filing — a mark is a name only its author will ever read, and a post is a line
// left on the ground for whoever comes past. Nothing about the words says which
// one they are, and there is no undoing having said something to a street. So the
// glasses ask, and the asking is three gestures wide: the wheel chooses, a tap
// keeps, two taps throw it away.
//
// **Why the drop is the harder gesture.** Everywhere else in this app a single tap
// is the way out, because before there is a draft there is nothing standing that a
// stray tap could destroy. Here there is, so the two swap: the tap saves, and
// throwing away a sentence the reader has already said takes a gesture they had to
// mean. It costs the answer half a second — the host reports the first press of a
// double tap as a press of its own, so a tap here waits to find out whether a
// second one is coming (see main.ts).
//
// **What the preview is for.** It shows the words as the chosen answer would
// actually save them, which is not the same string twice: lo takes 48 characters
// as the name of a mark and 500 as the words of a post, so a spoken sentence that
// arrives whole on the post line arrives cut on the mark line. Showing the cut is
// the point. A reader who can see which of the two keeps the sentence they said
// is choosing between the two things on offer rather than between two words.

import { markLabel, postBody } from "../../services/api";
import { cellsIn, READING_VALUES } from "../theme";
import { wrap } from "../metrics";
import type { Translate } from "../strings";
import type { Coordinates } from "../../types";
import type { PageView, ReadingRow } from "./types";

/** The two things a dictation can turn into, which is the whole of the question. */
export type DraftKind = "mark" | "post";

/** A sentence that has been said and not yet been told what it is. */
export interface Draft {
  /** The transcript, whole. What each answer would keep of it is worked out here. */
  text: string;
  /**
   * Where the reader was standing when they said it, rather than where they are
   * when they answer. A fix taken again at the far end of the question would file
   * the sentence at the spot the reader had wandered to while deciding.
   */
  coords: Coordinates;
  kind: DraftKind;
}

// How much of the sentence is shown. Three of the seven lines: one goes to the
// air above the answers, two to the answers themselves, and the last is left
// empty on purpose — the two lines the reader is choosing between are the two
// this screen exists for, and they should not be read hard against the line of
// instructions underneath them.
const SAID_LINES = 3;

/** The words as the chosen answer would save them, cut where it would cut them. */
function said(draft: Draft): string[] {
  const kept = draft.kind === "mark" ? markLabel(draft.text) : postBody(draft.text);
  const whole = draft.text.trim();
  return wrap(kept === whole ? kept : `${kept}…`, cellsIn(READING_VALUES.width), SAID_LINES);
}

/**
 * One of the two answers, and who would be able to read it. A filled disc for the
 * one the wheel is on and a hollow one for the other, which is the pair the
 * warnings line already draws with (see here.ts) and is as close to a radio button
 * as a screen with no weight but brightness gets.
 *
 * The marker is a character rather than a space, because a column here is trimmed
 * before it is drawn and a line that began with a space would come back a cell to
 * the left of the one above it.
 */
function answer(draft: Draft, kind: DraftKind, t: Translate): ReadingRow {
  return {
    label: kind === "mark" ? t("compose.keep") : "",
    value: `${draft.kind === kind ? "●" : "○"} ${kind} · ${t(`compose.${kind}Who`)}`,
  };
}

/** What the reader is being asked, as one screenful. */
export function composeView(draft: Draft, t: Translate): PageView {
  const lines = said(draft);

  // Padded to its full height whether or not the sentence fills it, which is what
  // keeps the two answers on the last two lines of the screen. They would
  // otherwise move up and down as the wheel turned — the mark's preview is
  // shorter than the post's whenever the sentence was long enough to be cut — and
  // a pair of answers that jumps a line every time the reader chooses between
  // them is a pair of answers that can be chosen by mistake.
  const rows: ReadingRow[] = Array.from({ length: SAID_LINES }, (_, index) => ({
    label: index === 0 ? t("compose.said") : "",
    value: lines[index] ?? "",
  }));

  // A blank line rather than a rule: the answers have to read as a different kind
  // of thing from the sentence above them, and this screen has the one line to
  // spare that every other page here does not.
  rows.push({ label: "", value: "" });
  rows.push(answer(draft, "mark", t), answer(draft, "post", t));

  return {
    title: t("compose.title"),
    block: { kind: "readings", rows },
    // The gestures, spelled out. Every other page in this app can assume the
    // reader knows what the wheel does, because the wheel does the same thing on
    // all of them; this is the one screen where it does something else.
    context: t("compose.hint"),
  };
}
