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

import {
  distanceMeters,
  formatCoords,
  formatDistance,
  formatUsername,
  joined,
  relativeTime,
} from "../format";
import { BODY_LINES } from "../theme";
import { placeTitle } from "./chrome";
import { feedItems, feedWord, type FeedWords } from "./feed";
import { nothing } from "./list";
import { stack, type Group } from "./stack";
import type { LoPost } from "../../types";
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
 * What a post says, which is its words — or, for a photo with no words, where it
 * was taken, and the coordinates for that.
 */
function postSays({ body, place, latitude, longitude }: LoPost): string {
  return body || place || formatCoords(latitude, longitude);
}

/**
 * The four groups again, one entry at a time — the same rows the summary above
 * cuts to a line each, with two lines and a screen of their own instead.
 *
 * A person is on the list as well as a post, though there is little to read
 * behind a name: a list the wheel walks out of the middle of is worse than one it
 * walks the whole of, and how far away somebody is and when they last said so is
 * two lines that the summary's one line of four names cannot carry.
 */
function nearbyItems(context: PageContext): Item[] {
  const { posts, people, events, messages, components, locale, t } = context;

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
        line: thread.body,
        // The last thing said, whole. Not the exchange: `GET /api/messages`
        // answers with one line per correspondent and reading it marks nothing
        // read, which is exactly why the glasses may show it — opening the
        // conversation itself is the phone's to do, and answering it is too.
        body: thread.body,
      }))
    : [nothing("messages", feedWord(messages, t, WORDS.messages))];

  const near = others(context);
  const peopleItems: Item[] = near.length
    ? near.map(({ person, away }) => {
        // How far, how long ago they said so, and where that is. The name is the
        // whole of the first line and everything else is the second, so nothing
        // is said twice when the entry becomes a heading and a body.
        const said = joined(
          Number.isFinite(away) ? formatDistance(away) : "",
          relativeTime(person.time, locale, t),
          formatCoords(person.latitude, person.longitude),
        );
        return {
          group: "people",
          key: person.username,
          head: formatUsername(person.username),
          line: said,
          body: said,
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
        lines: (messages.data ?? []).map(
          // The disc is the dot lo draws on the letter in its top bar: something
          // in this exchange has not been read. The line under it is the last
          // thing said, whoever said it.
          (thread) => `${thread.unread > 0 ? "● " : ""}${formatUsername(thread.username)} ${thread.body}`,
        ),
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
