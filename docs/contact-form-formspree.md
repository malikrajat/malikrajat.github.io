# How the contact form emails you (and how to copy it)

## TL;DR

There is no workaround and no backend. Your contact form posts to **Formspree**, a
form-to-email relay service. Formspree receives the POST, stores it, and forwards it
to the inbox registered to form ID `mpwzqzge`.

```
visitor  ──POST──►  formspree.io/f/mpwzqzge  ──email──►  your inbox
         (browser)        (Formspree server)              (no SMTP on your site)
```

That's why a GitHub Pages site — which can only serve static files and can run no
server-side code — can still deliver mail.

## Where it is configured

Single place, [index.html#L2372](../index.html#L2372):

```html
<form action="https://formspree.io/f/mpwzqzge"
      class="php-email-form"
      data-aos="fade-up" data-aos-delay="200"
      method="post">
```

- `action` — the Formspree endpoint. `mpwzqzge` is your form ID.
- `method="post"` — **required**. Opening that URL in a browser shows
  "Form should POST", which is what I used to confirm the form is live.
- Field `name` attributes are what you receive in the email:
  `name`, `email`, `subject`, `enquiry_type`, `message`.
- `email` is special-cased by Formspree as **Reply-To**, so hitting Reply in your
  mail client answers the visitor, not Formspree.

The destination inbox is **not** in the repo — it lives in your Formspree account
for form `mpwzqzge`. Nothing in this project can reveal or change it; you'd log into
formspree.io to see/edit it.

## The `php-email-form` class is a dead leftover

The original iPortfolio template shipped a `main.js` that intercepted
`.php-email-form`, AJAX-posted to `forms/contact.php`, and drove
`loading` / `error-message` / `sent-message` divs. That handler has been stripped
from `assets/js/main.js` in this repo (it contains no form code at all), and there
is no `forms/contact.php`.

So the class is now cosmetically inert — the form behaves as **plain HTML**, the
browser navigates to formspree.io, and Formspree shows its own thank-you page.
Nothing is broken; it just means visitors leave your site on submit.

## The rich-text message box, and a real bug

`index.html` has a `contenteditable` editor whose HTML is copied into a hidden
input on submit ([index.html#L2611](../index.html#L2611)):

```js
editor.closest('form').addEventListener('submit', function () {
  hiddenInput.value = editor.innerHTML;
});
```

**Bug:** that hidden input carries `required`, but browsers *bar* `type="hidden"`
inputs from constraint validation — `required` on it does nothing. A visitor can
submit an empty message. Also, because `innerHTML` is sent, you receive raw tags
like `<div>Hi</div>` in the email body.

Fixes, if you want them: validate `editor.textContent.trim()` in the submit
handler, and send `innerText` instead of `innerHTML`, or `preventDefault()` and
submit the form programmatically.

## Replicating on another website

Working, portable copy: [snippets/formspree-contact-form.html](formspree-contact-form.html).

1. **Get an endpoint.** Create a form at <https://formspree.io> for that site.
   Each site should get its own form ID so submissions stay separable and you
   don't burn one 50/month free-tier quota across sites.
2. **Verify the inbox.** The first submission triggers a confirmation email;
   click it once or nothing is delivered.
3. **Drop in the snippet**, swap `REPLACE_WITH_NEW_FORM_ID`, keep
   `method="post"`.
4. **Pick a submit mode** — plain POST (identical to this site) or the AJAX mode
   already wired in the snippet, which keeps the visitor on the page with an
   inline success/error message.

### Differences worth adopting in the copy

| | This site | Snippet |
|---|---|---|
| Submit UX | full page navigate to formspree.io | stays on page, inline status |
| Success message | Formspree's page | yours, on brand |
| Spam | relies on Formspree defaults | adds `_gotcha` honeypot |
| Email subject | always Formspree's default | `_subject` from the subject field |

### Free-tier limits to know

50 submissions/month, 30-day submission history, no file uploads, and reCAPTCHA
is an account setting rather than a code change.

### Two-variable alternative

If you'd rather not hand form IDs to a third party, the same static-site trick
works with **Web3Forms** (`https://api.web3forms.com/submit` + an access key) or
**EmailJS** (browser SDK, free 200/month). Formspree is the least code, which is
why it's what you already used.
