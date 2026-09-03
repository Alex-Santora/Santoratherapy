# Stephanie Santora, MSW, LICSW — Static Practice Website

A custom, responsive three-page website built with semantic HTML, modern CSS, and lightweight vanilla JavaScript. No build process or backend is required.

## Open locally

You can double-click `index.html`, or serve the folder locally for the most reliable browser behavior:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Replace image placeholders

The portrait, office, and abstract-image areas are intentional styled placeholders. Search the HTML for `Replace this placeholder` to find each one. Add optimized images to `assets/images/` (WebP is recommended), then replace the placeholder `<div>` with an image, for example:

```html
<img class="portrait-placeholder" src="assets/images/stephanie-portrait.webp" alt="Stephanie Santora, MSW, LICSW">
```

Keep useful, specific alt text. Aim for images under 300 KB when possible. The insurance tile artwork in `assets/images/` is custom, lightweight placeholder iconography rather than official insurer artwork; replace it with approved brand assets if the practice has permission to use them.

## Connect the contact form

The form currently validates in the browser and displays a demo confirmation without transmitting data. It intentionally does not collect detailed health or payment information.

### Formspree

1. Create a Formspree form.
2. In `contact.html`, replace `action="#"` with the supplied `https://formspree.io/f/...` endpoint.
3. Remove `data-placeholder-endpoint="true"` from the `<form>`.
4. Consider configuring Formspree’s redirect or adapting the JavaScript to submit with `fetch` and show the existing modal.

### Netlify Forms

1. Add `data-netlify="true"` and `name="contact"` to the `<form>`.
2. Add `<input type="hidden" name="form-name" value="contact">` inside it.
3. Remove `data-placeholder-endpoint="true"`.
4. Deploy to Netlify and verify a test submission in the Netlify dashboard.

### EmailJS

1. Add the EmailJS browser SDK and initialize it with the public key.
2. In `assets/js/main.js`, find the `EmailJS integration point` comment.
3. Replace the demo timer with `emailjs.sendForm(serviceID, templateID, form)` and handle success/failure there.

Before launch, review the chosen provider’s privacy and security terms with the practice. A general web contact form should not be treated as a secure clinical communication channel.

## Deploy

### GitHub Pages

Push the folder to a GitHub repository. In **Settings → Pages**, deploy from the main branch and root folder.

### Netlify

Drag the folder into Netlify Drop or connect the repository. No build command is needed; set the publish directory to the repository root.

### Vercel

Import the repository as an “Other” framework. No build command is needed, and the output directory is the project root.

## Content source

Practice facts are based on [Stephanie Santora’s Psychology Today profile](https://www.psychologytoday.com/us/therapists/stephanie-santora-exeter-nh/449201). Confirm address, phone, insurance participation, session formats, fees, and other details with the practice before publishing, since directory information can change.
