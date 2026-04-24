# Ship Happens — Suggested fix for issue #33

> This file was created because the autonomous patch could not be applied verbatim (the file in this repo differs from the version running at capture time). Apply the diff below manually, then delete this file.

**Root cause:** `NULL_REFERENCE` in `src/components/CheckoutStepper.tsx:231 — onClick handler for Load saved address button()`

## `src/components/CheckoutStepper.tsx`

Added a guard to check if addr is undefined before attempting to access its properties, preventing the TypeError when fetchSavedAddress returns undefined for guest users with no saved addresses.

```diff
- captureAsync(() => fetchSavedAddress(), 1200)
-             .then(addr => {
-               setForm({ street: addr.street, city: addr.city, state: addr.state, zip: addr.zip })
-               setAddressLoading(false)
-             })
+ captureAsync(() => fetchSavedAddress(), 1200)
+             .then(addr => {
+               if (!addr) {
+                 setError('No saved address found.')
+                 return
+               }
+               setForm({ street: addr.street, city: addr.city, state: addr.state, zip: addr.zip })
+               setAddressLoading(false)
+             })
```
