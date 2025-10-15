Place the eChanneling logo files here so email templates and static pages can reference them.

Expected files (JPG):
- echanneling-logo.jpg (portrait logo, used in welcome emails) - recommended size: 160x160 px
- echanneling-logo-wide.jpg (wide / horizontal logo, used in header areas) - recommended width: 600 px

Do NOT commit production keys or sensitive images. This folder is served by your static assets server. In development Nest + static serve should expose `/assets/*` from this folder. If you use a different hosting setup, upload these images to your CDN and adjust the image URLs in `src/mail/mail.service.ts` accordingly.
