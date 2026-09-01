
Release
=======

```bash
./login.sh
./package.sh
```

The package identity is `com.gcc3.lo`, while its Even Hub display name is `lo`. The companion server must accept `Authorization: Bearer` on `/api/*`, answer cross-origin preflights there, and mint a link key from a token at `POST /api/me/link`, as documented in [server-integration.md](../server-integration.md), before a packaged build can sign in and stay signed in.
