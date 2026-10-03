
Release
=======

```bash
./bump.sh
./login.sh
./package.sh
```

`bump.sh` takes `patch` (the default), `minor`, `major` or an exact `x.y.z`. It runs `npm version`, whose `version` script copies the new version into `app.json`, and commits `package.json`, `package-lock.json` and `app.json` as `x.y.z` with a `vx.y.z` tag. `package.sh` refuses to run while `app.json` and `package.json` carry different versions.

The package identity is `com.gcc3.lo`, while its Even Hub display name is `lo`. The companion server must accept `Authorization: Bearer` on `/api/*`, answer cross-origin preflights there, and mint a link key from a token at `POST /api/me/link`, as documented in [server-integration.md](../server-integration.md), before a packaged build can sign in and stay signed in.
