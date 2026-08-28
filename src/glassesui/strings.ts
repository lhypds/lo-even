// The words the glasses say, in the three languages lo is read in.
//
// Lifted key for key out of lo/src/i18n so that a heading on the glasses is the
// same heading as on the phone — "Nearby posts" is not re-invented here as
// "Posts near you", and 警報・注意報 is what the warnings card is called on both
// screens. Only the keys that actually reach the display are carried over; the
// website's forms, sheets and buttons have nothing to say up here.
//
// Four sets are the glasses' own. `time.*` is the narrow form of a relative time
// — a trail column is nine cells wide, where the phone has a whole line — and
// `glasses.*` is the running commentary along the bottom of the screen, which is
// about this device and so has no counterpart on the website.

export type Language = "en" | "ja" | "zh";

type Dict = Record<string, string>;

const en: Dict = {
  "common.loading": "Loading.",
  "clock.title": "Time",
  "clock.offset": "UTC{{offset}}",
  "weather.today": "Today",
  // The days after this one, which lo's own weather tile lists under the
  // readings and this page had no room for until the lines left over were dealt
  // to it. The first of them is a word rather than a weekday — "Tomorrow" is
  // what a reader thinks, where "Sat" is something they have to work out — and
  // the ones after it are the short weekday, because by then the word would be
  // "the day after tomorrow" and no language says that in ten cells.
  "weather.tomorrow": "Tomorrow",
  "weather.feels": "feels",
  // How much of the day's light is left, written the way the reading beside it
  // is: a word and a figure, no verb. After dark it turns into the other half of
  // the same question — how long until it comes back — which is the one form of
  // it that has to say what it is counting to, because a stretch of hours on a
  // dark evening could be either.
  "weather.daylight": "light {{span}}",
  "weather.sunrise": "sunrise in {{span}}",
  "weather.title": "Weather",
  "location.title": "Here",
  "posts.title": "Posts",
  "people.title": "People",
  "messages.title": "Messages",
  // The badge in the top right corner, which every screen wears. It is the one
  // word in the app measured before it is chosen: the corner is sized for the
  // widest any language makes it (see theme.ts), so a long one costs the place
  // name on the same line the room it needs. `msg` is what English can say in
  // three narrow letters; the two below say `unread`, which is what the count
  // actually is, in two characters that come to the same width.
  "mail.badge": "msg",
  "messages.empty": "Nothing waiting to be read.",
  // Whoever said it, in front of what they said. Nothing about a line of an
  // exchange says which way it went, and a screen with no bubbles and no left and
  // right has nowhere to put that but in the words — so every message drawn
  // anywhere in this app is a name, a colon and the sentence.
  //
  // The reader's own side is lifted key for key out of lo, which already draws
  // this row in its inbox and calls it `messages.said`; the other side is the
  // glasses' own, because lo's row has a column for the name beside the words and
  // one line is all there is up here.
  //
  // The colon is the ASCII one in all three languages, where lo sets a full-width
  // `：` in the two that would take one. That is not a translation being ignored:
  // a character this face turns out not to carry draws as four pixels of nothing
  // rather than as a box (see metrics.ts), U+FF1A has not been through the probe
  // in docs/Screen.md, and an invisible colon is worse than a narrow one. The
  // clock already writes `14:32` in every language for the same reason. One
  // screenshot would settle it.
  "messages.said": "You: {{body}}",
  "messages.from": "{{name}}: {{body}}",
  // The two things the footer of an open letter says, in the order it says them:
  // that the rest of the exchange is on its way, and then — once it is all there —
  // the verb this screen has that no other screen in the app does (see
  // `letterFoot` in pages/nearby.ts).
  "messages.reading": "Reading the exchange.",
  "messages.reply": "Hold to reply.",
  // What the footer says while one person is open — the same sentence as the
  // letter's above, because it is the same gesture, the same composer and the same
  // endpoint (see pages/person.ts).
  "people.message": "Hold to send a message.",
  // The two follow figures, and lo's own words for them. English is the only one
  // of these three languages with an opinion about a single follower, which is
  // why the singular is a key of its own and the other two dictionaries answer
  // both keys with the one word they have.
  "user.followers": "{{n}} followers",
  "user.follower": "{{n}} follower",
  "user.following": "{{n}} following",
  // The one heading on a profile. The contacts under it need none — a line
  // reading `Email mari@example.com` says which section it is in by saying it —
  // where a post is a sentence with an hour in front of it and nothing about the
  // sentence says it is a post rather than a contact.
  "user.posts": "Recent posts",
  // The ways off lo, named as lo's own profile form names them.
  "profile.email": "Email",
  "profile.website": "Website",
  "profile.line": "LINE",
  "profile.whatsapp": "WhatsApp",
  "profile.wechat": "WeChat",
  "nearby.title": "Nearby",
  "world.title": "Info",
  // What goes between the counts on the two table-of-contents lines. A word of
  // the dictionary rather than a constant in the page, because it is punctuation
  // and punctuation is part of a language: the interpunct wants air around it
  // here, and the Japanese below wants its own mark with none — which is also the
  // only form of it that fits the line it has to go on (see pages/here.ts).
  "tally.join": " · ",
  "world.unavailable": "Nothing lo can read for this country.",
  "warnings.short": "Warnings",
  "location.fix": "Location",
  "people.alone": "Nobody else here.",
  "posts.empty": "No posts around here yet.",
  "news.title": "News",
  "news.local": "Local",
  "news.places": "Around you",
  "news.empty": "Nothing to report around here.",
  "news.unavailable": "Could not reach the news service.",
  "news.loading": "Reading the neighbourhood.",
  "events.title": "Events",
  "events.empty": "Nothing on around here this fortnight.",
  "events.unavailable": "Could not reach the events service.",
  "events.loading": "Looking for what is on.",
  "trends.title": "Trends",
  "trends.empty": "No search trends for here right now.",
  "trends.unavailable": "Could not reach Google Trends.",
  "trends.loading": "Reading Google Trends.",
  "article.reading": "Reading the story.",
  "article.elsewhere": "This one has to be read on the phone.",
  "article.partial": "The rest is on the publisher's own page.",
  "warnings.title": "Warnings",
  "warnings.unavailable": "Could not reach Yahoo! 天気・災害.",
  "mark.saving": "Saving.",
  "mark.saved": "Marked.",
  "post.saving": "Posting.",
  "post.saved": "Posted.",
  "post.failed": "Could not leave this here.",
  "compose.title": "post or mark?",
  "compose.said": "Heard",
  "compose.keep": "Save as",
  "compose.markWho": "only you",
  "compose.postWho": "everyone here",
  "compose.hint": "Roll to choose · tap to keep · twice to drop.",
  "compose.dropped": "Dropped.",
  // The other composer: a dictation said while one letter was open, which is an
  // answer to it rather than anything about the ground. The heading is the whole
  // question, because showing the words back before they go to a named person is
  // the whole of what that screen is for.
  "compose.replyTitle": "send this reply?",
  "compose.sendTo": "Send to",
  "compose.replyHint": "Tap to send · twice to drop.",
  "reply.sending": "Sending.",
  "reply.sent": "Replied.",
  "reply.failed": "Could not send this.",
  "warnings.kind.rain": "Heavy rain",
  "warnings.kind.flood": "Flood",
  "warnings.kind.storm": "Storm",
  "warnings.kind.blizzard": "Snowstorm",
  "warnings.kind.heavySnow": "Heavy snow",
  "warnings.kind.waves": "High waves",
  "warnings.kind.surge": "Storm surge",
  "warnings.kind.gale": "Gale",
  "warnings.kind.galeSnow": "Gale and snow",
  "warnings.kind.thunder": "Thunderstorm",
  "warnings.kind.snowmelt": "Snowmelt",
  "warnings.kind.fog": "Dense fog",
  "warnings.kind.dry": "Dry air",
  "warnings.kind.avalanche": "Avalanche",
  "warnings.kind.lowTemperature": "Low temperature",
  "warnings.kind.frost": "Frost",
  "warnings.kind.icing": "Ice accretion",
  "warnings.kind.snowAccretion": "Snow accretion",
  "warnings.kind.landslide": "Landslide",
  "warnings.kind.tornado": "Tornado",
  "warnings.kind.recordRain": "Record rainfall",
  "warnings.kind.heat": "Heatstroke",
  "direction.point.n": "N",
  "direction.point.ne": "NE",
  "direction.point.e": "E",
  "direction.point.se": "SE",
  "direction.point.s": "S",
  "direction.point.sw": "SW",
  "direction.point.w": "W",
  "direction.point.nw": "NW",
  "weatherCode.0": "Clear sky",
  "weatherCode.1": "Mainly clear",
  "weatherCode.2": "Partly cloudy",
  "weatherCode.3": "Overcast",
  "weatherCode.45": "Fog",
  "weatherCode.48": "Rime fog",
  "weatherCode.51": "Light drizzle",
  "weatherCode.53": "Drizzle",
  "weatherCode.55": "Dense drizzle",
  "weatherCode.56": "Freezing drizzle",
  "weatherCode.57": "Dense freezing drizzle",
  "weatherCode.61": "Light rain",
  "weatherCode.63": "Rain",
  "weatherCode.65": "Heavy rain",
  "weatherCode.66": "Freezing rain",
  "weatherCode.67": "Heavy freezing rain",
  "weatherCode.71": "Light snow",
  "weatherCode.73": "Snow",
  "weatherCode.75": "Heavy snow",
  "weatherCode.77": "Snow grains",
  "weatherCode.80": "Light showers",
  "weatherCode.81": "Showers",
  "weatherCode.82": "Violent showers",
  "weatherCode.85": "Light snow showers",
  "weatherCode.86": "Heavy snow showers",
  "weatherCode.95": "Thunderstorm",
  "weatherCode.96": "Thunderstorm with hail",
  "weatherCode.99": "Severe thunderstorm with hail",
  "weatherCode.unknown": "Unknown",
  "time.now": "just now",
  "time.minutes": "{{n}}m",
  "time.hours": "{{n}}h",
  "time.days": "{{n}}d",
  "glasses.connecting": "Connecting to your phone.",
  // While the session the last launch left behind is being taken up again, which
  // is a sentence the reader sees only where it is about to be replaced by the
  // first page — or by the line under it, where the session had gone.
  "glasses.resuming": "Signing you back in.",
  "glasses.signIn": "Sign in on your phone.",
  "glasses.locating": "Reading your position.",
  "glasses.noFix": "No position yet.",
  "glasses.offline": "lo.gcc3.com is unreachable.",
  "glasses.recording": "Recording — release to stop.",
  "glasses.transcribing": "Transcribing.",
  "glasses.noSpeech": "Nothing heard.",
  // The two ways a dictation can fail before anybody knows what it was going to
  // be. Both used to say the line below, which named a verb the reader had not
  // chosen yet — and which became plainly wrong once a hold on a letter meant
  // "reply". A failure says which step failed; the line below is kept for the one
  // place it is true, which is a mark that would not save (see main.ts).
  "glasses.noMic": "The microphone did not open.",
  "glasses.transcribeFailed": "Speech service unreachable.",
  "glasses.markFailed": "Could not mark this spot.",
  "glasses.empty": "Nothing to show yet.",
  // The one line in this dictionary that is never on the glasses, because it is
  // about the glasses not being there: it is drawn on the phone, over lo's own
  // site, for a launch that came up with a touchpad and no screen (see main.ts).
  "glasses.noScreen": "Nothing is reaching the glasses. Close lo and open it again from the Even App.",
};

const ja: Dict = {
  "common.loading": "読み込み中。",
  "clock.title": "時刻",
  "clock.offset": "UTC{{offset}}",
  "weather.today": "今日",
  "weather.tomorrow": "明日",
  "weather.feels": "体感",
  // 日の出 alone rather than 日の出まで: the line it goes on is the fullest of the
  // three languages' — every reading on it is a figure and a unit — and the まで
  // is two characters the row cannot spare for a claim the units already make.
  "weather.daylight": "日照 {{span}}",
  "weather.sunrise": "日の出 {{span}}",
  "weather.title": "天気",
  "location.title": "現在地",
  "posts.title": "posts",
  "people.title": "近くの人",
  "messages.title": "メッセージ",
  "mail.badge": "未読",
  "messages.empty": "未読のメッセージはありません。",
  "messages.said": "自分: {{body}}",
  "messages.from": "{{name}}: {{body}}",
  "messages.reading": "やり取りを読み込み中。",
  "messages.reply": "長押しで返信。",
  "people.message": "長押しでメッセージ。",
  "user.followers": "フォロワー {{n}}",
  "user.follower": "フォロワー {{n}}",
  "user.following": "フォロー中 {{n}}",
  "user.posts": "最近の posts",
  "profile.email": "メール",
  "profile.website": "ウェブサイト",
  "profile.line": "LINE",
  "profile.whatsapp": "WhatsApp",
  "profile.wechat": "WeChat",
  "nearby.title": "周辺",
  "world.title": "情報",
  "tally.join": "・",
  "world.unavailable": "この国で読めるものはありません。",
  "warnings.short": "警報",
  "location.fix": "位置",
  "people.alone": "近くに他の人はいません。",
  "posts.empty": "近くにまだ post はありません。",
  "news.title": "ニュース",
  "news.local": "地元",
  "news.places": "あなたの周り",
  "news.empty": "この辺りに伝えることはありません。",
  "news.unavailable": "ニュースサービスに接続できません。",
  "news.loading": "周辺を読み込み中。",
  "events.title": "イベント",
  "events.empty": "この2週間、この辺りに開催情報はありません。",
  "events.unavailable": "イベント情報に接続できません。",
  "events.loading": "イベントを探しています。",
  "trends.title": "トレンド",
  "trends.empty": "この地域の検索トレンドは今ありません。",
  "trends.unavailable": "Google トレンドに接続できません。",
  "trends.loading": "Google トレンドを読み込み中。",
  "article.reading": "本文を読み込み中。",
  "article.elsewhere": "この記事はスマートフォンでお読みください。",
  "article.partial": "この続きは配信元のページにあります。",
  "warnings.title": "警報・注意報",
  "warnings.unavailable": "Yahoo!天気・災害に接続できません。",
  "mark.saving": "保存中。",
  "mark.saved": "記録しました。",
  "post.saving": "投稿中。",
  "post.saved": "投稿しました。",
  "post.failed": "ここに残せません。",
  "compose.title": "post か mark か？",
  "compose.said": "聞き取り",
  "compose.keep": "保存先",
  "compose.markWho": "自分だけ",
  "compose.postWho": "ここにいる人",
  "compose.hint": "回して選択 · タップで保存 · 2回で破棄。",
  "compose.dropped": "破棄しました。",
  "compose.replyTitle": "この返信を送る？",
  "compose.sendTo": "宛先",
  "compose.replyHint": "タップで送信 · 2回で破棄。",
  "reply.sending": "送信中。",
  "reply.sent": "返信しました。",
  "reply.failed": "送信できません。",
  "warnings.kind.rain": "大雨",
  "warnings.kind.flood": "洪水",
  "warnings.kind.storm": "暴風",
  "warnings.kind.blizzard": "暴風雪",
  "warnings.kind.heavySnow": "大雪",
  "warnings.kind.waves": "波浪",
  "warnings.kind.surge": "高潮",
  "warnings.kind.gale": "強風",
  "warnings.kind.galeSnow": "風雪",
  "warnings.kind.thunder": "雷",
  "warnings.kind.snowmelt": "融雪",
  "warnings.kind.fog": "濃霧",
  "warnings.kind.dry": "乾燥",
  "warnings.kind.avalanche": "なだれ",
  "warnings.kind.lowTemperature": "低温",
  "warnings.kind.frost": "霜",
  "warnings.kind.icing": "着氷",
  "warnings.kind.snowAccretion": "着雪",
  "warnings.kind.landslide": "土砂災害",
  "warnings.kind.tornado": "竜巻",
  "warnings.kind.recordRain": "記録的短時間大雨",
  "warnings.kind.heat": "熱中症",
  "direction.point.n": "北",
  "direction.point.ne": "北東",
  "direction.point.e": "東",
  "direction.point.se": "南東",
  "direction.point.s": "南",
  "direction.point.sw": "南西",
  "direction.point.w": "西",
  "direction.point.nw": "北西",
  "weatherCode.0": "快晴",
  "weatherCode.1": "ほぼ快晴",
  "weatherCode.2": "一部曇り",
  "weatherCode.3": "曇り",
  "weatherCode.45": "霧",
  "weatherCode.48": "霧氷を伴う霧",
  "weatherCode.51": "弱い霧雨",
  "weatherCode.53": "霧雨",
  "weatherCode.55": "強い霧雨",
  "weatherCode.56": "着氷性の霧雨",
  "weatherCode.57": "強い着氷性の霧雨",
  "weatherCode.61": "弱い雨",
  "weatherCode.63": "雨",
  "weatherCode.65": "強い雨",
  "weatherCode.66": "着氷性の雨",
  "weatherCode.67": "強い着氷性の雨",
  "weatherCode.71": "弱い雪",
  "weatherCode.73": "雪",
  "weatherCode.75": "強い雪",
  "weatherCode.77": "霧雪",
  "weatherCode.80": "弱いにわか雨",
  "weatherCode.81": "にわか雨",
  "weatherCode.82": "激しいにわか雨",
  "weatherCode.85": "弱いにわか雪",
  "weatherCode.86": "強いにわか雪",
  "weatherCode.95": "雷雨",
  "weatherCode.96": "雹を伴う雷雨",
  "weatherCode.99": "激しい雹を伴う雷雨",
  "weatherCode.unknown": "不明",
  "time.now": "たった今",
  "time.minutes": "{{n}}分",
  "time.hours": "{{n}}時間",
  "time.days": "{{n}}日",
  "glasses.connecting": "スマートフォンに接続中。",
  "glasses.resuming": "サインインし直しています。",
  "glasses.signIn": "スマートフォンでサインイン。",
  "glasses.locating": "位置を取得中。",
  "glasses.noFix": "位置がまだありません。",
  "glasses.offline": "lo.gcc3.com に接続できません。",
  "glasses.recording": "録音中 — 離すと終了。",
  "glasses.transcribing": "文字起こし中。",
  "glasses.noSpeech": "音声を認識できません。",
  "glasses.noMic": "マイクを開けませんでした。",
  "glasses.transcribeFailed": "音声認識に接続できません。",
  "glasses.markFailed": "この場所を記録できません。",
  "glasses.empty": "表示できるものがありません。",
  "glasses.noScreen": "メガネに何も表示されていません。lo を閉じて、Even App から開き直してください。",
};

const zh: Dict = {
  "common.loading": "加载中。",
  "clock.title": "时间",
  "clock.offset": "UTC{{offset}}",
  "weather.today": "今天",
  "weather.tomorrow": "明天",
  "weather.feels": "体感",
  "weather.daylight": "日照 {{span}}",
  "weather.sunrise": "日出 {{span}}",
  "weather.title": "天气",
  "location.title": "此处",
  "posts.title": "posts",
  "people.title": "附近的人",
  "messages.title": "消息",
  "mail.badge": "未读",
  "messages.empty": "没有未读消息。",
  "messages.said": "我: {{body}}",
  "messages.from": "{{name}}: {{body}}",
  "messages.reading": "正在读取对话。",
  "messages.reply": "长按回信。",
  "people.message": "长按发消息。",
  "user.followers": "关注者 {{n}}",
  "user.follower": "关注者 {{n}}",
  "user.following": "关注中 {{n}}",
  "user.posts": "最近的 posts",
  "profile.email": "邮箱",
  "profile.website": "主页",
  "profile.line": "LINE",
  "profile.whatsapp": "WhatsApp",
  "profile.wechat": "微信",
  "nearby.title": "附近",
  "world.title": "信息",
  "tally.join": " · ",
  "world.unavailable": "此国家没有可读取的内容。",
  "warnings.short": "预警",
  "location.fix": "位置",
  "people.alone": "附近没有其他人。",
  "posts.empty": "附近还没有 post。",
  "news.title": "新闻",
  "news.local": "本地",
  "news.places": "你的周边",
  "news.empty": "附近暂无可报道的内容。",
  "news.unavailable": "无法连接新闻服务。",
  "news.loading": "正在读取周边。",
  "events.title": "活动",
  "events.empty": "近两周附近暂无活动。",
  "events.unavailable": "无法连接活动服务。",
  "events.loading": "正在查找活动。",
  "trends.title": "趋势",
  "trends.empty": "此地暂无搜索趋势。",
  "trends.unavailable": "无法连接 Google 趋势。",
  "trends.loading": "正在读取 Google 趋势。",
  "article.reading": "正在读取全文。",
  "article.elsewhere": "这篇请在手机上阅读。",
  "article.partial": "余下内容在原站页面。",
  "warnings.title": "预警",
  "warnings.unavailable": "无法连接 Yahoo! 天気・災害。",
  "mark.saving": "保存中。",
  "mark.saved": "已记录。",
  "post.saving": "发布中。",
  "post.saved": "已发布。",
  "post.failed": "无法发布到此处。",
  "compose.title": "post 还是 mark？",
  "compose.said": "听到",
  "compose.keep": "保存为",
  "compose.markWho": "只有你",
  "compose.postWho": "这里的所有人",
  "compose.hint": "滚动选择 · 轻触保存 · 连按两次丢弃。",
  "compose.dropped": "已丢弃。",
  "compose.replyTitle": "发送这条回复？",
  "compose.sendTo": "发送给",
  "compose.replyHint": "轻触发送 · 连按两次丢弃。",
  "reply.sending": "发送中。",
  "reply.sent": "已回复。",
  "reply.failed": "无法发送。",
  "warnings.kind.rain": "暴雨",
  "warnings.kind.flood": "洪水",
  "warnings.kind.storm": "暴风",
  "warnings.kind.blizzard": "暴风雪",
  "warnings.kind.heavySnow": "大雪",
  "warnings.kind.waves": "大浪",
  "warnings.kind.surge": "风暴潮",
  "warnings.kind.gale": "大风",
  "warnings.kind.galeSnow": "风雪",
  "warnings.kind.thunder": "雷电",
  "warnings.kind.snowmelt": "融雪",
  "warnings.kind.fog": "浓雾",
  "warnings.kind.dry": "干燥",
  "warnings.kind.avalanche": "雪崩",
  "warnings.kind.lowTemperature": "低温",
  "warnings.kind.frost": "霜冻",
  "warnings.kind.icing": "结冰",
  "warnings.kind.snowAccretion": "积雪",
  "warnings.kind.landslide": "泥石流",
  "warnings.kind.tornado": "龙卷风",
  "warnings.kind.recordRain": "短时强降雨",
  "warnings.kind.heat": "中暑",
  "direction.point.n": "北",
  "direction.point.ne": "东北",
  "direction.point.e": "东",
  "direction.point.se": "东南",
  "direction.point.s": "南",
  "direction.point.sw": "西南",
  "direction.point.w": "西",
  "direction.point.nw": "西北",
  "weatherCode.0": "晴朗",
  "weatherCode.1": "大部晴朗",
  "weatherCode.2": "多云",
  "weatherCode.3": "阴天",
  "weatherCode.45": "雾",
  "weatherCode.48": "雾凇",
  "weatherCode.51": "小毛毛雨",
  "weatherCode.53": "毛毛雨",
  "weatherCode.55": "大毛毛雨",
  "weatherCode.56": "冻毛毛雨",
  "weatherCode.57": "强冻毛毛雨",
  "weatherCode.61": "小雨",
  "weatherCode.63": "中雨",
  "weatherCode.65": "大雨",
  "weatherCode.66": "冻雨",
  "weatherCode.67": "强冻雨",
  "weatherCode.71": "小雪",
  "weatherCode.73": "中雪",
  "weatherCode.75": "大雪",
  "weatherCode.77": "米雪",
  "weatherCode.80": "小阵雨",
  "weatherCode.81": "阵雨",
  "weatherCode.82": "强阵雨",
  "weatherCode.85": "小阵雪",
  "weatherCode.86": "大阵雪",
  "weatherCode.95": "雷暴",
  "weatherCode.96": "雷暴伴冰雹",
  "weatherCode.99": "强雷暴伴冰雹",
  "weatherCode.unknown": "未知",
  "time.now": "刚刚",
  "time.minutes": "{{n}}分钟",
  "time.hours": "{{n}}小时",
  "time.days": "{{n}}天",
  "glasses.connecting": "正在连接手机。",
  "glasses.resuming": "正在恢复登录。",
  "glasses.signIn": "请在手机上登录。",
  "glasses.locating": "正在读取位置。",
  "glasses.noFix": "尚无位置。",
  "glasses.offline": "无法连接 lo.gcc3.com。",
  "glasses.recording": "录音中 — 松开结束。",
  "glasses.transcribing": "正在转写。",
  "glasses.noSpeech": "没有听到内容。",
  "glasses.noMic": "麦克风未能打开。",
  "glasses.transcribeFailed": "无法连接语音服务。",
  "glasses.markFailed": "无法记录此处。",
  "glasses.empty": "暂无内容。",
  "glasses.noScreen": "眼镜上没有任何显示。请关闭 lo，从 Even App 重新打开。",
};

const DICTS: Record<Language, Dict> = { en, ja, zh };

/**
 * A key, and whatever has to be dropped into it. Missing keys come back as
 * themselves rather than as an empty line: a screen reading `weather.humidity`
 * is plainly a bug, where a blank row is just a card that looks broken.
 */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function translator(language: Language): Translate {
  const dict = DICTS[language] ?? DICTS.en;
  return (key, vars) => {
    const template = dict[key] ?? DICTS.en[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole,
    );
  };
}

/** The words for a WMO weather code, by the table lo keys them under. */
export function weatherLabelKey(code: number | null | undefined): string {
  return code != null && `weatherCode.${code}` in DICTS.en ? `weatherCode.${code}` : "weatherCode.unknown";
}
