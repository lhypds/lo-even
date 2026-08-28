// Who is here, what they left on the ground, and who has written.
//
// lo's people tile, its posts tile and its letter, on one page because they are
// the same look around: the names are worth a line, the posts are worth most of
// the rest, and the inbox is worth knowing about before the reader gets back to
// their phone. Presence is one line rather than a list for the reason the sky is
// one line — three names is what a street usually has, and giving each of them a
// row of its own would spend half the screen on a column of distances.
//
// The people and the posts arrive without being asked: they come back with the
// fix on the one read this app makes of it, and the presence trade keeps the
// names current every minute after that (see feeds.ts). The inbox is the one
// thing on this page that is asked for, and only while this page is the one being
// looked at.
//
// The posts are everybody's, which is the whole difference between a post and a
// mark: a mark is yours and stays on your own map, a post is left on the ground
// for whoever comes past it. Nothing here can be pressed — the website's rows
// open the post and its replies, and a pair of glasses has nowhere to open one —
// so what a row carries is what can be read on the spot.

import { distanceMeters, formatCoords, formatUsername } from "../format";
import { BODY_LINES } from "../theme";
import { placeTitle } from "./chrome";
import { feedWord } from "./feed";
import { stack, type Group } from "./stack";
import type { PageContext, PageDefinition, PageView } from "./types";

// How many names the line carries before it starts counting instead. Four is
// what fits; the rest are a figure, which is the honest thing to show when the
// alternative is a name cut in half.
const NAMES = 4;

/** Everyone else who has a tab open around here, nearest first. */
function peopleLine({ people, coords, username }: PageContext): string[] {
  const others = (people.data ?? [])
    // Never yourself: your own dot is not company, and lo leaves the asker out of
    // this list on the server for the same reason.
    .filter((person) => person.username !== username)
    .map((person) => ({ person, away: coords ? distanceMeters(coords, person) : Infinity }))
    .sort((a, b) => a.away - b.away);

  if (others.length === 0) return [];
  const named = others.slice(0, NAMES).map(({ person }) => formatUsername(person.username));
  const rest = others.length - named.length;
  return [named.join(" ") + (rest > 0 ? ` +${rest}` : "")];
}

export const nearbyPage: PageDefinition = {
  // The inbox is the one read this page pays for, and it pays once a minute
  // rather than once a paint (see feeds.ts).
  id: "nearby",

  // People, posts and letters stop at no border.
  offered: () => true,

  render(context): PageView {
    const { posts, people, messages, t } = context;

    const groups: Group[] = [
      {
        label: t("people.title"),
        lines: peopleLine(context),
        note: feedWord(people, t, {
          loading: "common.loading",
          empty: "people.alone",
          failed: "glasses.offline",
        }),
        max: 1,
      },
      {
        label: t("posts.title"),
        lines: (posts.data ?? []).map((post) =>
          // A photo with no words is a whole post; where it was taken stands in
          // for the words it does not have, and the coordinates for that.
          `${formatUsername(post.username)} ${post.body || post.place || formatCoords(post.latitude, post.longitude)}`,
        ),
        note: feedWord(posts, t, {
          loading: "common.loading",
          empty: "posts.empty",
          failed: "glasses.offline",
        }),
        max: 5,
      },
      {
        label: t("messages.title"),
        lines: (messages.data ?? []).map((thread) =>
          // The disc is the dot lo draws on the letter in its top bar: something
          // in this exchange has not been read. The line under it is the last
          // thing said, whoever said it.
          `${thread.unread > 0 ? "● " : ""}${formatUsername(thread.username)} ${thread.body}`,
        ),
        note: feedWord(messages, t, {
          loading: "common.loading",
          empty: "messages.empty",
          failed: "glasses.offline",
        }),
        max: 3,
      },
    ];

    return {
      title: placeTitle(context),
      block: { kind: "readings", rows: stack(groups, BODY_LINES) },
    };
  },
};
