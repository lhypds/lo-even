// Who one of the names on the street actually is — lo's own profile page, in the
// five lines a reading screen has.
//
// Until this existed, opening a name gave back exactly what the list already
// showed: how far away they were, when they last said so, and — until this
// existed — the coordinates of the spot they said it from. That last part is
// gone from both screens and is the reason this file was written. A person's
// position to four decimal places is eleven metres of somebody's actual
// whereabouts, printed for anybody with a pair of glasses and a tab open, and no
// screen in lo has ever shown it: the website draws a dot on a map at a scale
// nobody can read a doorway off, and the number itself is nobody's business. A
// distance and an hour is the honest form of "who is about" — it says there is
// somebody here without saying which window they are behind.
//
// What is worth reading behind a name is who they are, which is the one question
// a position cannot answer, and lo has answered it on a page of its own for as
// long as it has had profiles. So the same five things come up here, in the same
// order that page puts them in (see lo/src/components/UserProfile): what they do,
// the two follow figures, the line they wrote about themselves, the ways to reach
// them off lo, and the last of what they have left on the ground.
//
// **Five posts, where lo draws twenty.** A profile on a phone is scrolled; this
// one is walked a screenful at a time with a wheel, and the twenty would be four
// flicks of somebody else's afternoon between the reader and the end of the
// screen. Five is a fortnight of an ordinary account and the rest is on the phone.
//
// **A label and a value per line, and no headings over them.** A contact is one
// of lo's `<dl>` rows and comes up here as what a `<dl>` row is on this display:
// a quiet word and the reading beside it. That is also what saves the section
// heading lo puts over them — a line that reads `Email mari@example.com` says
// which section it is in by saying it. The posts are the exception and do carry
// their heading, because a post is a sentence with an hour in front of it and
// nothing about the sentence itself says it is a post rather than a contact.

import { joined, postSays, relativeTime } from "../format";
import type { LoPersonPage, LoProfile } from "../../types";
import type { Feed, PageContext } from "./types";

// How many of somebody's own posts are worth carrying up here — see the note on
// the twenty above.
const POSTS = 5;

// The trades lo's own profile sheet offers a word for (see lo/src/utils/work.js).
// A set of slugs rather than a table of names, which is where this parts company
// with the platforms below: a platform is called the same thing in every language
// and a trade is a common noun — a photographer is 摄影师 to a reader in Chinese
// and 写真家 to one in Japanese — so the words live with all the other words,
// under `work.<kind>`, and what is kept here is only which of them there are.
//
// In slug order, which is nobody's order. lo sorts this list because lo draws it
// as a menu somebody picks their own trade out of, and a menu has a top whether
// anybody means it to or not; up here it is never drawn as a list at all — the
// glasses have no sheet to fill in — and is only ever asked about one key at a
// time.
const WORK = new Set([
  "architect",
  "artist",
  "chef",
  "designer",
  "developer",
  "doctor",
  "engineer",
  "filmmaker",
  "founder",
  "journalist",
  "musician",
  "photographer",
  "researcher",
  "student",
  "teacher",
  "writer",
]);

// The ways off lo that have a field of their own, in the order lo's profile lists
// them (see lo/src/utils/contacts.js). Four of them are the same list lo asks
// everybody for; what a reader does with any of them happens in the app the
// contact belongs to, which is a phone's errand — up here they are read off,
// which is all a screen with no clipboard can honestly offer.
const CONTACTS: Array<{ field: keyof LoProfile; label: string }> = [
  { field: "email", label: "profile.email" },
  { field: "website", label: "profile.website" },
  { field: "line", label: "profile.line" },
  { field: "whatsapp", label: "profile.whatsapp" },
  { field: "wechat", label: "profile.wechat" },
];

// And what the open end of that list is called, for the platforms lo has a name
// for (see lo/src/utils/links.js). Not translated, and deliberately: every one of
// these is what the platform calls itself in the script it calls itself in — a
// reader looking for 小红书 on somebody's profile is looking for those three
// characters, and "RED" would be lo renaming somebody else's app.
//
// A kind this table has never heard of is shown under the slug it was saved
// under, which is the same answer the warnings row gives a hazard it has no word
// for: what arrived is worth more to the reader than a blank.
const PLATFORMS: Record<string, string> = {
  x: "X",
  xiaohongshu: "小红书",
  wechat: "微信",
  line: "LINE",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  threads: "Threads",
  tiktok: "TikTok",
  douyin: "抖音",
  weibo: "微博",
  bilibili: "Bilibili",
  youtube: "YouTube",
  github: "GitHub",
  telegram: "Telegram",
  mastodon: "Mastodon",
  linkedin: "LinkedIn",
};

/**
 * What to call somebody's trade. A slug off the list above is read in the
 * language this screen is being read in; anything else is what its owner wrote,
 * which is already in a language and is not lo's to translate — the same answer
 * the links row gives a platform this app has no name for, and the same answer
 * lo's own page gives (see workName in lo/src/utils/work.js).
 */
function workName(work: string, t: PageContext["t"]): string {
  return WORK.has(work) ? t(`work.${work}`) : work;
}

/**
 * The two figures, written as one reading. Both follower keys exist in every
 * dictionary so languages can distinguish the singular where they need to.
 */
function figures({ followers, following }: NonNullable<LoPersonPage["follows"]>, t: PageContext["t"]): string {
  return joined(
    t(followers === 1 ? "user.follower" : "user.followers", { n: followers }),
    t("user.following", { n: following }),
  );
}

/**
 * One person, read whole: where they are in the first line and who they are in
 * everything under it.
 *
 * **The presence line stands whatever else happens.** It is what the list showed
 * a moment ago, and a screen that answered a tap by replacing those words with
 * one about itself would read as having lost them — the same rule the newswire's
 * reading screen keeps for its headline (see pages/feed.ts). It is also what
 * keeps this entry enterable at all: an entry with no body is one the app steps
 * back out of (see glasses.ts).
 *
 * **Everything under it is left out rather than stood in for.** Most profiles
 * have most of their fields empty, and there is nothing to say on somebody's
 * behalf about who they are — so a bio nobody wrote is a line that is not there,
 * exactly as it is on lo's own page.
 *
 * Each line is its own paragraph, which the reading screen breaks and lays end to
 * end with no air between (see proseLines in layout.ts) — so a line starting at
 * the margin is a new thing being said about this person.
 */
export function personBody(presence: string, page: Feed<LoPersonPage>, { locale, t }: PageContext): string {
  const profile = page.data?.user;
  if (!profile) {
    // The two states this screen is met in before the answer lands. Not three:
    // lo has no empty profile to give — a name that came back off the presence
    // trade is an account — so "nobody could be reached" is the only thing that
    // can go wrong, and a request still out is the only other thing there is.
    return [presence, t(page.status === "failed" ? "glasses.offline" : "common.loading")].join("\n");
  }

  const lines = [presence];
  // What they do, as high up the page as the presence line leaves room for —
  // which is where lo's own page puts it, directly under the name, and for lo's
  // reason: a name and a trade is how a person is introduced on paper, and it is
  // the one thing here that says what somebody would be about before a word of
  // their own is read.
  //
  // Bare, with no label in front of it, where a contact carries one. A contact
  // is a reading and needs saying which reading it is — an address is an address
  // whether it is email or a website — and a trade is the answer itself, the same
  // as the bio under it.
  const work = profile.work?.trim();
  if (work) lines.push(workName(work, t));
  if (page.data?.follows) lines.push(figures(page.data.follows, t));
  if (profile.bio) lines.push(profile.bio);

  for (const { field, label } of CONTACTS) {
    const value = profile[field];
    if (typeof value === "string" && value) lines.push(`${t(label)} ${value}`);
  }
  // The open end of the same list, under the named fields — which is the order
  // lo draws them in, and for lo's reason: the fields are the same five on every
  // profile and are where the eye already knows to start, and the rows after them
  // keep the order their owner added them in.
  for (const link of profile.links ?? []) {
    if (link?.value) lines.push(`${PLATFORMS[link.kind] ?? link.kind} ${link.value}`);
  }

  const posts = (page.data?.posts ?? []).slice(0, POSTS);
  if (posts.length > 0) {
    lines.push(t("user.posts"));
    // The hour in front of the words rather than after them: this is a column of
    // short lines and the reader is scanning down the front of it for how recent
    // any of this is. A photo with no words is a whole post, and where it was
    // taken stands in for the words it does not have (see postSays in format.ts).
    for (const post of posts) lines.push(joined(relativeTime(post.time, locale, t), postSays(post)));
  }

  return lines.join("\n");
}
