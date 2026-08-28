// The screen between saying something and it being sent.
//
// It is not one of the pages and it is not in the sequence: it takes the display
// over while it is up, and when it goes the reader is back on exactly the page
// they were on (see glasses.ts). That is the shape a question of this kind has to
// have — a reader who was asked something in the middle of the dashboard and then
// put back somewhere else would have paid for the question twice.
//
// **Why there is a question at all.** A hold used to be one verb: record, and save
// the spot with what was said as its name. There are four things a sentence
// spoken up here can be, though, and the differences between them are not details
// of filing — a mark is a name only its author will ever read, a post is a line
// left on the ground for whoever comes past, a reply is a letter to one named
// person, and a remark under somebody's post is that person's ground with the
// reader's name written on it. Nothing about the words says which, and there is no
// unsaying any of the three that other people see.
//
// **Two screens, because the hold is asked two different questions.** Where the
// reader was standing when they held decides which:
//
//   • Anywhere on the dashboard, the sentence is about the ground under them and
//     the question is which of the two things it is. The wheel chooses, a tap
//     keeps, two taps throw it away.
//   • On one thing read whole that can be answered — a letter, a person, a post —
//     the sentence is an answer to it and the only question left is whether to
//     send it. There is nothing for the wheel to do and it does nothing; a tap
//     sends, two taps throw it away.
//
// The second screen exists because the reader asked for the sentence to be shown
// back before it goes. A dictation is not a keyboard — the words on the screen are
// what a transcriber heard rather than what the reader typed — and these are the
// writes that land under somebody else's name: in their inbox, or in the column
// under something they left on the street.
//
// **Why the drop is the harder gesture.** Everywhere else in this app a single tap
// is the way out, because before there is a draft there is nothing standing that a
// stray tap could destroy. Here there is, so the two swap: the tap sends, and
// throwing away a sentence the reader has already said takes a gesture they had to
// mean. It costs the answer half a second — the host reports the first press of a
// double tap as a press of its own, so a tap here waits to find out whether a
// second one is coming (see main.ts).
//
// **And a hold says it again.** A transcriber mishears and there is no keyboard
// here to correct it with, so the commonest thing wrong with the words on this
// screen is that they are not the ones that were said — and the answer to that is
// the gesture that got them in the first place. It replaces the draft rather than
// standing beside it: the reader is saying the same thing over, not adding to it.
//
// It is the one gesture on this screen that is *not* written on it, and that is
// the rule the line below keeps rather than an exception to it. The wheel and the
// tap are spelled out because they do something here they do nowhere else. A hold
// opens the microphone on every screen in the app, this one included, and a hint
// that said so would be teaching the reader the one thing they already know.
//
// **What the preview is for.** It shows the words as the chosen answer would
// actually send them, which is not the same string four times: lo takes 48
// characters as the name of a mark, 300 as a remark under a post, 500 as the words
// of a post and 1000 as the words of a letter, so a spoken sentence that arrives
// whole on the post line arrives cut on the mark line. Showing the cut is the
// point. A reader who can see which of the two keeps the sentence they said is
// choosing between the two things on offer rather than between two words. A reply
// is never cut in practice — a minute of talking is the most the microphone will
// take and it does not reach a thousand characters — so what that screen shows is
// simply the whole of it. A remark can be: three hundred is about ninety seconds
// of ordinary speech in English and a good deal less in the other two, and a
// reader whose last sentence is not going to arrive should be able to see that
// before they tap rather than afterwards on the phone.

import { commentBody, markLabel, messageBody, postBody } from "../../services/api";
import { formatUsername } from "../format";
import { READING_VALUES } from "../theme";
import { wrap } from "../metrics";
import type { Translate } from "../strings";
import type { Coordinates } from "../../types";
import type { PageView, ReadingRow } from "./types";

/** The four things a dictation can turn into, which is the whole of the question. */
export type DraftKind = "mark" | "post" | "reply" | "comment";

/**
 * What a sentence is an answer *to*, where it is an answer to something rather
 * than about the ground.
 *
 * Taken when the hold began rather than when it ended, and this is the shape that
 * carries it from one end of a dictation to the other. The screen the reader was
 * on when they started talking is what they meant, and the wheel keeps working
 * while the microphone is open — so a reader who says something into a letter and
 * then rolls on to the next one would otherwise have it sent to whoever they had
 * drifted onto (see main.ts).
 */
export type Answering =
  | {
      kind: "reply";
      /** Whose inbox it lands in, which is the letter or the person that was open. */
      to: string;
    }
  | {
      kind: "comment";
      /** Which post it goes under, by the id lo files it against. */
      post: number;
      /**
       * And what there is to call that post — its own words, or where it was left,
       * or nothing where the screen it came from had neither.
       *
       * Not a person, which is what this used to be. A comment is filed under a
       * post rather than addressed to anybody, and the post is the one thing every
       * screen a hold can begin on knows: the street has the post in hand and the
       * inbox row carries its words, where neither of them is told who wrote it
       * (see `selectPostThreads` in lo/server/db.js). Naming the post is also the
       * truer answer — it is what the remark will appear under, and it is how lo
       * itself heads the column.
       */
      about: string;
    };

/**
 * A sentence that has been said and not yet been sent anywhere.
 *
 * A union rather than one shape with optional halves, because the kinds of draft
 * are answerable to different facts and none can stand in for another: a mark and
 * a post are filed at a spot on the ground, a reply under a person, a comment
 * under a post. There is no fix on either of the last two — where the reader was
 * standing when they answered something is nobody's business, and the post they
 * answered already says where the ground is — and asking for one would have been a
 * GPS read spent on a field no endpoint takes.
 */
export type Draft =
  | {
      kind: "mark" | "post";
      /** The transcript, whole. What each answer would keep of it is worked out here. */
      text: string;
      /**
       * Where the reader was standing when they said it, rather than where they
       * are when they answer. A fix taken again at the far end of the question
       * would file the sentence at the spot the reader had wandered to while
       * deciding.
       */
      coords: Coordinates;
    }
  | ({ text: string } & Answering);

// How much of the sentence is shown on the screen with two answers on it. Three
// of the seven lines: one goes to the air above the answers, two to the answers
// themselves, and the last is left empty on purpose — the two lines the reader is
// choosing between are the two this screen exists for, and they should not be
// read hard against the line of instructions underneath them.
const SAID_LINES = 3;

// And on the screen with one answer on it, which has that answer's line to spare.
// A reply is the longest of the three things a dictation can be and the one where
// every word of it matters, so the line goes to the words rather than to more air.
const REPLY_LINES = 4;

/** What the answer would actually send, which is the transcript cut where lo cuts it. */
function kept(draft: Draft): string {
  if (draft.kind === "reply") return messageBody(draft.text);
  if (draft.kind === "comment") return commentBody(draft.text);
  return draft.kind === "mark" ? markLabel(draft.text) : postBody(draft.text);
}

/** Those words, broken to the column, with the cut shown where there was one. */
function said(draft: Draft, height: number): string[] {
  const shown = kept(draft);
  const whole = draft.text.trim();
  return wrap(shown === whole ? shown : `${shown}…`, READING_VALUES.width, height);
}

/**
 * The sentence, padded to its full height whether or not it fills it. That is what
 * keeps the answers on the last lines of the screen: they would otherwise move up
 * and down as the wheel turned — the mark's preview is shorter than the post's
 * whenever the sentence was long enough to be cut — and a pair of answers that
 * jumps a line every time the reader chooses between them is a pair of answers
 * that can be chosen by mistake.
 */
function heard(draft: Draft, t: Translate, height: number): ReadingRow[] {
  const lines = said(draft, height);
  return Array.from({ length: height }, (_, index) => ({
    label: index === 0 ? t("compose.said") : "",
    value: lines[index] ?? "",
  }));
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
function answer(draft: Draft, kind: "mark" | "post", t: Translate): ReadingRow {
  return {
    label: kind === "mark" ? t("compose.keep") : "",
    value: `${draft.kind === kind ? "●" : "○"} ${kind} · ${t(`compose.${kind}Who`)}`,
  };
}

/** What the reader is being asked, as one screenful. */
export function composeView(draft: Draft, t: Translate): PageView {
  // The two answers that are answers to something ask the shorter question, and
  // ask it in the same furniture: the words that were heard, air, and then who is
  // going to read them. What the last row does not carry is a disc. The disc means
  // "the one the wheel is on", and there is nothing here for the wheel to be on —
  // a lone filled one would be a radio button with a single choice, which is a
  // control describing itself wrongly rather than a control saying nothing.
  //
  // The last row is where the two differ, and it is the only place they can: a
  // letter has an addressee and a remark under a post has not. So one names the
  // person it lands with, and the other names the post it is going under — in lo's
  // own words for exactly that, quotation marks and all (`messages.onPost`), which
  // is how lo heads the same column on the phone.
  //
  // Nothing about the audience on either. The letter's is in the name and the
  // remark's is in the verb: this screen asks whether to *post* a reply where the
  // other asks whether to send one, and a line spelling out "everyone here" would
  // be a second answer to a question the heading has already answered — and a
  // wrong one for a post read out of the inbox, which need not be anywhere near
  // the reader at all.
  if (draft.kind === "reply" || draft.kind === "comment") {
    const rows = heard(draft, t, REPLY_LINES);
    rows.push({ label: "", value: "" });
    rows.push(
      draft.kind === "reply"
        ? { label: t("compose.sendTo"), value: formatUsername(draft.to) }
        : {
            label: t("compose.replyUnder"),
            // The post in quotation marks and nothing else. The row already says
            // what is being done with it, so `messages.onPost` — which is the same
            // name with `On` in front of it, and is right at the head of a row in a
            // list of mixed kinds — would read here as `Reply to On “…”`.
            //
            // The marks stay, and they are their own word of the dictionary for the
            // reason the interpunct is: punctuation is part of a language, and two
            // of these three languages quote with a different pair of characters
            // (see `tally.join`). Without them a post beginning with a verb reads as
            // a sentence this screen is saying rather than one it is quoting.
            //
            // A post with neither words nor a place to its name still has to be
            // called something, and lo has the word for that too.
            value: t("compose.quoted", { post: draft.about || t("comments.aboutPost") }),
          },
    );
    return {
      // The question, in full, because it is the whole of what this screen is for:
      // the reader asked to be shown a dictation before it went to somebody.
      title: t(draft.kind === "reply" ? "compose.replyTitle" : "compose.commentTitle"),
      block: { kind: "readings", rows },
      // The same two gestures on both, because they are the same two gestures:
      // there is nothing to choose between and the only question left is whether
      // it goes.
      context: t("compose.replyHint"),
    };
  }

  const rows = heard(draft, t, SAID_LINES);
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
    // all of them; these are the screens where it does something else, or nothing.
    context: t("compose.hint"),
  };
}
