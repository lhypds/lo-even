import { LANGUAGES, isLanguage, translator, type Language, type Translate } from "../i18n";
import { ApiError } from "../services/api";

// Where the administrator's word can be had, and the whole of what either screen
// can do about a forgotten password: there is no reset link, because there is no
// address on file to send one to. The same variable lo reads, so the two screens
// name the same person.
const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL ?? "").trim();

// The three lengths lo's own sign-in screen is drawn to. The server holds the
// same three and is the one that enforces them; these are here so this screen
// can say so in the same words, before it asks.
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 64;
const USERNAME_MAX = 32;

// An en space, and for lo's reason: the words at the end of the message line are
// underlined, and a single word space between two underlined words reads as one
// underline with a nick in it rather than as two words.
const SPACE = "\u2002";

type Step = "name" | "password";

export interface LoginActions {
  /**
   * Whether this name is an account at all, and — where it is — whether it has a
   * password yet: the question the first step is there to ask, and the whole of
   * what it does. Throwing `USER_NOT_FOUND` is the offer to open it; anything
   * else that throws is what the line under the field is for (see
   * `POST /api/username` in services/api.ts).
   */
  onCheckUsername(username: string): Promise<{ hasPassword: boolean }>;
  onSubmit(username: string, password: string): Promise<void>;
  /**
   * The same press on an account that does not exist yet: the name and the
   * password it is being opened with. Separate from `onSubmit` because they are
   * two endpoints and two different things to have done to somebody's account,
   * and the screen knows which of them it asked for.
   */
  onCreate(username: string, password: string): Promise<void>;
  onLanguage(language: Language): void;
}

export interface LoginScreen {
  show(error?: unknown): void;
  hide(): void;
  setBusy(busy: boolean): void;
  /**
   * Say this screen again in another language, for a choice made somewhere other
   * than the switcher in its own corner — the site in the frame has one too, and
   * a reader who uses that one is choosing for all of it. It does not call back
   * through `onLanguage`: whoever is telling this screen has already told the
   * rest of the app (see webui.ts).
   */
  setLanguage(language: Language): void;
}

// lo's own sign-in screen, drawn on this side of the frame — the two steps, the
// 90px button, the switcher in the corner, the line of type under the field with
// the two ways out of the password step in it — because the reader is not meant
// to know there are two screens here. This one signs in; the frame behind it
// comes up already signed in; nothing in between announces a change of address.
// (What it is signing into, and why the frame cannot ask for itself, is in
// webui.ts, which owns the frame.)
//
// It opens accounts as well, and in lo's own words: a name nobody is using comes
// back from the name step as an offer to create it — a sheet naming the name, a
// cancel and a create — and answering yes carries on to the same password step
// everybody else signs in through, where the password given is the one the
// account is opened with. A new name is at least as often a mistyped one, which
// is why it is offered rather than assumed (see lo/src/pages/AuthPage).
export function createLogin(
  root: HTMLElement,
  actions: LoginActions,
  initialLanguage: Language = "en",
): LoginScreen {
  let language: Language = isLanguage(initialLanguage) ? initialLanguage : "en";
  let t: Translate = translator(language);

  const page = document.createElement("main");
  page.className = "auth-page";
  page.innerHTML = `
    <span class="auth-lang" data-lang data-open="false">
      <button type="button" class="lang-trigger" data-lang-trigger></button>
      <span class="lang-dropdown">
        ${LANGUAGES.map(
          ({ code, label }) =>
            `<button type="button" class="lang-option" data-lang-option="${code}">${label}</button>`,
        ).join("")}
      </span>
    </span>

    <section class="auth-card" aria-labelledby="login-title">
      <h1 id="login-title" class="auth-logo">lo</h1>
      <p class="tagline" data-tagline></p>

      <form class="login-form" data-login-form autocomplete="off">
        <label class="sr-only" data-login-label for="lo-handle"></label>
        <div class="joined-field">
          <input
            data-login-input
            id="lo-handle"
            name="lo-handle"
            autocapitalize="none"
            autocorrect="off"
            autocomplete="off"
            enterkeyhint="next"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
          />
          <button type="submit" data-login-submit></button>
        </div>
      </form>

      <p class="form-message">
        <span data-login-message></span><span data-login-space></span
        ><button type="button" class="auth-forgot" data-login-forgot hidden></button
        ><span data-login-gap></span
        ><button type="button" class="auth-back" data-login-back hidden></button>
      </p>
    </section>

    <div class="sheet-overlay" data-create-sheet>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div class="sheet__head">
          <span class="sheet__title" id="create-title" data-create-title></span>
          <button type="button" class="sheet__close" data-create-close aria-label="${t("common.close")}">✕</button>
        </div>
        <div class="sheet__content">
          <p class="modal-text" data-create-body></p>
          <div class="modal-actions">
            <button type="button" class="outline-button" data-create-cancel></button>
            <button type="button" class="primary-button" data-create-confirm></button>
          </div>
        </div>
      </div>
    </div>

    <div class="sheet-overlay" data-forgot-sheet>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
        <div class="sheet__head">
          <span class="sheet__title" id="forgot-title" data-forgot-title></span>
          <button type="button" class="sheet__close" data-forgot-close aria-label="${t("common.close")}">✕</button>
        </div>
        <div class="sheet__content">
          <p class="modal-text" data-forgot-body></p>
          <div class="modal-actions">
            <button type="button" class="outline-button" data-forgot-cancel></button>
            <a class="primary-button" data-forgot-send hidden></a>
          </div>
        </div>
      </div>
    </div>
  `;
  root.append(page);

  const lang = page.querySelector<HTMLSpanElement>("[data-lang]")!;
  const langTrigger = page.querySelector<HTMLButtonElement>("[data-lang-trigger]")!;
  const langOptions = Array.from(page.querySelectorAll<HTMLButtonElement>("[data-lang-option]"));
  const tagline = page.querySelector<HTMLParagraphElement>("[data-tagline]")!;
  const form = page.querySelector<HTMLFormElement>("[data-login-form]")!;
  const label = page.querySelector<HTMLLabelElement>("[data-login-label]")!;
  const input = page.querySelector<HTMLInputElement>("[data-login-input]")!;
  const submit = page.querySelector<HTMLButtonElement>("[data-login-submit]")!;
  const message = page.querySelector<HTMLSpanElement>("[data-login-message]")!;
  const space = page.querySelector<HTMLSpanElement>("[data-login-space]")!;
  const forgot = page.querySelector<HTMLButtonElement>("[data-login-forgot]")!;
  const gap = page.querySelector<HTMLSpanElement>("[data-login-gap]")!;
  const back = page.querySelector<HTMLButtonElement>("[data-login-back]")!;
  const createSheet = page.querySelector<HTMLDivElement>("[data-create-sheet]")!;
  const createTitle = page.querySelector<HTMLSpanElement>("[data-create-title]")!;
  const createBody = page.querySelector<HTMLParagraphElement>("[data-create-body]")!;
  const createCancel = page.querySelector<HTMLButtonElement>("[data-create-cancel]")!;
  const createConfirm = page.querySelector<HTMLButtonElement>("[data-create-confirm]")!;
  const createClose = page.querySelector<HTMLButtonElement>("[data-create-close]")!;
  const sheet = page.querySelector<HTMLDivElement>("[data-forgot-sheet]")!;
  const sheetTitle = page.querySelector<HTMLSpanElement>("[data-forgot-title]")!;
  const sheetBody = page.querySelector<HTMLParagraphElement>("[data-forgot-body]")!;
  const sheetCancel = page.querySelector<HTMLButtonElement>("[data-forgot-cancel]")!;
  const sheetSend = page.querySelector<HTMLAnchorElement>("[data-forgot-send]")!;
  const sheetClose = page.querySelector<HTMLButtonElement>("[data-forgot-close]")!;

  let step: Step = "name";
  let username = "";
  let busy = false;
  // Whether the password step is asking for a password or having one chosen, and
  // whether the account behind it has still to be opened — lo's own two flags, in
  // lo's own order (see AuthPage.jsx). They are not the same question: an account
  // opened before there were passwords is one whose password the next sign-in
  // chooses rather than checks, so it is choosing without being opened.
  let choosing = false;
  let opening = false;
  // The name the sheet is asking about, which is a name nobody is using yet and is
  // not this screen's `username` until the reader has said to open it. Empty
  // whenever that sheet is shut.
  let pending = "";
  // What the line under the field is saying, and — where this screen owns the
  // words rather than the server — which of its own words it said. The key is
  // what lets the line be said again in another language without asking the
  // server a second time; a sentence that came from the server has no key and
  // stands as it came.
  let messageText = "";
  let messageKey = "";
  const passwordVars = { min: PASSWORD_MIN, max: PASSWORD_MAX };

  function setMessage(text: string, key = "") {
    messageText = text;
    messageKey = key;
    message.textContent = text;
    // The space in front of the ways out of the step, wherever there are words for
    // it to come after. Where there are none there is nothing to separate.
    //
    // lo holds this one back after a full stop, on the grounds that a sentence
    // brings its own separation. A stop is not a space, though, and what it
    // actually draws is "…4+ characters.Back" — the words of the line running
    // straight into the underlined word after them. So this screen departs from
    // lo's by one character, and puts the same en space in front of the pair
    // however the line before it ended.
    space.textContent = step === "password" && text ? SPACE : "";
  }

  // Everything the current language has a say in, said again. Values are left
  // alone: this runs on a language change too, and a half-typed password is not
  // something a press on ZH should cost.
  function paintCopy() {
    const naming = step === "name";
    tagline.textContent = t("auth.tagline");
    label.textContent = naming ? t("auth.username") : t("auth.password");
    input.placeholder = naming ? t("auth.username") : t("auth.password");
    submit.textContent = naming ? t("auth.next") : t("auth.login");
    forgot.textContent = t("auth.forgot");
    back.textContent = t("auth.back");
    langTrigger.textContent = LANGUAGES.find(({ code }) => code === language)?.label ?? "EN";
    for (const option of langOptions) {
      option.classList.toggle("lang-option--active", option.dataset.langOption === language);
    }
    createTitle.textContent = t("auth.createTitle");
    // Named in the question, because the whole of what is being confirmed is
    // which name it is: a reader who has been offered this has almost as often
    // mistyped one as reached for a new one.
    createBody.textContent = t("auth.createConfirm", { name: pending });
    createCancel.textContent = t("auth.cancel");
    createConfirm.textContent = t("auth.create");
    createClose.ariaLabel = t("common.close");
    sheetTitle.textContent = t("auth.forgotTitle");
    sheetBody.textContent = ADMIN_EMAIL
      ? t("auth.forgotBody", { email: ADMIN_EMAIL })
      : t("auth.forgotNoAdmin");
    sheetCancel.textContent = t("auth.cancel");
    sheetSend.textContent = t("auth.forgotSend");
    sheetClose.ariaLabel = t("common.close");
    // The one action at the foot of this sheet that is not a press: an address
    // the reader's own mail app opens, with the account already named in it.
    sheetSend.hidden = !ADMIN_EMAIL;
    sheetSend.href = ADMIN_EMAIL
      ? `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(
          t("auth.forgotSubject", { name: username }),
        )}&body=${encodeURIComponent(t("auth.forgotMail", { name: username }))}`
      : "";
    setMessage(messageKey ? t(messageKey, passwordVars) : messageText, messageKey);
  }

  // One field, dressed for whichever step is up. lo swaps two of them because it
  // has React to keep them apart; either way the wordmark and the line under it
  // do not move, and what changes between the steps is the field.
  function setStep(next: Step) {
    step = next;
    const naming = next === "name";
    const id = naming ? "lo-handle" : "lo-password";
    label.htmlFor = id;
    input.id = id;
    input.name = id;
    input.type = naming ? "text" : "password";
    input.maxLength = naming ? USERNAME_MAX : PASSWORD_MAX;
    input.enterKeyHint = naming ? "next" : "go";
    input.value = naming ? username : "";
    // Neither way out is on the first screen: the name is what back would go back
    // to, and a password not yet asked for is not one to have forgotten. Nor is
    // the forgotten one offered while a password is being chosen this minute,
    // which leaves that line with back on the end of it alone — and the space
    // that separated the pair goes with it.
    forgot.hidden = naming || choosing;
    back.hidden = naming;
    gap.textContent = naming || choosing ? "" : SPACE;
    // What the line says when there is nothing wrong: what a password is being
    // asked to *be*, where it is being chosen. Nothing where the password asked
    // for is one the reader already has — the field says "password", the two ways
    // out of the step are on that line, and a sentence between them saying so
    // again is a sentence nobody reads.
    messageText = !naming && choosing ? t("auth.passwordChooseHint", passwordVars) : "";
    messageKey = !naming && choosing ? "auth.passwordChooseHint" : "";
    paintCopy();
  }

  // The name step, with whatever the password step was doing put back. Both ways
  // out of that step come through here — the reader pressing back, and the two
  // answers from the server that are about the name rather than the password.
  function toName() {
    choosing = false;
    opening = false;
    setStep("name");
  }

  // This screen alone, said again in `next`. Answers whether anything changed,
  // so that the switcher below tells the rest of the app only when there is
  // something to tell it.
  function applyLanguage(next: Language): boolean {
    if (!isLanguage(next) || next === language) return false;
    language = next;
    t = translator(next);
    // Which language the type is in, not only which words are in it: iOS draws a
    // shared han character one way for zh and another for ja, and the page saying
    // so is the only way it knows which of the two it is reading.
    document.documentElement.lang = next;
    paintCopy();
    return true;
  }

  // The switcher in the corner of this screen: the choice was made here, so the
  // rest of the app hears about it from here.
  function setLanguage(next: Language) {
    if (applyLanguage(next)) actions.onLanguage(next);
  }

  // Either of the two sheets this screen can put up: the offer to open an account
  // and the word about a forgotten password. Never both — one is reached from the
  // name step and the other from the password step.
  function setSheetOpen(which: HTMLElement, open: boolean) {
    which.classList.toggle("sheet-overlay--open", open);
  }

  // Disabled, not relabelled: lo's button says the same word throughout, and
  // greys out (see .auth-page button:disabled) while the server is waited on.
  // Both steps wait on one now — the name is asked about before it is accepted —
  // so this is a function of its own rather than only the screen's own method.
  //
  // The field is left alone on purpose. Disabling it would take the focus off it
  // and the keyboard down with it, for a request that is usually one round trip
  // long, and the reader would watch the screen shut itself for a moment in the
  // middle of signing in.
  function setBusy(next: boolean) {
    busy = next;
    submit.disabled = next;
    forgot.disabled = next;
    back.disabled = next;
  }

  langTrigger.addEventListener("click", () => {
    lang.dataset.open = lang.dataset.open === "true" ? "false" : "true";
  });

  for (const option of langOptions) {
    option.addEventListener("click", () => {
      lang.dataset.open = "false";
      setLanguage(option.dataset.langOption as Language);
    });
  }

  // A press anywhere else puts the list away. Pointerdown rather than click, so
  // the list is gone by the time the press it was in the way of lands.
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && lang.contains(event.target)) return;
    lang.dataset.open = "false";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    if (step === "name") {
      const name = input.value.trim().normalize("NFKC").toLowerCase();
      // An empty field is nothing to answer: the field says what it is for, and
      // being told to type a name into the box that says "username" is a line of
      // type in exchange for a press that plainly did nothing.
      if (!name) return;
      // Synchronously, inside the press that asked for it, and then held for as
      // long as the question takes: it is the only way a WebView keeps the
      // keyboard up across the step, and a keyboard that drops and comes back is
      // the whole of what the second screen would feel like. The press itself
      // takes the focus off the field, so this is putting it back before
      // anything is awaited — after the await there is no press left to focus
      // inside of, and the field has to have never stopped being the focused one.
      input.focus();
      setBusy(true);
      setMessage("");
      // Whether this is an account, asked before the password screen goes up.
      // A mistyped name is the commonest thing wrong with a sign-in, and a
      // screen that took it and then asked for a password is one that answers
      // the wrong question: what comes back is "wrong password" for a password
      // that was never the problem, on a field the reader cannot fix it from.
      //
      // It is also what decides which password step this is. An account with no
      // password yet — one opened before there were passwords — is not being
      // asked to prove one, it is choosing one, and the line under the field says
      // so (see `POST /api/login` in lo/server/index.js).
      try {
        const { hasPassword } = await actions.onCheckUsername(name);
        username = name;
        choosing = !hasPassword;
        opening = false;
      } catch (error) {
        // A name nobody has used is an account waiting to be opened — and just as
        // often a mistyped one, so it is offered rather than assumed. Nothing is
        // taken as the name until the reader has answered that sheet.
        if (error instanceof ApiError && error.code === "USER_NOT_FOUND") {
          pending = name;
          paintCopy();
          setSheetOpen(createSheet, true);
        } else {
          setMessage(...checkError(error));
        }
        return;
      } finally {
        setBusy(false);
      }
      setStep("password");
      input.focus();
      return;
    }

    if (!input.value) {
      setMessage(t("auth.passwordRequired"), "auth.passwordRequired");
      return;
    }
    // The same field, the same press, and two endpoints behind it: one opens the
    // account with the password in it, the other proves the password against the
    // account that is already there.
    await (opening ? actions.onCreate(username, input.value) : actions.onSubmit(username, input.value));
  });

  // Confirming a new name does not open the account: it carries on to the screen
  // that asks for the password it will be opened with, which is the same screen
  // everybody else signs in through. The account is opened by that press, so a
  // reader who gets this far and changes their mind has left nothing behind.
  createConfirm.addEventListener("click", () => {
    if (busy) return;
    username = pending;
    pending = "";
    choosing = true;
    opening = true;
    setSheetOpen(createSheet, false);
    setStep("password");
    // Inside the press, like the step before it: this is the one that puts the
    // keyboard up for the password (see the name step above).
    input.focus();
  });

  // And every way of saying no to it, which leaves the name standing in the field
  // for a reader who mistyped it and is about to fix a letter of it.
  function cancelCreate() {
    pending = "";
    setSheetOpen(createSheet, false);
  }

  createClose.addEventListener("click", cancelCreate);
  createCancel.addEventListener("click", cancelCreate);
  createSheet.addEventListener("click", (event) => {
    if (event.target === createSheet) cancelCreate();
  });

  forgot.addEventListener("click", () => {
    if (busy) return;
    setSheetOpen(sheet, true);
  });

  back.addEventListener("click", () => {
    if (busy) return;
    toName();
  });

  sheetClose.addEventListener("click", () => setSheetOpen(sheet, false));
  sheetCancel.addEventListener("click", () => setSheetOpen(sheet, false));
  sheetSend.addEventListener("click", () => setSheetOpen(sheet, false));
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) setSheetOpen(sheet, false);
  });

  // Whatever the server said, in the reader's own language where the answer is
  // one to act on, and with the key that lets it be said again if the language
  // changes under it. The plain message is the fallback rather than the rule.
  function nameError(error: ApiError): [string, string] {
    if (error.code === "USERNAME_NO_LETTER") {
      return [t("auth.usernameNoLetter"), "auth.usernameNoLetter"];
    }
    // The two that can only arrive from the password step, where the name has
    // already been answered for once: the account went, or somebody else took the
    // name, in the time between the two screens. On the name step itself the first
    // of them is the offer to open the account rather than a line of type, and the
    // second cannot happen — nothing is being created there.
    if (error.code === "USER_NOT_FOUND") return [t("auth.userNotFound"), "auth.userNotFound"];
    if (error.code === "USER_EXISTS") return [t("auth.userExists"), "auth.userExists"];
    return [error.message, ""];
  }

  // The same, for the step that asks: a name lo would not have, or a lo that
  // could not be reached at all — which is not an answer about the name, and is
  // the one thing the reader can usefully try again.
  function checkError(error: unknown): [string, string] {
    return error instanceof ApiError ? nameError(error) : [t("auth.failed"), "auth.failed"];
  }

  function passwordError(error: ApiError): [string, string] {
    if (error.code === "PASSWORD_WRONG") return [t("auth.passwordWrong"), "auth.passwordWrong"];
    if (error.code === "PASSWORD_INVALID") {
      return [t("auth.passwordRule", passwordVars), "auth.passwordRule"];
    }
    return [error.message, ""];
  }

  document.documentElement.lang = language;
  setStep("name");

  return {
    show(error) {
      page.classList.add("auth-page--open");
      if (error === undefined) return;
      if (!(error instanceof ApiError)) {
        setMessage(t("auth.failed"), "auth.failed");
        return;
      }
      // The two answers that are about the name rather than the password: it was
      // taken, or it went, between the two screens. Neither is anything the
      // password field can be used to fix, so the name comes back up.
      if (error.code === "USER_NOT_FOUND" || error.code === "USER_EXISTS") {
        toName();
        setMessage(...nameError(error));
        return;
      }
      setMessage(...passwordError(error));
    },
    hide() {
      page.classList.remove("auth-page--open");
      setSheetOpen(createSheet, false);
      setSheetOpen(sheet, false);
      lang.dataset.open = "false";
      username = "";
      pending = "";
      toName();
    },
    setBusy(nextBusy) {
      setBusy(nextBusy);
    },
    setLanguage(next) {
      applyLanguage(next);
    },
  };
}
