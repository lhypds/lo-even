import { ApiError, type Language } from "./api";
import type { LoCard, LoUser } from "./types";
import { trackVisualViewport } from "./viewport";
import "./styles.css";

const SITE_URL = "https://lo.gcc3.com";

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

// lo's own words, from lo/src/i18n. Copied rather than fetched: this screen has
// to be up before anything has been asked of lo, and a tagline that arrives a
// moment after the wordmark would give away that these are two screens.
const COPY: Record<Language, Record<string, string>> = {
  en: {
    tagline: "Where you are, right now.",
    username: "Username",
    password: "Password",
    next: "Next",
    login: "Go",
    back: "Back",
    forgot: "Forgotten?",
    usernameNoLetter: "A username needs at least one letter",
    passwordRequired: "Please enter a password",
    passwordWrong: "Wrong password",
    passwordRule: `A password is ${PASSWORD_MIN}–${PASSWORD_MAX} characters`,
    failed: "Could not sign in. Try again.",
    forgotTitle: "Forgotten password",
    forgotBody:
      "lo cannot send a new one out. Write to the administrator at {{email}}, say which account is yours, and they will set one.",
    forgotNoAdmin: "No administrator address is set. Add VITE_ADMIN_EMAIL to .env.",
    forgotSend: "Write to them",
    forgotSubject: "lo — forgotten password for {{name}}",
    forgotMail: "My lo account is {{name}}. I have forgotten my password — please set a new one for me.",
    cancel: "Cancel",
  },
  ja: {
    tagline: "いま、あなたのいる場所。",
    username: "ユーザー名",
    password: "パスワード",
    next: "次へ",
    login: "開始",
    back: "戻る",
    forgot: "お忘れの方",
    usernameNoLetter: "ユーザー名には文字を 1 つ以上含めてください",
    passwordRequired: "パスワードを入力してください",
    passwordWrong: "パスワードが違います",
    passwordRule: `パスワードは ${PASSWORD_MIN}–${PASSWORD_MAX} 文字です`,
    failed: "サインインできませんでした。もう一度お試しください。",
    forgotTitle: "パスワードを忘れた",
    forgotBody:
      "lo から新しいパスワードを送ることはできません。管理者 {{email}} にアカウント名を添えてメールを送ると、新しいパスワードを設定してもらえます。",
    forgotNoAdmin: "管理者のメールアドレスが未設定です。.env に VITE_ADMIN_EMAIL を設定してください。",
    forgotSend: "メールを書く",
    forgotSubject: "lo — {{name}} のパスワード再設定",
    forgotMail: "lo のアカウントは {{name}} です。パスワードを忘れたので、新しく設定してください。",
    cancel: "キャンセル",
  },
  zh: {
    tagline: "此刻，你在哪里。",
    username: "用户名",
    password: "密码",
    next: "下一步",
    login: "进入",
    back: "返回",
    forgot: "忘记密码？",
    usernameNoLetter: "用户名需包含至少一个字母",
    passwordRequired: "请输入密码",
    passwordWrong: "密码错误",
    passwordRule: `密码为 ${PASSWORD_MIN}–${PASSWORD_MAX} 个字符`,
    failed: "无法登录，请重试。",
    forgotTitle: "忘记密码",
    forgotBody: "lo 无法发送新密码。写信给管理员 {{email}}，说明是哪个账号，由管理员为你重设。",
    forgotNoAdmin: "尚未设置管理员邮箱，请在 .env 中设置 VITE_ADMIN_EMAIL。",
    forgotSend: "写信",
    forgotSubject: "lo — {{name}} 忘记密码",
    forgotMail: "我的 lo 账号是 {{name}}，忘记了密码，请帮我重设。",
    cancel: "取消",
  },
};

// lo's own three, in lo's own order, under lo's own two-letter labels.
const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "en", label: "EN" },
  { code: "zh", label: "ZH" },
  { code: "ja", label: "JA" },
];

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export interface WebUIActions {
  onLogin(username: string, password: string): Promise<void>;
  onLogout(): Promise<void>;
  onRefresh(): void;
  onSelect(index: number): void;
  onLanguage(language: Language): void;
}

export interface WebUI {
  setUser(user: LoUser | null): void;
  setKey(key: string): void;
  showLogin(error?: unknown): void;
  hideLogin(): void;
  setLoginBusy(busy: boolean): void;
  render(cards: LoCard[], activeIndex: number, status: string): void;
}

// The phone view is the website itself. Nothing on this side draws lo any more;
// the outer frame exists only to hold the Even bridge and feed the glasses, so
// the two WebUI calls that used to paint the phone are now no-ops.
//
// What the outer frame still has to do is get a credential, because a WebView on
// an Even Hub origin can never be handed lo's cookie. The screen below asks for
// the password once and trades it for the account's link key, and that one key
// then serves both sides: `?k=` carries it into the WebView, where lo signs
// itself in the way any followed link does, and the same key buys the outer
// frame its own bearer token so the dashboard API can go on feeding the glasses.
//
// It asks in lo's own screen — the two steps, the 90px button, the switcher in
// the corner, the line of type under the field with the two ways out of the
// password step in it — because the reader is not meant to know there are two
// screens here. This one signs in; the frame behind it comes up already signed
// in; nothing in between announces a change of address. The one thing it cannot
// do is open an account, the outer frame having no endpoint for that, so a name
// nobody is using comes back as an error on the name step rather than as an offer
// to create it.
export function createWebUI(actions: WebUIActions, initialLanguage: Language = "en"): WebUI {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("#app element not found");

  // Before the frame is written, so its first layout is already the right size.
  trackVisualViewport();

  let language: Language = COPY[initialLanguage] ? initialLanguage : "en";
  let copy = COPY[language];

  // The frame starts blank on purpose. Pointed at the site before a key exists,
  // it would draw lo's own login screen behind this one — the same screen twice,
  // only one of which the glasses can hear about.
  root.innerHTML = `
    <iframe
      class="frame"
      data-frame
      title="lo"
      allow="geolocation; microphone"
      hidden
    ></iframe>

    <main class="auth-page" data-login-page>
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
      <div class="sheet-overlay" data-forgot-sheet>
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
          <div class="sheet__head">
            <span class="sheet__title" id="forgot-title" data-forgot-title></span>
            <button type="button" class="sheet__close" data-forgot-close aria-label="Close">✕</button>
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
    </main>

  `;

  const frame = root.querySelector<HTMLIFrameElement>("[data-frame]")!;
  const page = root.querySelector<HTMLElement>("[data-login-page]")!;
  const lang = root.querySelector<HTMLSpanElement>("[data-lang]")!;
  const langTrigger = root.querySelector<HTMLButtonElement>("[data-lang-trigger]")!;
  const langOptions = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-lang-option]"));
  const tagline = root.querySelector<HTMLParagraphElement>("[data-tagline]")!;
  const form = root.querySelector<HTMLFormElement>("[data-login-form]")!;
  const label = root.querySelector<HTMLLabelElement>("[data-login-label]")!;
  const input = root.querySelector<HTMLInputElement>("[data-login-input]")!;
  const submit = root.querySelector<HTMLButtonElement>("[data-login-submit]")!;
  const message = root.querySelector<HTMLSpanElement>("[data-login-message]")!;
  const space = root.querySelector<HTMLSpanElement>("[data-login-space]")!;
  const forgot = root.querySelector<HTMLButtonElement>("[data-login-forgot]")!;
  const gap = root.querySelector<HTMLSpanElement>("[data-login-gap]")!;
  const back = root.querySelector<HTMLButtonElement>("[data-login-back]")!;
  const sheet = root.querySelector<HTMLDivElement>("[data-forgot-sheet]")!;
  const sheetTitle = root.querySelector<HTMLSpanElement>("[data-forgot-title]")!;
  const sheetBody = root.querySelector<HTMLParagraphElement>("[data-forgot-body]")!;
  const sheetCancel = root.querySelector<HTMLButtonElement>("[data-forgot-cancel]")!;
  const sheetSend = root.querySelector<HTMLAnchorElement>("[data-forgot-send]")!;
  const sheetClose = root.querySelector<HTMLButtonElement>("[data-forgot-close]")!;

  let step: Step = "name";
  let username = "";
  let busy = false;
  // What the line under the field is saying, and — where this screen owns the
  // words rather than the server — which of its own words it said. The key is
  // what lets the line be said again in another language without asking the
  // server a second time; a sentence that came from the server has no key and
  // stands as it came.
  let messageText = "";
  let messageKey = "";

  function setMessage(text: string, key = "") {
    messageText = text;
    messageKey = key;
    message.textContent = text;
    // lo's rule for the space in front of the ways out of the step: a sentence
    // brings its own separation — the stop is the space — but a line like
    // "密码错误" ends in a character that would otherwise run straight into the
    // word after it, and where there are no words there is nothing to separate.
    const spaced = Boolean(text) && !/[.。!！?？]$/.test(text);
    space.textContent = step === "password" && spaced ? SPACE : "";
  }

  // Everything the current language has a say in, said again. Values are left
  // alone: this runs on a language change too, and a half-typed password is not
  // something a press on ZH should cost.
  function paintCopy() {
    const naming = step === "name";
    tagline.textContent = copy.tagline;
    label.textContent = naming ? copy.username : copy.password;
    input.placeholder = naming ? copy.username : copy.password;
    submit.textContent = naming ? copy.next : copy.login;
    forgot.textContent = copy.forgot;
    back.textContent = copy.back;
    langTrigger.textContent = LANGUAGES.find(({ code }) => code === language)?.label ?? "EN";
    for (const option of langOptions) {
      option.classList.toggle("lang-option--active", option.dataset.langOption === language);
    }
    sheetTitle.textContent = copy.forgotTitle;
    sheetBody.textContent = ADMIN_EMAIL ? fill(copy.forgotBody, { email: ADMIN_EMAIL }) : copy.forgotNoAdmin;
    sheetCancel.textContent = copy.cancel;
    sheetSend.textContent = copy.forgotSend;
    // The one action at the foot of this sheet that is not a press: an address
    // the reader's own mail app opens, with the account already named in it.
    sheetSend.hidden = !ADMIN_EMAIL;
    sheetSend.href = ADMIN_EMAIL
      ? `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(
          fill(copy.forgotSubject, { name: username }),
        )}&body=${encodeURIComponent(fill(copy.forgotMail, { name: username }))}`
      : "";
    setMessage(messageKey ? copy[messageKey] : messageText, messageKey);
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
    // to, and a password not yet asked for is not one to have forgotten.
    forgot.hidden = naming;
    back.hidden = naming;
    gap.textContent = naming ? "" : SPACE;
    messageText = "";
    messageKey = "";
    paintCopy();
  }

  function setLanguage(next: Language) {
    if (!COPY[next] || next === language) return;
    language = next;
    copy = COPY[next];
    // Which language the type is in, not only which words are in it: iOS draws a
    // shared han character one way for zh and another for ja, and the page saying
    // so is the only way it knows which of the two it is reading.
    document.documentElement.lang = next;
    paintCopy();
    actions.onLanguage(next);
  }

  function setSheetOpen(open: boolean) {
    sheet.classList.toggle("sheet-overlay--open", open);
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
      username = name;
      setStep("password");
      // Synchronously, inside the press that asked for it: it is the only way a
      // WebView keeps the keyboard up across the step, and a keyboard that drops
      // and comes back is the whole of what the second screen would feel like.
      input.focus();
      return;
    }

    if (!input.value) {
      setMessage(copy.passwordRequired, "passwordRequired");
      return;
    }
    await actions.onLogin(username, input.value);
  });

  forgot.addEventListener("click", () => {
    if (busy) return;
    setSheetOpen(true);
  });

  back.addEventListener("click", () => {
    if (busy) return;
    setStep("name");
  });

  sheetClose.addEventListener("click", () => setSheetOpen(false));
  sheetCancel.addEventListener("click", () => setSheetOpen(false));
  sheetSend.addEventListener("click", () => setSheetOpen(false));
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) setSheetOpen(false);
  });

  for (const eventName of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
  }

  // Whatever the server said, in the reader's own language where the answer is
  // one to act on, and with the key that lets it be said again if the language
  // changes under it. The plain message is the fallback rather than the rule.
  function nameError(error: ApiError): [string, string] {
    if (error.code === "USERNAME_NO_LETTER") return [copy.usernameNoLetter, "usernameNoLetter"];
    return [error.message, ""];
  }

  function passwordError(error: ApiError): [string, string] {
    if (error.code === "PASSWORD_WRONG") return [copy.passwordWrong, "passwordWrong"];
    if (error.code === "PASSWORD_INVALID") return [copy.passwordRule, "passwordRule"];
    return [error.message, ""];
  }

  document.documentElement.lang = language;
  setStep("name");

  return {
    setUser() {},
    setKey(key) {
      // Two things this compare is careful about. It reads the attribute we last
      // set rather than wherever the site has navigated since, because lo strips
      // `?k=` out of its own address bar the moment it has spent it and writing
      // the same src back over that would be a sign-out dressed as a refresh.
      // And it goes to about:blank on the way out rather than dropping the src,
      // because signing out has to actually navigate the site away — otherwise
      // the session it is still holding carries on behind a hidden element.
      const next = key ? `${SITE_URL}/?k=${encodeURIComponent(key)}` : "about:blank";
      if (frame.getAttribute("src") !== next) frame.setAttribute("src", next);
      frame.hidden = !key;
    },
    showLogin(error) {
      page.classList.add("auth-page--open");
      if (error === undefined) return;
      if (!(error instanceof ApiError)) {
        setMessage(copy.failed, "failed");
        return;
      }
      // The two answers that are about the name rather than the password. Neither
      // is anything the password field can be used to fix, so the name comes back
      // up — and for this frame USER_NOT_FOUND is the end of it, since opening the
      // account is lo's own screen's to offer and not this one's.
      if (error.code === "USER_NOT_FOUND" || error.code === "USER_EXISTS") {
        setStep("name");
        setMessage(...nameError(error));
        return;
      }
      setMessage(...passwordError(error));
    },
    hideLogin() {
      page.classList.remove("auth-page--open");
      setSheetOpen(false);
      lang.dataset.open = "false";
      username = "";
      setStep("name");
    },
    setLoginBusy(nextBusy) {
      // Disabled, not relabelled: lo's button says the same word throughout, and
      // greys out (see .auth-page button:disabled) while the server is waited on.
      busy = nextBusy;
      submit.disabled = nextBusy;
      forgot.disabled = nextBusy;
      back.disabled = nextBusy;
    },
    render() {},
  };
}
