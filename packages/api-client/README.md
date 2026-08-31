# @zetro/api-client

Isomorphic fetch client for the Zetro REST API (`/api/v1`).

```js
import { createClient } from "@zetro/api-client";

const api = createClient({ baseUrl: "https://zetro.example", getToken: () => token });
await api.shop("abc").catalog();
```

`openapi.json` is the live spec. Refresh with `python scripts/export_openapi.py` or `npm run sync-openapi`.
