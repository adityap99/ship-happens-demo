# Ship Happens — Suggested fix for issue #29

> This file was created because the autonomous patch could not be applied verbatim (the file in this repo differs from the version running at capture time). Apply the diff below manually, then delete this file.

**Root cause:** `NULL_REFERENCE` in `src/components/CheckoutStepper.tsx:231 — onClick handler for Load saved address button()`

## `src/components/CheckoutStepper.tsx`

Added a guard clause to check if the address is undefined before trying to access its properties, showing an error message to the user when no address is found.

```diff
-           captureAsync(() => fetchSavedAddress(), 1200)
-             .then(addr => {
-               setForm({ street: addr.street, city: addr.city, state: addr.state, zip: addr.zip })
-               setAddressLoading(false)
-             })
-             .catch(() => setAddressLoading(false))
+           captureAsync(() => fetchSavedAddress(), 1200)
+             .then(addr => {
+               if (!addr) {
+                 setError('No saved address found for your account.')
+                 setAddressLoading(false)
+                 return
+               }
+               setForm({ street: addr.street, city: addr.city, state: addr.state, zip: addr.zip })
+               setAddressLoading(false)
+             })
+             .catch(() => setAddressLoading(false))
```
