// What people have left around here.
//
// lo's PostsCard: the same list, in the order it was written, with who left it
// and how far off it is. The photo a post may carry does not come — an <img> is
// not a thing this display has — so where a post is only a photo the row falls
// back the way lo's does, to the place it was taken and then to the coordinates
// themselves. A post with nothing readable in it is still a post that is there,
// and a blank row would lose it.
//
// The count in the heading is the figure the rows on screen cannot say for
// themselves: whether there are four posts around here or forty.

import { distanceMeters, formatCoords, formatDistance, formatUsername } from "../../format";
import { feedNote } from "../feed";
import type { CardDefinition, CardView, ListRow } from "../types";

export const postsCard: CardDefinition = {
  id: "posts",
  label: "posts.nearby",

  // lo's own — a post stops at no border.
  offered: () => true,

  render({ posts, coords, t }): CardView {
    const rows: ListRow[] = (posts.data ?? []).map((post) => ({
      lead: formatUsername(post.username),
      // A photo with no words is a whole post; where it was taken stands in for
      // the words it does not have.
      title: post.body || post.place || formatCoords(post.latitude, post.longitude),
      trail: coords ? formatDistance(distanceMeters(coords, post)) : "",
    }));

    const note = feedNote(posts, rows.length, t, {
      loading: "common.loading",
      empty: "posts.empty",
      failed: "glasses.offline",
    });

    return {
      // "nearby", not the bare "posts": this is a screen of answers about where
      // you are standing, and this one is only the posts within reach of it.
      title: t("posts.nearby"),
      // Nothing rather than a nought — the line below is about to say there is
      // nothing around here in words.
      meta: rows.length ? String(rows.length) : undefined,
      block: note ? { kind: "note", text: note } : { kind: "list", rows },
    };
  },
};
