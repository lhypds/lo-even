
Signing in
==========

The password is asked for once, on the first launch. The session that comes back
is written down, and every launch after it takes that session up again without
asking anybody anything — both halves of the app, the glasses on the token itself
and the phone view on a fresh link key minted from it. lo renews the session
every time it is presented, so using the glasses is what keeps it alive: it
stands until the reader signs out, and the only session that ages out is one
nobody has presented for a month. A session lo actually refuses brings the
password screen back and is forgotten in the same breath; a lo that could not be
reached, or answered with a fault of its own, refuses nothing, and the session is
kept for the launch that can ask properly.

The asking is lo's own screen, in two goes: the name, and then the password. The
name is put to lo before the second screen comes up, so a mistyped one is answered
on the field it was typed into rather than after a password has been given and
refused — and a name nobody is using is answered with the offer to open it, which
is the same sheet, the same words and the same next screen the website has. The
password given there is the one the account is opened with.

Signing out is lo's own button, inside the phone view. There are two sessions
behind these two screens and the site can only end its own, so it says so to the
frame around it on the way out — one `postMessage`, no credential in it — and the
package ends the other and forgets what it was keeping. Both of these are written
up in [server-integration.md](../server-integration.md).
