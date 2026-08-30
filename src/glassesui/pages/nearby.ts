// Who is here, what they left on the ground, where to sit down, and who has
// written.
//
// lo's letter, its posts tile, its people dots, its two venue cards and its
// nearby-articles card, on one page because they are the same look around: the
// inbox is worth knowing about before the reader gets back to their phone, the
// posts are worth most of the rest, the names are worth a line, where the
// nearest coffee and the nearest meal are is worth one apiece, and so is what is
// worth reading nearby. Presence is one line rather than a list for the reason
// the sky is one line — three names is what a street usually has, and giving
// each of them a row of its own would spend half the screen on a column of
// distances. The venue lines and the Wikipedia line beside them are packed the
// same way, and measured rather than counted, because a name off somebody's map
// or a title off Wikipedia is anything from six characters to twenty-six (see
// venueLine and wikiLine).
//
// **What is on has gone back to the third page and the food has taken its
// place**, and both halves of that are about what a fact is rather than about
// where there was room. A listing is a thing happening on a particular evening
// and is read the way a headline is read — a source, an hour, and something to
// decide about — which is the third page's whole subject. A café is not an event
// at all: it is a fixture of this street, it will be there tomorrow, and the only
// question about it is which one is nearest. That question belongs where the
// reader is standing.
//
// So the order runs from what is addressed to the reader outwards to what is
// simply here: the letters, what has been left on this ground, who is about,
// then the two things they can walk into, and last what there is to read about
// none of it in particular.
//
// The people, the posts and the three ground reads arrive without being asked.
// The first two come back with the fix on the one read this app makes of it, and
// the presence trade keeps the names current every minute after that; the
// cafés, the food and the nearby articles are three reads of their own on the
// same fix, because lo built that one read before any of those three cards
// existed (see feeds.ts). The inbox is the one thing on this page asked for on
// a beat of its own, and only while this page is the one being looked at.
//
// The posts are everybody's, which is the whole difference between a post and a
// mark: a mark is yours and stays on your own map, a post is left on the ground
// for whoever comes past it.
//
// This page is a summary of six lists, and the six are behind it: a tap puts a
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
  formatCoords,
  formatDistance,
  formatUsername,
  joined,
  postSays,
  relativeTime,
} from "../format";
import { textWidth } from "../metrics";
import { BODY_LINES, READING_VALUES } from "../theme";
import { placeTitle } from "./chrome";
import { feedWord, type FeedWords } from "./feed";
import { nothing } from "./list";
import { personBody } from "./person";
import { stack, type Group } from "./stack";
import type { Translate } from "../../i18n";
import type { LoMessage, LoPersonThread, LoPostThread, LoThread, LoVenue, LoWikiPlace } from "../../types";
import type { Feed, Item, PageContext, PageDefinition, PageView } from "./types";

// How many names the line carries before it starts counting instead. Four is
// what fits; the rest are a figure, which is the honest thing to show when the
// alternative is a name cut in half.
const NAMES = 4;

// What each group says when it has nothing, kept here rather than written out
// twice: the summary and the list are the same groups, and a group that said
// "loading" on one screen and "nobody here" on the other would be two answers to
// one question.
const WORDS: Record<"people" | "posts" | "cafe" | "food" | "wikipedia" | "messages", FeedWords> = {
  people: { loading: "common.loading", empty: "people.alone", failed: "glasses.offline" },
  posts: { loading: "common.loading", empty: "posts.empty", failed: "glasses.offline" },
  cafe: { loading: "cafe.loading", empty: "cafe.empty", failed: "cafe.unavailable" },
  food: { loading: "food.loading", empty: "food.empty", failed: "food.unavailable" },
  wikipedia: { loading: "wikipedia.loading", empty: "wikipedia.empty", failed: "wikipedia.unavailable" },
  messages: { loading: "common.loading", empty: "messages.empty", failed: "glasses.offline" },
};

// The four amenities lo asks OpenStreetMap about, which are the four this
// dictionary has words for. A tag there is a word for is one a reader can have in
// their own language; one there is not is left off rather than printed as the
// slug it arrived as (see venueParts in lo/src/utils/venues.js).
const AMENITIES = new Set(["restaurant", "fast_food", "food_court", "cafe"]);

// And the two of those that say nothing once there is a cuisine to say instead.
// Down a list where nearly every line is a restaurant, "Restaurant" is the part
// carrying no information; a counter you eat at standing up is a different
// evening, and says so.
const PLAIN = new Set(["restaurant", "cafe"]);

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
 * What a place says about itself besides its name, which is at most two words and
 * is lo's own rule about which of them earns the room (see `venueParts` in
 * lo/src/utils/venues.js).
 *
 * The cuisine decides. It is the thing that tells one line from the next, so the
 * amenity is set in front of it only where it carries something of its own — a
 * fast food counter against a table you sit down at — and otherwise stands in for
 * a cuisine nobody has filled in. The cuisine itself stays in the words the
 * mappers wrote it in, less the underscores, which are the file format showing
 * through: there is no closed list of them to translate against, and a guessed
 * translation of somebody's kitchen is worse than their own plain word for it.
 *
 * The rule is kept here rather than at each of the two places it is read, because
 * a rule like that kept in two places is one that gets changed in one of them.
 */
function venueSays(item: LoVenue, t: Translate): string {
  const cuisine = (item.cuisine ?? "").replace(/_/g, " ");
  const amenity = item.category ?? "";
  const named = AMENITIES.has(amenity) && (!cuisine || !PLAIN.has(amenity));
  return joined(named ? t(`venues.category.${amenity}`) : "", cuisine);
}

/**
 * A group of places on the one line it gets: the nearest few, each with how far
 * off it is, and a figure for the rest.
 *
 * The same shape as the people line above and for the same reason — three or four
 * is what a street usually has to offer, and a row apiece would spend half the
 * page on a column of distances — but packed by measuring rather than by a fixed
 * count. A name is a name off somebody's map: `Doutor` is six characters and
 * `Blue Bottle Coffee Shibuya` is twenty-six, so a line cut to four of them would
 * be four on a good street and one and a half on the next.
 *
 * The distance is on every one of them because it is what the list is sorted by,
 * and a row of names in an order the reader cannot see is a row in no order at
 * all. The figure on the end is how many more there are, which is the answer a
 * reader who wants the street rather than the corner takes into the list behind
 * this line.
 *
 * The nearest is always drawn, even where it alone runs past the end of the
 * column: the paint cuts it (see layout.ts), and half of the name of the nearest
 * café is worth more than a line that gave up and said `+7`.
 */
function venueLine(items: LoVenue[]): string[] {
  if (items.length === 0) return [];
  const shown: string[] = [];
  for (const item of items) {
    const next = `${item.name} ${formatDistance(item.distance)}`;
    if (shown.length > 0 && textWidth(withRest([...shown, next], items.length)) > READING_VALUES.width) {
      break;
    }
    shown.push(next);
  }
  return [withRest(shown, items.length)];
}

/** Those, joined lo's own way, with however many did not fit counted after them. */
function withRest(shown: string[], total: number): string {
  const rest = total - shown.length;
  return joined(...shown) + (rest > 0 ? ` +${rest}` : "");
}

/**
 * The same packed line as `venueLine`, for the third of these three groups —
 * the nearest article titles rather than the nearest shopfronts, and the same
 * reason for packing by width rather than by count: a title off Wikipedia runs
 * anywhere from a word to a sentence.
 */
function wikiLine(items: LoWikiPlace[]): string[] {
  if (items.length === 0) return [];
  const shown: string[] = [];
  for (const item of items) {
    const next = `${item.title} ${formatDistance(item.distance)}`;
    if (shown.length > 0 && textWidth(withRest([...shown, next], items.length)) > READING_VALUES.width) {
      break;
    }
    shown.push(next);
  }
  return [withRest(shown, items.length)];
}

/**
 * The same places one at a time, which is what the line above is a summary of.
 *
 * A venue is the one kind of entry down here with nothing to read and nowhere to
 * go: a post has words, a letter has an exchange, a name has a profile — and a
 * café has an address on somebody else's map. So the screen behind one is the
 * short answer to "which one is that": what it is, and where, in the coordinates
 * this app writes every position in. There is no verb on it, because there is
 * nothing up here to do to a café.
 */
function venueItems(group: "cafe" | "food", feed: Feed<LoVenue[]>, { t }: PageContext): Item[] {
  const rows = feed.data ?? [];
  // A group with nothing in it is still one entry saying which of the three kinds
  // of nothing it is, so the wheel can still walk to it (see feed.ts and list.ts).
  if (rows.length === 0) return [nothing(group, feedWord(feed, t, WORDS[group]))];
  return rows.map((item) => {
    // How far off, and what it is — the sort key of the list and the one thing
    // about a place its name never says. The name is the whole of the first line
    // and this is the second, so nothing is said twice when the entry becomes a
    // heading and a body: the same shape a person's entry takes, and for the same
    // reason (see `personBody`).
    //
    // Nothing in the corner of the heading, where a post puts where it was left.
    // That corner is a box laid over the middle of the heading's own line, and it
    // works there because a post is headed by `@kenji · 3m`; a café is headed by
    // its name, and `Blue Bottle Coffee Shibuya` is most of the line the distance
    // would have to be written over.
    const says = joined(formatDistance(item.distance), venueSays(item, t));
    return {
      group,
      key: item.id,
      head: item.name,
      line: says,
      // And underneath, the one thing on this screen a reader can act on: there
      // is no map up here to open and no line to draw on one, so where it is is a
      // pair of coordinates or it is nothing. It is the only position this app
      // still writes out in full, and that is the difference between a shopfront
      // and a person — what came off the people screens came off because four
      // decimal places is eleven metres of where somebody is standing (see
      // pages/person.ts).
      body: [says, formatCoords(item.latitude, item.longitude)].join("\n\n"),
    };
  });
}

/**
 * The same places one at a time, off Wikipedia rather than off OpenStreetMap —
 * the third of the two-line entries this page is made of, and the closest
 * this screen comes to what the phone's own nearby card opens into an iframe
 * over the article itself (see WikipediaCard in lo/src/components): there is
 * no frame up here and no picture either, only the words this display can
 * paint, so the whole of what a hold on this row can do is read the lead
 * paragraph lo already fetched. The phone is still where the rest of the
 * article lives — `distance` and the coordinates are the same two facts a
 * café's entry carries, and the description in between is the one field a
 * café's entry has none of.
 */
function wikiItems(feed: Feed<LoWikiPlace[]>, { t }: PageContext): Item[] {
  const rows = feed.data ?? [];
  if (rows.length === 0) return [nothing("wikipedia", feedWord(feed, t, WORDS.wikipedia))];
  return rows.map((item) => {
    const away = formatDistance(item.distance);
    return {
      group: "wikipedia",
      key: item.id,
      head: item.title,
      line: away,
      // The distance repeated, then the lead paragraph — what the reader
      // stepped in to find out — and where it is underneath, the way a
      // café's own entry carries its coordinates last (see `venueItems`).
      // Three paragraphs rather than `joined`'s " · ": that separator is for
      // a line of facts, and a lead paragraph is a sentence, not a fact.
      body: [away, item.description, formatCoords(item.latitude, item.longitude)]
        .filter((part): part is string => Boolean(part))
        .join("\n\n"),
    };
  });
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
 * The five groups again, one entry at a time — the same rows the summary above
 * cuts to a line each, with two lines and a screen of their own instead.
 *
 * A person is on the list as well as a post, and there is a page behind a name
 * now rather than the two lines the summary could not carry: the profile lo has
 * always had on the phone, fetched when the reader opens that one name (see
 * pages/person.ts).
 *
 * The three at the end are the whole of what the summary's last three lines
 * could only name three or four of. A line that says `Doutor 240 m +11` is the
 * reason to step in here, and this is the eleven.
 */
function nearbyItems(context: PageContext): Item[] {
  const { posts, people, cafe, food, wikipedia, messages, locale, profile, t } = context;

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

  // And the two the reader can walk to, which are never left off: they come off
  // OpenStreetMap, which stops at no border, so there is no country here that
  // cannot be asked (see types.ts). Where OSM is thin the honest answer is a
  // short list or an empty one, which is a claim about the street rather than
  // about the country.
  return [
    ...messageItems,
    ...postItems,
    ...peopleItems,
    ...venueItems("cafe", cafe, context),
    ...venueItems("food", food, context),
    ...wikiItems(wikipedia, context),
  ];
}

export const nearbyPage: PageDefinition = {
  // The inbox is the one read this page pays for, and it pays once a minute
  // rather than once a paint (see feeds.ts).
  id: "nearby",
  segment: "nearby",

  // People, posts and letters stop at no border.
  offered: () => true,

  render(context): PageView {
    const { posts, people, cafe, food, wikipedia, messages, t } = context;

    // The order is the priority: the first group named takes the first spare
    // line (see stack.ts). The letters are named first because they are the one
    // thing on this page addressed to the reader by name — the posts are
    // everybody's and the names are whoever happens to be about — and because
    // they are the group with nothing on any other screen to fall back on.
    //
    // The six ceilings below come to eight against a body of seven lines, one
    // more than the room allows: two letters, two posts, and a line each for who
    // is about, where the coffee is, where the food is and what is worth
    // reading. A full street can therefore no longer answer every group at its
    // own ceiling — the one spare line past the six guaranteed ones goes to
    // whichever of the letters and the posts still has more to show, in that
    // order, so the other of the two stands at one line rather than two. What
    // does not move is where each group sits: a reader learns where the cafés
    // are on this screen once, and they are in the same place on the next walk
    // whatever the inbox is doing.
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
        // Two, where this used to take three. The letters keep the top of the
        // page and the newest pair of them, which is what a glance at an inbox
        // is for; the third row went to the two groups at the foot of the page,
        // and the rest of the correspondence is one tap under this line.
        max: 2,
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
        // Two as well, and the same trade: what has been left on this street is
        // the longest group here and the one whose whole list is a tap away.
        max: 2,
      },
      // One line however many there are. Everyone else about is a line of names
      // rather than a list of them for the reason the sky is one line: three
      // names is what a street usually has, and a row apiece would spend half
      // the page on a column of distances.
      {
        id: "people",
        label: t("people.title"),
        lines: peopleLine(context),
        note: feedWord(people, t, WORDS.people),
        max: 1,
      },
      // And where to sit down, which is the pair of readings this page gained
      // when the listings left it. They are the last two lines for the reason the
      // letters are the first: what is addressed to the reader by name is worth
      // the top of a page, and where the nearest coffee is is a thing they will
      // look for when they want it rather than something that has to catch them.
      //
      // Coffee before food, which is not an order of importance so much as of
      // length: a café is a name and a distance and a food row often carries a
      // cuisine as well, so the shorter of the two reads better above the longer.
      // Neither is gated on the country — OpenStreetMap stops at no border, so
      // unlike the listings that used to stand here there is nowhere lo has to
      // leave these off (see types.ts).
      {
        id: "cafe",
        label: t("cafe.title"),
        lines: venueLine(cafe.data ?? []),
        note: feedWord(cafe, t, WORDS.cafe),
        max: 1,
      },
      {
        id: "food",
        label: t("food.title"),
        lines: venueLine(food.data ?? []),
        note: feedWord(food, t, WORDS.food),
        max: 1,
      },
      // Last, because it is the one line here about neither company nor a place
      // to walk into: an article is worth knowing is nearby and is not waiting to
      // catch the reader the way a letter or a post is. Packed the same way the
      // two lines above it are (see `wikiLine`) — a Wikipedia title is anywhere
      // from a word to a sentence, the same unevenness a shopfront's name has.
      {
        id: "wikipedia",
        label: t("wikipedia.title"),
        lines: wikiLine(wikipedia.data ?? []),
        note: feedWord(wikipedia, t, WORDS.wikipedia),
        max: 1,
      },
    ];

    return {
      title: placeTitle(context),
      block: { kind: "readings", rows: stack(groups, BODY_LINES) },
    };
  },

  items: nearbyItems,
};
