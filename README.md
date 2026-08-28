lo-even
=======

`lo` for Even G2. The phone-side WebView signs in to the existing lo account and supplies location; the glasses show one nearby-information component at a time.


Glasses controls
----------------

- Scroll up/down: move between components.
- Single tap: save the phone's current location as a lo mark.
- Press and hold: record from the glasses microphone. Release to transcribe and publish the message as a location-based lo post.
- Double tap: open the standard Even exit confirmation.


Development
-----------

Requirements: Node 22+, npm 10.9+, and the `evenhub` CLI for simulation/packaging.

```bash
./setup.sh
./develop.sh
```

Open the printed URL in the Even Hub simulator. An ordinary browser also works for phone-UI development; when native location is unavailable, the development build uses central Tokyo as sample data.

The helper scripts mirror `sc-even`:

- `develop.sh` — Vite on the LAN plus an Even Hub QR code.
- `simulate.sh` — open the simulator against port 5173.
- `login.sh` — authenticate the Even Hub CLI.
- `package.sh` — build and produce the versioned `.ehpk`.
- `serve.sh` — foreground production preview.
- `start.sh`, `stop.sh`, `restart.sh` — optional PM2 staging preview lifecycle.


Release
-------

```bash
./login.sh
./package.sh
```

The package identity is `com.gcc3.lo`, while its Even Hub display name is `lo`. The companion server must accept `Authorization: Bearer` on `/api/*` and answer cross-origin preflights there, as documented in `server-integration.md`, before a packaged build can sign in.
