import type {
  Coordinates,
  LoArticle,
  LoComment,
  LoDashboard,
  LoMessage,
  LoPerson,
  LoPersonPage,
  LoPost,
  LoThread,
  LoUser,
  LoVenuesResult,
  LoWarningsResult,
} from "../types";
import { detectLanguage, isLanguage, type Language } from "../i18n";

const API_BASE = "https://lo.gcc3.com";

// What lo will take as the name of a mark, as the words of a post, as a remark
// under one and as the words of a letter, character for character (see
// lo/server/index.js: `POST /api/marks`, `POST /api/posts`,
// `POST /api/posts/:postId/comments`, `POST /api/messages/:username`).
const MARK_LABEL_MAX = 48;
const POST_BODY_MAX = 500;
const COMMENT_BODY_MAX = 300;
const MESSAGE_BODY_MAX = 1000;

/**
 * A spoken sentence cut to what lo will take as the name of a spot.
 *
 * Cut rather than refused: a sentence is easily past 48, and a mark saved with
 * its name cut short is worth more to the reader than a mark that was not saved.
 *
 * Not shown to the reader on the way past, which it used to be — the composer
 * drew the sentence cut to whichever answer the wheel was on, and 48 characters
 * lands in the middle of a word often enough that the screen read as a broken one
 * (see pages/compose.ts). So this is the one place the cut happens, and none of
 * these four are anybody else's business any more.
 */
function markLabel(text: string): string {
  return Array.from(text.trim()).slice(0, MARK_LABEL_MAX).join("").trim();
}

/** The same, for the words of a post — where lo's own limit is ten times as long. */
function postBody(text: string): string {
  return Array.from(text.trim()).slice(0, POST_BODY_MAX).join("").trim();
}

/**
 * And for a remark under somebody's post, which lo gives less room than the post
 * itself: a comment is read in a column under something else and has no ground of
 * its own to be about, so lo takes 300 of it against the post's 500 (see the note
 * over `COMMENT_BODY_MAX` in lo/server/index.js). A minute of talking can pass
 * that, which is more than the microphone will take in one hold.
 */
function commentBody(text: string): string {
  return Array.from(text.trim()).slice(0, COMMENT_BODY_MAX).join("").trim();
}

/**
 * And for a reply, which lo gives twice as much room again: a message is a letter
 * rather than a remark. A spoken one has to run for well over a minute to reach
 * it, which is longer than the microphone stays open — so this one never actually
 * cuts anything, and it is here because the endpoint has a limit and a client that
 * did not know it would find that out from a 400.
 */
function messageBody(text: string): string {
  return Array.from(text.trim()).slice(0, MESSAGE_BODY_MAX).join("").trim();
}

// Re-exported because the sign-in screen and the language switcher in its corner
// have always imported it from here, and the list itself now lives with the rest
// of lo's shapes (see types.ts).
export type { Language } from "../i18n";

// The two things this frame writes down.
//
// The language under the key lo keeps its own choice under (see
// lo/src/i18n/index.js), with the same order of preference behind it: what was
// chosen last, else the phone's own language where lo has words for it. A
// language is not a credential, and a reader who has said ZH once and is asked
// again at the next launch has been shown a bug rather than a preference.
const LANGUAGE_KEY = "lang";

// And the session token, which is a credential and is written down anyway,
// because the alternative is a password at every launch of a package that is
// opened from a pair of glasses. It is the same 30-day session lo keeps in its
// own storage on its own origin (see lo/src/api.js), and out here it buys back
// both frames rather than one: `POST /api/me/link` names the account it belongs
// to and mints the fresh link key the WebView is entered on.
//
// The cost is the one lo already states for its own copy: a token in
// localStorage is readable by any script injected into this page, where nothing
// stored at all was not, and it stays good for as long as the session does.
const TOKEN_KEY = "token";

function savedLanguage(): Language | null {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return isLanguage(saved) ? saved : null;
  } catch {
    // A WebView with storage denied still has a language; it just cannot keep it.
    return null;
  }
}

function savedToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    // The same WebView asks for the password; it cannot do otherwise.
    return "";
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface Session {
  token: string;
  // The account's link key, which is how the WebView frame is entered: `?k=`.
  // It is never stored, and it is withdrawn a minute after this sign-in, once
  // the frame has traded it for a session of its own.
  key: string;
  user: LoUser;
}

/**
 * lo's API, as the glasses use it.
 *
 * Every endpoint here is one the website calls too, and one of them — `POST
 * /api/dashboard` — is the read lo added for exactly this client: the place, its
 * weather, the regional feeds, the posts within reach and who else is about, in a
 * single round trip. The glasses want that shape again now that their first page
 * is a count of all of it at once, so a fix costs two reads rather than seven
 * (see feeds.ts and server-integration.md).
 *
 * The rest are the cheap ones, asked for on their own beat because they answer
 * questions the dashboard's answer goes stale on faster than the reader moves:
 * the posts on the ground, the warnings overhead and the inbox.
 */
export class LoApi {
  // Whatever the last launch left behind, which is a session to try rather than
  // one to trust: it may have aged out, been signed out from the phone, or been
  // dropped by a server restart. `resume` is what asks (see main.ts).
  private token = savedToken();
  // Which language everything the glasses are fed comes back in, and the one the
  // sign-in screen is read in. Not readonly: the switcher in that screen's corner
  // is the same control lo has in its own.
  language: Language;

  constructor() {
    this.language = savedLanguage() ?? detectLanguage();
  }

  setLanguage(language: Language) {
    this.language = language;
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Kept for this launch either way.
    }
  }

  /**
   * The token this launch presents, and — unless told otherwise — the one the
   * next launch will start from: signing in writes it down, signing out takes it
   * back out again, and there is one copy of it either way.
   *
   * `write` is false in exactly one place. A launch that could not reach lo at
   * all has learned nothing about whether the stored session is still good, and
   * forgetting it over a dead tunnel would cost a password on the next launch
   * for a fault that had nothing to do with the session — on a launch where the
   * sign-in screen could not have signed anybody in either (see main.ts).
   */
  setToken(token: string, write = true) {
    this.token = token;
    if (!write) return;
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Storage denied: this session lasts as long as this launch does.
    }
  }

  get signedIn(): boolean {
    return Boolean(this.token);
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    if (options.body && typeof options.body === "string") headers.set("Content-Type", "application/json");

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (response.status === 204) return undefined as T;
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new ApiError(
        typeof data.error === "string" ? data.error : `Request failed (${response.status})`,
        response.status,
        typeof data.code === "string" ? data.code : undefined,
      );
    }
    return data as T;
  }

  /* ------------------------------------------------------------ the session */

  /**
   * The first of the two goes a sign-in is asked in, and the one that signs
   * nobody in: whether this name is an account at all. It is asked before the
   * password screen goes up rather than after, because a mistyped name is the
   * commonest thing wrong with a sign-in and hearing about it from the password
   * step is being told which field was wrong one field too late.
   *
   * A name nobody is using comes back `USER_NOT_FOUND`, which the screen takes as
   * the offer to open that account rather than as a fault (see webui/login.ts).
   *
   * `hasPassword` is the other half of the answer, and it decides which password
   * step follows. It is false for an account opened before there were passwords,
   * whose password the next sign-in *chooses* rather than checks (see
   * `POST /api/login` in lo/server/index.js) — so that reader is told the line
   * they are typing is the one they will be asked for from now on.
   */
  checkUsername(username: string) {
    return this.request<{ username: string; hasPassword: boolean }>("/api/username", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  }

  async login(username: string, password: string): Promise<Session> {
    const session = await this.request<Session>("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(session.token);
    return session;
  }

  /**
   * The account opened, which is the other request in lo that hands a session
   * out — and it hands out exactly what the sign-in above does, token and link
   * key alike, because a reader who has just opened an account is signed into it.
   *
   * It is one press further on from the offer: the name was answered for on the
   * step before, the reader said to open it, and this is the password they said
   * to open it with. The name is checked again here, by lo, against everything
   * `POST /api/username` checked and the reserved list besides — a name free two
   * screens ago can have been taken since, which comes back as `USER_EXISTS` and
   * sends the reader back to the field it belongs to.
   */
  async register(username: string, password: string): Promise<Session> {
    const session = await this.request<Session>("/api/users", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(session.token);
    return session;
  }

  /**
   * The stored session taken up again: who the token belongs to, and a fresh link
   * key to enter the WebView on. One round trip rather than two, because a launch
   * that has to make two before it can show anything shows a blank screen for
   * both of them.
   *
   * The key half is the whole reason this endpoint exists. A key is withdrawn a
   * minute after every sign-in, so there is never one left over to write down;
   * without a way to mint another from the token, a stored session could bring
   * the glasses back but never the frame, and an app half signed in is worse than
   * one that asks (see server-integration.md).
   */
  resume() {
    return this.request<{ user: LoUser; key: string }>("/api/me/link", { method: "POST" });
  }

  // Withdrawing the link key, once the WebView has finished spending it. It takes
  // the key out of the account altogether; neither session the key opened is
  // touched, so this signs nobody out of anything.
  revokeLinkKey() {
    return this.request<void>("/api/me/link", { method: "DELETE" });
  }

  logout() {
    return this.request<void>("/api/logout", { method: "POST" });
  }

  /* ---------------------------------------------------------- one screenful */

  /**
   * Where this is, its weather, which regional feeds this country has, those
   * feeds, the posts within reach and who else is about — all of it in one round
   * trip. The website reads these one at a time because its cards arrive
   * separately; this is the read lo added for a client that cannot afford the
   * round trips, and the glasses are that client again now that their first page
   * is a summary of every one of those answers at once (see server-integration.md).
   *
   * It files our fix as well as asking about it, the same trade `PUT /api/position`
   * makes, which is why it takes the fix in the body rather than the query.
   */
  dashboard({ latitude, longitude, accuracy }: Coordinates) {
    return this.request<LoDashboard>(`/api/dashboard?lang=${this.language}`, {
      method: "POST",
      body: JSON.stringify({ latitude, longitude, accuracy }),
    });
  }

  // Not in that answer, and its own read for a reason: Yahoo is asked per
  // municipality where everything above is asked per city, and it is the one
  // reading that does not take the interface language — Yahoo answers in
  // Japanese, and the words the page can translate it translates itself.
  warnings({ latitude, longitude }: Coordinates) {
    return this.request<LoWarningsResult>(`/api/warnings?lat=${latitude}&lon=${longitude}`);
  }

  /**
   * The words behind one headline, asked for by the row's own link — the opaque
   * `news.google.com` address the feed gave, which lo resolves to the publisher's
   * before it reads anything.
   *
   * The one read in this file nobody's position asks for. Everything above is a
   * question about where the reader is standing and is asked the moment they
   * move; this is asked only when they have opened something, because until then
   * there is no telling which of twenty headlines they meant — and reading all
   * twenty on the chance would spend sixty requests on somebody else's
   * newspapers to fill a store mostly with things never read.
   *
   * It is slow the first time anyone anywhere opens a given story — lo has to
   * resolve Google's link and then fetch the page, which is two round trips
   * before the words — and a file read for everyone after. That first wait is
   * why the reading screen has something to say while it is on its way.
   *
   * The title and the source are the feed's own wording, sent as a fallback for
   * a page that does not state its own. A 404 is not an error to show: it is a
   * story lo could not read — a publisher that will not answer a server, or a
   * paywall — and the honest answer up here is the headline and where to go for
   * the rest (see pages/feed.ts).
   */
  article(link: string, { title, source, kind }: { title?: string; source?: string; kind?: string }) {
    const query = new URLSearchParams({ link });
    if (title) query.set("title", title);
    if (source) query.set("source", source);
    if (kind) query.set("kind", kind);
    return this.request<LoArticle>(`/api/articles?${query}`);
  }

  /**
   * What is on the ground here. It comes back with the dashboard as well, and this
   * is the same answer asked for on its own: one database read against the four
   * upstream lookups the dashboard is, which is what makes it cheap enough to
   * repeat on the minute beat. A post written or deleted while the reader stands
   * still is the one thing on these pages that changes without them moving.
   */
  posts({ latitude, longitude }: Coordinates) {
    return this.request<{ posts: LoPost[] }>(
      `/api/posts?lat=${latitude}&lon=${longitude}&lang=${this.language}`,
    );
  }

  /**
   * Somewhere to eat, and somewhere for a coffee — nearest first, each row with
   * how far off it is from the fix that asked. Two addresses rather than one with
   * a kind hung off it, because lo answers them as two cards and the glasses draw
   * them as two lines: "where can I eat" and "where can I sit down with a coffee"
   * are asked at different hours and answered by different streets.
   *
   * The one pair of reads in this file that is about the ground and is not in the
   * dashboard's answer. `POST /api/dashboard` was built before these two cards
   * existed and still does not carry them, and they are cheap enough to ask for
   * on their own: lo keeps an hour's answer per ~1 km square of ground, because a
   * restaurant is not news and tomorrow's list is today's. What makes either of
   * them a new question is the reader having walked somewhere (see feeds.ts).
   *
   * Both stop at no border. OpenStreetMap is the one upstream behind these pages
   * with no country list in front of it, so unlike the newswire and the trends
   * there is nothing to ask `components` about before asking this.
   */
  food({ latitude, longitude }: Coordinates) {
    return this.request<LoVenuesResult>(
      `/api/food?lat=${latitude}&lon=${longitude}&lang=${this.language}`,
    );
  }

  cafes({ latitude, longitude }: Coordinates) {
    return this.request<LoVenuesResult>(
      `/api/cafe?lat=${latitude}&lon=${longitude}&lang=${this.language}`,
    );
  }

  /**
   * What was said back about one post. Everyone's, like the post it hangs off:
   * what a passer-by said about something left on the ground is part of what the
   * next passer-by finds there.
   *
   * **And asking is what marks the column read**, exactly as asking for an
   * exchange is and for lo's same reason: a column somebody has just been shown is
   * one they have seen, and lo has no button anywhere for saying so. So this is the
   * second read in this file that is really a write, it goes behind the same
   * three-second clock the exchange does, and the recounted `unread` comes back
   * with it — the badge in the corner counts remarks as well as letters, because
   * the dot means "somebody wrote" and that is as true of a line under your photo
   * as of one addressed to you (see countUnread in lo/server/db.js).
   *
   * Asked for when the reader opens that one post and never while they are
   * walking the list, which is the same rule the story and the profile above
   * keep. A post on the street carries the count of these on it, so the glasses
   * know without asking whether there is a column there at all — and a post with
   * none is one read this never costs (see feeds.ts).
   */
  comments(postId: number) {
    return this.request<{ comments: LoComment[]; unread: number }>(`/api/posts/${postId}/comments`);
  }

  /**
   * A remark under somebody's post, said rather than typed — the third thing a
   * hold can turn into, and the second of the two that other people read.
   *
   * lo's own is a line in the sheet the post opens into, with a keyboard under it;
   * this is the same endpoint reached from a screen that has neither, so the words
   * are a dictation and the posting is a tap. Under anybody's post including your
   * own, which is lo's rule rather than this client's: a writer answering the
   * people who came past is the ordinary shape of one of these columns.
   *
   * Like a letter and unlike a post, it carries no fix: a comment is filed under
   * the post it is about, and where the reader was standing when they said it is
   * nobody's business — the post already says where the ground is.
   */
  comment(postId: number, body: string) {
    return this.request<{ comment: LoComment; comments: number }>(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: commentBody(body) }),
    });
  }

  /**
   * Who somebody is: the line they wrote about themselves, the ways to reach them
   * off lo, how many read them and how many they read, and the last of what they
   * have left on the ground — lo's whole profile page in one answer, which is the
   * shape the glasses want for the same reason the dashboard is one read.
   *
   * The one question in this file about a person rather than about a place. A
   * name that comes back off the presence trade is a dot and an hour and nothing
   * else, and a reader who has stopped on one of those dots is asking who that
   * is; this is the read that answers, and it is made only once they have opened
   * one of them (see feeds.ts).
   *
   * It marks nothing and files nothing — unlike the exchange above, which is a
   * read that is really a write — so nothing has to wait on a clock before asking.
   */
  profile(username: string) {
    return this.request<LoPersonPage>(`/api/users/${encodeURIComponent(username)}`);
  }

  /**
   * The inbox: who has written, and the last line of each exchange. Reading this
   * marks nothing read — only opening one conversation does that, which is the
   * request below — so the page that lists who is waiting can be drawn without
   * answering for the reader.
   */
  messages() {
    return this.request<{ conversations: LoThread[]; unread: number }>("/api/messages");
  }

  /**
   * One exchange, both directions — and, which is what the glasses ask for it,
   * the fact that asking is what marks it read. There is no endpoint that does
   * only the marking and none is wanted: lo has never had a button for this,
   * because a conversation somebody has been shown is one they have seen, and a
   * screen that made them press something afterwards would be asking them to file
   * their own post (see lo/server/index.js).
   *
   * So the glasses say the same thing the sheet on the phone says, in the same
   * words: this letter has been in front of somebody. What decides that up here
   * is three seconds of not moving on (see main.ts) — the wheel walks a list of
   * letters a flick at a time, and a letter the reader passed through is not one
   * they read.
   *
   * The lines come back with it and the glasses use none of them. The screen that
   * reads a letter up here shows the last thing said rather than the exchange it
   * came out of, which is what the inbox already handed over; what is taken off
   * this answer is the count, already counted down by the reading, so the badge in
   * the corner goes out in the same breath.
   */
  conversation(username: string) {
    // The correspondent comes back as a name and a picture rather than as an
    // account — lo answers `{ username, avatar }` here, and there is no id in it.
    // Written out as what it is rather than borrowed from `LoUser`, which has an
    // id and no picture and is a different answer to a different question.
    return this.request<{
      user: { username: string; avatar?: string | null };
      messages: LoMessage[];
      unread: number;
    }>(`/api/messages/${encodeURIComponent(username)}`);
  }

  /**
   * The answer, said rather than typed. lo's own reply is a line in a sheet with a
   * keyboard under it; this is the same endpoint reached from a screen that has
   * neither, so the words are a dictation and the sending is a tap.
   *
   * It is the one write in this file addressed to a person rather than to a place,
   * and the only one with no fix in it: a letter is filed under whoever it is to,
   * and where the writer was standing when they said it is nobody's business.
   */
  reply(username: string, body: string) {
    return this.request<{ message: LoMessage }>(`/api/messages/${encodeURIComponent(username)}`, {
      method: "POST",
      body: JSON.stringify({ body: messageBody(body) }),
    });
  }

  /**
   * Telling the server where we are and asking who else is out, which is one
   * question a minute apart rather than two — the same trade the website makes.
   * The unread figure rides along because the same read already knows it.
   */
  publishPosition({ latitude, longitude, accuracy }: Coordinates) {
    return this.request<{ people: LoPerson[]; unread: number }>("/api/position", {
      method: "PUT",
      body: JSON.stringify({ latitude, longitude, accuracy }),
    });
  }

  /* ----------------------------------------------------------------- the verb */

  /**
   * Save this spot, with a name on it where the reader spoke one. The label is
   * what a hold on the touchpad turns into: the glasses record, the transcript
   * comes back, and it goes on the mark as the thing that spot was — which is the
   * one field lo lets a mark carry beyond its coordinates.
   *
   * A mark is nobody's but its author's. That is the whole of what separates it
   * from the post below, and it is why the screen between the dictation and the
   * save exists at all (see pages/compose.ts).
   */
  createMark(coords: Coordinates, label = "") {
    return this.request<{ mark: Record<string, unknown> }>(`/api/marks?lang=${this.language}`, {
      method: "POST",
      body: JSON.stringify({ ...coords, label: markLabel(label), time: new Date().toISOString() }),
    });
  }

  /**
   * Leave what was said on the ground here for whoever comes past — which is the
   * other thing a dictation can be, and the public one. lo's own posts carry a
   * picture as well; there is no camera in this and no way to choose a file, so
   * what the glasses write is the words alone.
   *
   * The place it is filed under is looked up by the server rather than sent from
   * here, exactly as a mark's is, so a post reads the same however it was made.
   */
  createPost(coords: Coordinates, body: string) {
    return this.request<{ post: LoPost }>(`/api/posts?lang=${this.language}`, {
      method: "POST",
      body: JSON.stringify({ ...coords, body: postBody(body), time: new Date().toISOString() }),
    });
  }
}
