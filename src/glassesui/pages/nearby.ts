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
// reader is on. The website's row opens the post *and its replies*, and so does
// this one now: the column comes up under the words, in the shape every message in
// this app is written in.
//
// Three of those bottom screens can be answered from, and they are the same
// exception three times: a letter, a person and a post are all somebody's, and a
// hold on any of them dictates a sentence that goes to them — into their inbox for
// the first two, into the column under their post for the third. That is the one
// verb down here, and all three screens say so in the same words in the same
// corner (see pages/person.ts). What is still on the phone is everything with a
// keyboard or a camera behind it: a post's picture, and editing any of it after
// the fact.

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
import type { LoMessage, LoPersonThread, LoPostThread, LoThread } from "../../types";
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
/**
 * Which row a row is, across the two kinds the inbox now holds.
 *
 * A letter is named by its correspondent and a column by its post, and neither
 * name is unique against the other's — `@mari` and post 7 could both be `7` on a
 * bad day, and a reader's place in a list is held by name rather than by number
 * (see pages/list.ts). So each says which of the two it is, exactly as lo's own
 * inbox keys its rows (see `rowKey` in lo/src/components/MessagesModal).
 */
function threadKey(thread: LoThread): string {
  return thread.kind === "post" ? `${POST_ROW}${thread.postId}` : `${PERSON_ROW}${thread.username}`;
}

const POST_ROW = "post:";
const PERSON_ROW = "person:";

/**
 * And the same key read back, for the two errands that have only the key: the
 * clock that files a row as read, and the hold that answers it (see main.ts).
 *
 * Both of those are about the row in front of the reader and neither of them has
 * the row — what the display keeps is a group and a key, by name rather than by
 * position, because the list is rebuilt under the reader on every paint (see
 * pages/list.ts). So the key has to carry which kind it is, and this is the other
 * half of the pair that puts it there.
 */
export function threadRef(key: string): { kind: "person" | "post"; name: string } | null {
  if (key.startsWith(POST_ROW)) return { kind: "post", name: key.slice(POST_ROW.length) };
  if (key.startsWith(PERSON_ROW)) return { kind: "person", name: key.slice(PERSON_ROW.length) };
  return null;
}

/**
 * What there is to call a post, which is lo's own three answers in lo's own
 * order: its words, else where it was left, else the plainest thing there is to
 * call a post with neither.
 *
 * The same chain `postSays` walks for a post on the street, one link shorter: a
 * row of the inbox carries no coordinates to fall back to, and would not want
 * them if it did — a column is named by what it is under, and "35.6580°N" is not
 * something a reader recognises a post by.
 */
function names(thread: LoPostThread, t: Translate): string {
  return thread.post || thread.place || t("comments.aboutPost");
}

/**
 * And the row's own heading: not who, but what it is about.
 *
 * This is the one line that makes a column readable as a column. Until it existed
 * every row of this list was headed by a person, and a column headed by a person
 * is headed by whoever happened to come past last — which names none of what the
 * row is, and reads as a letter from somebody who never wrote one. lo's own
 * wording, key for key (`messages.onPost`), quotation marks and all: the marks are
 * what stop `On the cherry blossom is out` reading as a sentence the app is saying
 * rather than one it is quoting.
 */
function about(thread: LoPostThread, t: Translate): string {
  return t("messages.onPost", { post: names(thread, t) });
}

function exchange(thread: LoPersonThread, { thread: read, t }: PageContext): string {
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
function letterFoot(thread: LoPersonThread, { thread: read, t }: PageContext): string {
  const { status } = read(thread.username);
  if (status === "failed") return t("glasses.offline");
  return status === "ready" ? t("messages.reply") : t("messages.reading");
}

/**
 * What was said back about one post, written out under it — which is what the
 * website's own row opens into, and which used to be the one thing on that row
 * the glasses had no answer for.
 *
 * **Oldest first, where the exchange above is newest first.** That is not an
 * inconsistency between two lists of the same kind; they are lists of different
 * kinds. A letter is the whole of its screen and the line the reader came for is
 * the last one said, so the wheel has to start there. A post is the thing the
 * reader came for and it is already at the top, in the heading and the first
 * paragraph — everything under it is what came after it, and what came after it
 * reads in the order it was said. It is also the order lo draws this column in, for
 * lo's own reason: every other list on lo answers "what has been happening" and
 * this one answers "what was said".
 *
 * Each remark is a name, a colon and the sentence, which is how every message in
 * this app is written (see `said`). The reader's own says `You`, worked out from
 * the name rather than taken off the answer: lo's own column has a face beside
 * each line and needs no such field, and up here there is neither a face nor a
 * side of the screen to put one on.
 *
 * `words` is what the post itself says rather than the post, because the two
 * screens that come here have two different amounts of it. One is standing on the
 * street with the whole post in hand; the other is in the inbox, where lo hands
 * over the post's words and where it was left and nothing else. Both name it the
 * same way, so a post read from either screen reads the same.
 */
function column(postId: number, words: string, { comments, username, t }: PageContext): string {
  // Nothing to draw and nothing on its way. Both the ordinary case — most posts
  // have no column at all — and the moment before the answer lands, which is a
  // moment the footer is already accounting for: the words the reader stepped in
  // for are on the screen either way, and lines appear under them rather than the
  // screen rearranging itself.
  const rows = comments(String(postId)).data ?? [];
  if (rows.length === 0) return words;
  // One paragraph each, laid end to end by the reading screen with no air between
  // (see proseLines in layout.ts) — so the post is the block at the top and every
  // line starting at the margin under it is somebody answering it.
  return [
    words,
    ...rows.map((remark) =>
      said(
        { body: remark.body, mine: remark.username === username },
        formatUsername(remark.username),
        t,
      ),
    ),
  ].join("\n");
}

/**
 * And what the footer says while a post is open, which is the letter's two
 * sentences again for the same two reasons (see `letterFoot`).
 *
 * **A post with nothing under it says the verb straight away**, which is what
 * `empty` is for. The count comes in on a post on the street, so that screen can
 * tell an empty column from one that has not arrived without asking anybody — and
 * lo is never asked about a post nobody has answered (see feeds.ts). "Reading the
 * replies" over a post that has none would be a screen waiting for an answer it
 * already has. A column reached from the inbox is never empty: a thread with no
 * lines in it is not in the inbox at all.
 */
function postFoot(postId: number, empty: boolean, { comments, t }: PageContext): string {
  if (empty) return t("posts.reply");
  const { status } = comments(String(postId));
  if (status === "failed") return t("glasses.offline");
  return status === "ready" ? t("posts.reply") : t("posts.reading");
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
    ? (messages.data ?? []).map((thread) => {
        // The disc is lo's own dot on the letter in its top bar: something in
        // this row has not been read. It stays in front of the heading here
        // rather than moving to the margin, because the margin is gone — an
        // entry is one container and one brightness, and the bright one is the
        // one the reader is on (see layout.ts).
        const dot = thread.unread > 0 ? "● " : "";
        const when = relativeTime(thread.time, locale, t);
        const who = formatUsername(thread.username);
        // Who spoke last and what they said, which is the same line on both kinds
        // and says two different things because of what is over it. On a letter the
        // heading already names the exchange, so this names only the speaker —
        // which is the one thing the heading cannot say, an exchange being two
        // people. On a column the heading names the post, so this is the only place
        // any of the voices under it is named at all.
        const last = said(thread, who, t);

        // A column of remarks rather than a letter. Everything about the row
        // changes with it, because it is a row about a thing rather than about a
        // person: what heads it, what is behind it, and which of lo's two reads a
        // press turns into.
        if (thread.kind === "post") {
          return {
            group: "messages",
            key: threadKey(thread),
            // What it is about, not who wrote last. A column headed by a person
            // would be headed by whoever happened to come past most recently, which
            // names none of what the row is (see `about`).
            head: `${dot}${joined(about(thread, t), when)}`,
            line: last,
            // The post, and the column under it — the same screen the post's own
            // entry on the street opens into, so a post read from either place
            // reads the same. The remarks arrive with the request that marks the
            // column read, and until they do this is the post on its own.
            body: column(thread.postId, names(thread, t), context),
            context: postFoot(thread.postId, false, context),
          };
        }

        return {
          group: "messages",
          key: threadKey(thread),
          head: `${dot}${joined(who, when)}`,
          line: last,
          // The exchange, newest first — the one entry in this app whose reading
          // screen is a list rather than a thing. `GET /api/messages` answers with
          // one line per correspondent, which is what the row above shows; the rest
          // of it arrives with the request that marks the letter read, and until it
          // does this is that same one line (see `exchange`).
          body: exchange(thread, context),
          context: letterFoot(thread, context),
        };
      })
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
        // The post, and what was said back about it underneath — which is what
        // lo's own row opens into, and which the summary above has no room for
        // (see `column`). The remarks are fetched when the reader opens this one
        // post, and only where lo has already said there are any.
        body: column(post.id, postSays(post), context),
        // The third screen in the app with a verb of its own, and the same
        // gesture as the two above it: a hold here is a remark left under this
        // post. It is the public one of the three — a letter lands in one inbox,
        // and this lands in the street beside whatever it is answering — which is
        // why the screen that shows it before it goes says who reads it.
        context: postFoot(post.id, post.comments === 0, context),
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
          // in this row has not been read.
          const dot = thread.unread > 0 ? "● " : "";
          const who = formatUsername(thread.username);
          // A column says what it is about and then who spoke, always both: the
          // post is what the row is and the name is the one thing the post cannot
          // say, a column having as many voices in it as came past. There is no
          // short shape for it — `You: …` under no heading would be a remark about
          // nothing, and this line is the whole of the summary's row.
          if (thread.kind === "post") return dot + joined(about(thread, t), said(thread, who, t));
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
