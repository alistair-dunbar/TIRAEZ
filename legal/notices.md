# Notices and in-product wording

The exact text the product shows at sign-up, upload and the other account steps. It isn't served as a page. It's the reference copy, and the code must match it:

- `app/public/js/views/forms.js`
- `app/public/js/views/auth.js`
- `app/public/js/views/create.js`
- `app/public/js/views/emailflow.js`
- `app/public/js/copy.js`

## Sign-up form

**Terms acceptance** (required, unticked checkbox; the links open in a new tab):
> I agree to the [Terms of Service], including the [Acceptable Use and AI Content Policy].

Error if left unticked: "To create an account, you need to agree to the Terms of Service."

**Age confirmation** (required, separate unticked checkbox):
> I confirm that I am at least 18 years old.

Error if left unticked: "Confirm that you are at least 18 years old."

**Age field** help text: "In whole years. Tiraez is for people aged 18 and over."

**Under 18** (the only message shown; the form is removed and nothing is stored):
> Tiraez is available to people aged 18 and over.

**Privacy notice** (information, not a checkbox):
> We use your name, email and age confirmation to run your account, confirm your email and keep the service secure. Our [Privacy Policy] explains how, who we share data with and your rights.

**Marketing consent:** none. Tiraez doesn't send marketing, so there's no marketing checkbox. If marketing is added, it needs its own optional, unticked box that sign-up doesn't depend on. Suggested wording: "Send me occasional emails about new templates and offers. You can stop them at any time."

**Response after submitting** (the same whether or not the email already has an account; nobody is logged in yet):
> Check your email for the next steps.
> If you already have an account, you can log in or reset your password.
> Any message will go to [address]. If nothing arrives within a few minutes, check your spam folder, then try logging in or resetting your password.

## Upload step

> Your photo and details are stored in your account and sent to our video model provider, fal.ai, and the model's developer, Kling, to make your video. We don't use them to train AI models. Only upload photos you have the right to use, and don't include people without their permission. See the [Acceptable Use and AI Content Policy] and the [Privacy Policy].

## Before generating (review step)

> Generated videos are stored for 90 days. Download a copy before the expiry date.

On the result page and in My videos: "Available to download until [date]." Within 7 days of that date: "This video will be deleted soon. Download a copy before [date]. After that it can't be recovered. Downloading doesn't change the date." Once expired: "The video file was deleted on [date]."

## Before paying (shown next to the pay button once payments are switched on)

Button: "Pay SAR [price] for [n] credits"
> Pressing "Pay" takes you to Moyasar's secure page to pay SAR [price], the total price. It's a one-off payment with no subscription. Within 7 days, you can cancel a pack you haven't used any credits from. See [Billing, credits and refunds].

## Log in, log out, password reset

- Page title and button: "Log in". Opposite action: "Log out". Next to the password: "Forgot password?"
- Reset request response, the same for every address:
  > If an account exists for this email, we'll send password reset instructions.
- Reset link problems: "This link has expired." / "This link has already been used." / "This link isn't valid.", each with "Request a new link".
- After a reset: "Your password has been changed. You've been logged out everywhere. Log in again with your new password."

## After a video is made

> Made by an AI model, so check the details before you post. Some platforms, including TikTok, require AI-generated ads to be labelled.
