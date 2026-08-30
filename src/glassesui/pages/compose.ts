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
// **What the preview is for.** It shows what was heard, as much of it as the
// screen will hold: four of the seven body lines, with the spot it would be filed
// at on the one above and the answers on the two underneath. The reader is
// checking a transcript — the one thing they cannot do here is retype a word the
// transcriber got wrong — so the words are what the rest of the space goes to,
// and the spot and the answers are pinned to the ends of the body where they are
// always in the same place.
//
// The spot is on the screen that asks which of two things a sentence is and not
// on the screen that asks whether an answer goes, because that is the screen it
// is a fact about: a mark and a post are both pinned to the ground, and a letter
// and a remark are pinned to a person and a post and carry no fix at all (see
// `Draft`).
//
// It used to show the sentence as the answer under the wheel would *save* it,
// cut where lo cuts it: 48 characters for the name of a mark, 300 for a remark,
// 500 for a post, 1000 for a letter. That put a hard stop in the middle of a
// word — 48 characters lands wherever it lands — on a screen with three empty
// lines under it, which reads as a display that has broken rather than as a
// limit that has been reached. So the cut is no longer drawn here. The one it
// costs is the mark, whose 48 characters are the only limit an ordinary spoken
// sentence actually reaches; what a mark keeps is its first few words, and that
// is a thing to say in the answer's own row if it is ever worth saying at all.
//
// Over five lines the words run out before the room does, for every answer but
// the longest: a minute of talking is the most the microphone will take, and
// what comes back from it is longer than five lines only when the reader has
// said a great deal. Then the last line ends in an ellipsis, which is `wrap`
// saying the screen ran out rather than lo saying the sentence will be cut.

import { formatCoords, formatUsername } from "../format";
import { READING_VALUES } from "../theme";
import { wrap } from "../metrics";
import type { Translate } from "../../i18n";
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

// How much of the sentence is shown on the screen with two answers on it. Four of
// the body's seven lines, the spot above them and the answers below — which is the
// whole body, and deliberately: the answers read as a different kind of thing from
// the sentence above them because they are labelled and marked, not because there
// is air between them, and a blank line held back for that costs a line of the one
// thing on this screen the reader has to check.
const SAID_LINES = 4;

// And on the screen with one answer on it, where the last line names who it is
// going to rather than offering a choice. That one keeps its blank line: a single
// row hard under five lines of type would read as the sixth of them, where a pair
// of marked answers never could.
const REPLY_LINES = 5;

/**
 * What was heard: the transcript itself — not what the answer under the wheel
 * would save — broken to the column, cut to the lines there are, and padded out
 * to them whether or not it fills them.
 *
 * The padding is what keeps the answers on the last lines of the screen. They
 * would otherwise ride up under a short sentence, and a pair of answers that sits
 * somewhere different on every dictation is a pair that can be chosen by mistake.
 *
 * An ellipsis on the last line is `wrap` saying the screen ran out (see
 * metrics.ts), which takes a good deal more than a sentence.
 */
function heard(draft: Draft, t: Translate, height: number): ReadingRow[] {
  const lines = wrap(draft.text, READING_VALUES.width, height);
  return Array.from({ length: height }, (_, index) => ({
    label: index === 0 ? t("compose.said") : "",
    value: lines[index] ?? "",
  }));
}

/**
 * The spot the sentence would be filed at, which is the fact both answers on this
 * screen turn on and the one fact about them the words cannot carry.
 *
 * A mark and a post are the same sentence pinned to the same ground and differ
 * only in who may walk up to it, so the reader choosing between them is deciding
 * what to leave *here* — and until this row existed the screen never said where
 * here was. It matters most when the two disagree with each other: the fix was
 * taken when the hold began rather than now (see `Draft`), so a reader who spoke
 * on the move is filing at the doorway they were standing in and not the corner
 * they have walked on to while deciding. This row is the only place that is
 * visible.
 *
 * Above the words rather than under them, which is the order the sentence is
 * answerable in: where, then what was heard, then who gets to read it. It also
 * puts it out of reach of the transcript, which is the one thing on this screen
 * that changes length — a spot that sat under a dictation would land on a
 * different line every time, and it is a fact about the answers below it.
 *
 * lo's own word for this reading and lo's own way of writing it (`location.fix`,
 * `formatCoords`), so the coordinates on this screen read exactly as the ones on
 * the standing page do. Nothing beside them: the accuracy, the height and the age
 * that ride along on that page are answers to "how well does this screen know
 * where I am", and the question here is the plainer one of where the thing is
 * going.
 */
function where(coords: Coordinates, t: Translate): ReadingRow {
  return { label: t("location.fix"), value: formatCoords(coords.latitude, coords.longitude) };
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
            // reason the interpunct is: punctuation is part of a language, and
            // each language can quote with a different pair of characters
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
      title: t(draft.kind === "reply" ? "compose.messageTitle" : "compose.commentTitle"),
      block: { kind: "readings", rows },
      // The same two gestures on both, because they are the same two gestures:
      // there is nothing to choose between and the only question left is whether
      // it goes.
      context: t("compose.replyHint"),
    };
  }

  // Where it would land, the words, and then what to do with them — the seven
  // lines of the body exactly, which is why the transcript is four rather than
  // five (see SAID_LINES). The line the spot costs comes off the end of a
  // sentence that mostly does not reach it; the spot is a fact about both answers
  // and would have been missing from every dictation.
  const rows = [where(draft.coords, t), ...heard(draft, t, SAID_LINES)];
  // Straight under the words, on the last two lines of the body. There used to be
  // a blank line between them, and what it was holding apart is held apart by the
  // label and the two discs anyway (see `answer`) — where the line it cost came
  // off the sentence, which is the thing the reader is here to read.
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
