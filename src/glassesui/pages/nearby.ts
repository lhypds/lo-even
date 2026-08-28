// Who is here, what they left on the ground, what is on, and who has written.
//
// lo's people tile, its posts tile, its listings and its letter, on one page
// because they are the same look around: the names are worth a line, the posts
// are worth most of the rest, what is on this evening is worth two, and the inbox
// is worth knowing about before the reader gets back to their phone. Presence is
// one line rather than a list for the reason the sky is one line — three names is
// what a street usually has, and giving each of them a row of its own would spend
// half the screen on a column of distances.
//
// The listings came off the third page, and the move is about what a listing is
// rather than about where there was room. What is on tonight within walking
// distance is a fact about this street on this evening; the newswire and the
// trends are facts about the country, and a reader looking up from the pavement
// wants the first kind. The letters lead because they are the one thing on the
// page addressed to the reader by name, and the rest follow it outwards: what
// has been left on this street, what is on within walking distance, and who is
// about.
//
// The people, the posts and the listings arrive without being asked: they come
// back with the fix on the one read this app makes of it, and the presence trade
// keeps the names current every minute after that (see feeds.ts). The inbox is
// the one thing on this page that is asked for, and only while this page is the
// one being looked at.
//
// The posts are everybody's, which is the whole difference between a post and a
// mark: a mark is yours and stays on your own map, a post is left on the ground
// for whoever comes past it.
//
// This page is a summary of four lists, and the four are behind it: a tap puts a
// box round one of the groups, another opens it — the same rows with two lines
// apiece and no summary to fit around — and a third opens whichever entry the
// reader is on. What is still not here is anything that writes: the website's
// rows open the post *and its replies*, and a reply needs a keyboard, so the
// deepest this goes is reading and the answering stays on the phone.
//
// Two of those bottom screens are the exception, and they are the same exception:
// a letter and a person are both addressed to somebody, and a hold on either of
// them dictates a message that goes to them. That is the one verb down here, and
// both screens say so in the same words in the same corner (see pages/person.ts).

import {
  distanceMeters,
  formatDistance,
  formatUsername,
  joined,
  postSays,
  relativeTime,
} from "../format";
import { BODY_LINES } from "../theme";
import { placeTitle } from "./chrome";
import { feedItems, feedWord, type FeedWords } from "./feed";
import { nothing } from "./list";
import { personBody } from "./person";
import { stack, type Group } from "./stack";
import type { Translate } from "../strings";
import type { LoMessage, LoThread } from "../../types";
import type { Item, PageContext, PageDefinition, PageView } from "./types";

// How many names the line carries before it starts counting instead. Four is
// what fits; the rest are a figure, which is the honest thing to show when the
// alternative is a name cut in half.
const NAMES = 4;

// What each group says when it has nothing, kept here rather than written out
// twice: the summary and the list are the same groups, and a group that said
// "loading" on one screen and "nobody here" on the other would be two answers to
// one question.
const WORDS: Record<"people" | "posts" | "events" | "messages", FeedWords> = {
  people: { loading: "common.loading", empty: "people.alone", failed: "glasses.offline" },
  posts: { loading: "common.loading", empty: "posts.empty", failed: "glasses.offline" },
  events: { loading: "events.loading", empty: "events.empty", failed: "events.unavailable" },
  messages: { loading: "common.loading", empty: "messages.empty", failed: "glasses.offline" },
};

/** Everyone else who has a tab open around here, nearest first. */
function others({ people, coords, username }: PageContext) {
  return (
    (people.data ?? [])
      // Never yourself: your own dot is not company, and lo leaves the asker out of
      // this list on the server for the same reason.
      .filter((person) => person.username !== username)
      .map((person) => ({ person, away: coords ? distanceMeters(coords, person) : Infinity }))
      .sort((a, b) => a.away - b.away)
  );
}

function peopleLine(context: PageContext): string[] {
  const near = others(context);
  if (near.length === 0) return [];
  const named = near.slice(0, NAMES).map(({ person }) => formatUsername(person.username));
  const rest = near.length - named.length;
  return [named.join(" ") + (rest > 0 ? ` +${rest}` : "")];
}

/**
 * One thing said, with whoever said it in front of it.
 *
 * Every message this app draws goes through here — the line under a correspondent
 * on the summary, the second line of their entry in the list, and every line of
 * the exchange itself — because the question a reader has about a message is the
 * same one on all three screens and it is not answered by the words. lo's own
 * sheet answers it with a bubble on the left or the right; there is no left and
 * right up here, and no weight but brightness, so the answer has to be in the
 * words: a name, a colon, and the sentence.
 *
 * The reader's own side says so in a word rather than in their handle, which is
 * lo's own wording for lo's own row (`messages.said`): `@name` is an address, and
 * nobody needs their own address read back to them on every other line.
 */
function said(line: { body: string; mine: boolean }, them: string, t: Translate): string {
  return line.mine
    ? t("messages.said", { body: line.body })
    : t("messages.from", { name: them, body: line.body });
}

/**
 * One exchange, written out — which is what the screen behind a letter shows,
 * where every other group's reading screen shows one thing.
 *
 * **Newest first**, which is upside down for a correspondence and right for this
 * screen. lo's own sheet runs oldest at the top and opens scrolled to the bottom,
 * because a sheet can be scrolled to the bottom before the reader sees it. A wheel
 * cannot: it starts on the first screenful and the reader gets to the last one a
 * flick at a time, so a thread in the usual order would put the line they came for
 * behind every line they have already read. Turned round, the newest is the first
 * thing on the screen and the history is what a flick goes back through.
 *
 * **The line before the exchange arrives is a line of the exchange.** The request
 * that fetches this is the one that marks the letter read, and it is deliberately
 * three seconds behind the reader opening it (see main.ts). What stands there in
 * the meantime is the last thing said — which the inbox has already handed over,
 * along with which side said it and when — drawn in exactly the form the exchange
 * will draw it in. So the three seconds end with lines appearing underneath the
 * one being read rather than with the screen rearranging itself under a reader.
 *
 * **Who said it, and no more than that.** A name, a colon and the words — the
 * same shape every message in this app is written in (see `said`). No hour on each
 * line: the heading carries the newest one's, everything under it is older by
 * construction, and a column of relative times down a screen this narrow would
 * cost a fifth of every line to say what the order already says.
 */
function exchange(thread: LoThread, { thread: read, t }: PageContext): string {
  const history = read(thread.username).data;
  // Newest first out of an answer that arrives oldest first, and a one-line stand-in
  // built out of the inbox's own row where nothing has arrived yet.
  const lines: LoMessage[] = history?.length
    ? [...history].reverse()
    : [{ id: 0, body: thread.body, time: thread.time, mine: thread.mine, read: true }];
  const them = formatUsername(thread.username);
  // One paragraph each, which the reading screen breaks and lays end to end
  // without a blank line between (see proseLines in layout.ts) — so a line that
  // starts at the margin with a name and a colon is where one message begins.
  return lines.map((line) => said(line, them, t)).join("\n");
}

/**
 * What the footer says while a letter is open, which is two different things and
 * they arrive in this order.
 *
 * **While the rest of the exchange is coming**, it says so. That screen puts up
 * one line — the last thing said, which the inbox had already — and then some
 * seconds later grows the correspondence underneath it (see `exchange`). Without
 * a word about it, a reader looking at a single line has no way to tell a short
 * exchange from a long one that has not arrived, and would take the one line for
 * the whole of it and leave.
 *
 * A request not yet made and a request still out say the same sentence here. The
 * three seconds before this is asked for are three seconds in which the rest of it
 * is on its way as far as anyone on this screen is concerned, and a footer that
 * said nothing and then said something would be making two changes where there is
 * one fact. The care this app takes over idle-against-loading everywhere else is
 * about *claims* — "no posts around here" against "the posts have not arrived" —
 * and there is no claim here to get wrong.
 *
 * **Once it is all there**, it says how to answer. That is the verb this screen
 * has and no other screen in the app does, so this is the one screen that has to
 * name it: a reader who has never held the temple on a letter has no way to find
 * out they can. It waits its turn because it is the less urgent of the two — the
 * hold works throughout either way, and a reader is on a letter for longer than
 * one round trip.
 *
 * Where nobody could be reached it says that instead, in place of both. A screen
 * that went on promising the rest of an exchange that is not coming would be worse
 * than one that says the line it did show is all there is for now.
 */
function letterFoot(thread: LoThread, { thread: read, t }: PageContext): string {
  const { status } = read(thread.username);
  if (status === "failed") return t("glasses.offline");
  return status === "ready" ? t("messages.reply") : t("messages.reading");
}

/**
 * The four groups again, one entry at a time — the same rows the summary above
 * cuts to a line each, with two lines and a screen of their own instead.
 *
 * A person is on the list as well as a post, and there is a page behind a name
 * now rather than the two lines the summary could not carry: the profile lo has
 * always had on the phone, fetched when the reader opens that one name (see
 * pages/person.ts).
 */
function nearbyItems(context: PageContext): Item[] {
  const { posts, people, events, messages, components, locale, profile, t } = context;

  const messageItems: Item[] = (messages.data ?? []).length
    ? (messages.data ?? []).map((thread) => ({
        group: "messages",
        key: thread.username,
        // The disc is lo's own dot on the letter in its top bar: something in
        // this exchange has not been read. It stays in front of the name here
        // rather than moving to the margin, because the margin is gone — an
        // entry is one container and one brightness, and the bright one is the
        // one the reader is on (see layout.ts).
        head: `${thread.unread > 0 ? "● " : ""}${joined(formatUsername(thread.username), relativeTime(thread.time, locale, t))}`,
        // Who spoke last and what they said. The heading above already names the
        // exchange, so this line names only the speaker — which is the one thing
        // the heading cannot say, an exchange being two people.
        line: said(thread, formatUsername(thread.username), t),
        // The exchange, newest first — the one entry in this app whose reading
        // screen is a list rather than a thing. `GET /api/messages` answers with
        // one line per correspondent, which is what the row above shows; the rest
        // of it arrives with the request that marks the letter read, and until it
        // does this is that same one line (see `exchange`).
        body: exchange(thread, context),
        context: letterFoot(thread, context),
      }))
    : [nothing("messages", feedWord(messages, t, WORDS.messages))];

  const near = others(context);
  const peopleItems: Item[] = near.length
    ? near.map(({ person, away }) => {
        // How far, and how long ago they said so. The spot they said it from used
        // to be the third part of this line and has gone: four decimal places is
        // eleven metres of where a person actually is, and printing that for
        // anybody standing nearby is a thing no screen in lo has ever done — the
        // website draws a dot on a map at a scale nobody reads a doorway off, and
        // the number itself is nobody's business. A distance and an hour says
        // there is somebody here without saying which window they are behind.
        //
        // The name is the whole of the first line and this is the second, so
        // nothing is said twice when the entry becomes a heading and a body.
        const said = joined(
          Number.isFinite(away) ? formatDistance(away) : "",
          relativeTime(person.time, locale, t),
        );
        return {
          group: "people",
          key: person.username,
          head: formatUsername(person.username),
          line: said,
          // And who that is, which is the one question a position cannot answer:
          // the two follow figures, the line they wrote about themselves, the ways
          // to reach them off lo and their last few posts — lo's own profile page,
          // in the lines this screen has (see pages/person.ts). It is a read that
          // costs a request, and the request is made by the reader opening this
          // one name rather than by the list being drawn (see main.ts).
          body: personBody(said, profile(person.username), context),
          // The verb this screen has and the two above it have not. It is the same
          // sentence in the same corner as a letter's, because it is the same
          // gesture, the same composer and the same endpoint: saying something to
          // somebody who has not written yet and answering somebody who has are
          // one act, and wording them apart would be the app pretending otherwise.
          context: t("people.message"),
        };
      })
    : [nothing("people", feedWord(people, t, WORDS.people))];

  const postItems: Item[] = (posts.data ?? []).length
    ? (posts.data ?? []).map((post) => ({
        group: "posts",
        key: String(post.id),
        head: joined(formatUsername(post.username), relativeTime(post.time, locale, t)),
        // Where it was left, in the corner of the heading while it is being read.
        // It is the one thing about a post that the words themselves seldom say
        // and the reader standing in it always wants.
        meta: post.place || undefined,
        line: postSays(post),
        body: postSays(post),
      }))
    : [nothing("posts", feedWord(posts, t, WORDS.posts))];

  // What is on around here, where the country has anybody to ask. Left out
  // altogether rather than shown empty where it has not: "nothing on this
  // fortnight" is a claim about the neighbourhood, and lo cannot make it for a
  // country it has no listings service for.
  const eventItems = components.includes("events") ? feedItems("events", events, context, WORDS.events) : [];

  return [...messageItems, ...postItems, ...eventItems, ...peopleItems];
}

export const nearbyPage: PageDefinition = {
  // The inbox is the one read this page pays for, and it pays once a minute
  // rather than once a paint (see feeds.ts).
  id: "nearby",
  segment: "nearby",

  // People, posts and letters stop at no border.
  offered: () => true,

  render(context): PageView {
    const { posts, people, events, messages, components, t } = context;

    // The order is the priority: the first group named takes the first spare
    // line (see stack.ts). The letters are named first because they are the one
    // thing on this page addressed to the reader by name — the posts are
    // everybody's and the names are whoever happens to be about — and because
    // they are the group with nothing on any other screen to fall back on.
    const groups: Group[] = [
      {
        id: "messages",
        label: t("messages.title"),
        lines: (messages.data ?? []).map((thread) => {
          // The disc is the dot lo draws on the letter in its top bar: something
          // in this exchange has not been read.
          const dot = thread.unread > 0 ? "● " : "";
          const who = formatUsername(thread.username);
          // The name once where the correspondent is the one who spoke, and twice
          // over — as the exchange and again as the speaker — where they are not.
          // This line is the only place the summary says who a letter is with, so
          // a row that read `You: on my way` and nothing else would be an answer
          // to nobody; and a row that read `@mari: @mari: …` would be the name
          // said twice for no reason.
          //
          // The two shapes carry something as well. A thread whose last word was
          // the reader's own is a thread with nothing waiting in it — there is
          // nothing after their line for anybody else to have said — so the long
          // shape is always the one without a disc in front of it.
          return dot + (thread.mine ? joined(who, said(thread, who, t)) : said(thread, who, t));
        }),
        note: feedWord(messages, t, WORDS.messages),
        max: 3,
      },
      {
        id: "posts",
        label: t("posts.title"),
        lines: (posts.data ?? []).map(
          // A photo with no words is a whole post; where it was taken stands in
          // for the words it does not have, and the coordinates for that.
          (post) => `${formatUsername(post.username)} ${postSays(post)}`,
        ),
        note: feedWord(posts, t, WORDS.posts),
        max: 4,
      },
    ];

    // What is on within walking distance, and only where lo has somewhere to ask.
    if (components.includes("events")) {
      groups.push({
        id: "events",
        label: t("events.title"),
        lines: (events.data ?? []).map((item) => item.title),
        note: feedWord(events, t, WORDS.events),
        max: 2,
      });
    }

    // Last, and one line however many there are. Everyone else about is a line
    // of names rather than a list of them for the reason the sky is one line:
    // three names is what a street usually has, and a row apiece would spend
    // half the page on a column of distances.
    groups.push({
      id: "people",
      label: t("people.title"),
      lines: peopleLine(context),
      note: feedWord(people, t, WORDS.people),
      max: 1,
    });

    return {
      title: placeTitle(context),
      block: { kind: "readings", rows: stack(groups, BODY_LINES) },
    };
  },

  items: nearbyItems,
};
