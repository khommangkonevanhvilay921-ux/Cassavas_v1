# Applying Noto Sans Lao to Lao-mode UI

Written against: `dba367d1bf4302b53df0ffde22aa0eb2c494f210`

## Evidence chain

- Surface: All existing application routes in Lao mode, selected by the language toggle.
- Problem: The root stylesheet downloads Noto Sans Lao, but neither active font token includes it; the rendered Lao-mode wrapper therefore inherits the Latin-oriented system stack.
- Design evidence: The user's instruction selects Noto Sans Lao and supplies its variable-font settings. `app/layout.tsx` imports `app/globals.css` for the application, and `LanguageProvider` wraps the app in `<div lang={language}>`. In `app/globals.css`, `--sans` and `--serif` are the shared font-family tokens, while the body and many page headings consume those tokens.
- Owner: `app/globals.css` typography tokens, scoped to the existing `lang="lo"` wrapper emitted by `app/components/language-provider.tsx`.
- Scope and affected surfaces: Public pages, login and registration, and Farmer, Middleman, Factory, and Admin workspaces when Lao is selected. English mode remains on its current font stack.
- Uncertainty: None for locale scoping; verify Lao glyph coverage and mixed-script rendering in the built font.

## Design decision

Use the requested Noto Sans Lao variable font for Lao-mode typography, preserving the existing Latin stack in English mode. Apply the font to both shared typography tokens inside the existing `lang="lo"` wrapper so components that explicitly use either token—including headings, forms, tables, and navigation—render Lao consistently. Retain inherited weight behavior and use the requested normal style, optical sizing, and `wdth` axis value.

## Reuse

- Existing global Google Fonts import for Noto Sans Lao in `app/globals.css`.
- Existing `--sans` and `--serif` typography tokens in `app/globals.css`.
- Existing locale wrapper in `app/components/language-provider.tsx`.
- Exemplar: `app/layout.tsx` imports `app/globals.css` once for the application.

## Changes

1. `app/globals.css`
   - Change: Add a Lao-language-scoped font rule for `[lang="lo"]` that assigns the Noto Sans Lao-first stack to `--sans` and `--serif`, applies `font-family: var(--sans)`, `font-optical-sizing: auto`, `font-style: normal`, and `font-variation-settings: "wdth" 100`. Leave font weight inherited so existing component weights continue to select the variable font weight. Keep the current Google Fonts import and the English-mode token values.
   - Preserve: English typography, UI wording, locale switching, component hierarchy, and all route behavior.
   - Verify: Toggling to Lao renders Lao text in Noto Sans Lao across headings and controls; toggling back restores the existing English stack.

## Scope

- Inherit: All routes rendered under the root layout and wrapped by `LanguageProvider`.
- Verify: Landing page, login, registration, KYC forms, role dashboards, data tables, status labels, and error/empty states in Lao mode; mixed Lao/Latin text and numerals at desktop and mobile widths.
- Exclude: Translation edits, authentication or registration behavior, other visual redesign work, and environment or deployment configuration.

## Validation

- Product: Toggle language between English and Lao; verify the chosen font follows the locale without changing form behavior or route navigation.
- Interface: Inspect Lao headings, navigation, buttons, inputs, tables, long validation/error messages, combining marks, Lao and Latin digits, and mixed-script labels at desktop and mobile widths.
- System: Confirm English mode retains the current font tokens and Lao-mode descendants using either shared typography token inherit the Noto Sans Lao stack.
- Repository: `npm.cmd run lint` → no lint errors; `npm.cmd test` → all existing tests pass; `npm.cmd run build` → production build succeeds and font assets are emitted.

## Stop conditions

- Stop if the selected Noto Sans Lao build does not contain the required glyphs or the existing Google Fonts import fails during production build; report the limitation rather than substituting a different typeface.

## Design documentation

- After acceptance and validation: No design documentation update.
