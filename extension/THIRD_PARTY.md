# Third-party code

`vendor/analyzer.js` is copied from Watchroll 1.4.21, by the Watchroll contributors:
https://github.com/awmaximus/watchroll

It is distributed under the MIT license reproduced in `vendor/WATCHROLL-LICENSE`.
The API adapter and integrated interface are specific to this project.
Local change to the analyzer: expose `analyzeEntry` to allow per-series API
cancellation and deadlines, without changing the upstream classification rules.

Additional local adaptations preserve the native `is_favorite` flag during
normalization and expose the latest known released-episode date for list sorting.

The local preferred-audio mode merges episode versions and applies two ordered
audio languages per episode (including movies), retaining progress across versions.
