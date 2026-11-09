---
title: Tailwind CSS
description: Utility compilation, source detection, CSS cascade, v4 theme tokens, layout, responsive and container queries, state variants, dark mode, accessibility, and browser verification.
icon: tailwind-css.png
updatedAt: 2026-11-09
---

# Tailwind CSS

Tailwind CSS compiles recognized utility classes into ordinary CSS. An element's classes select layout, spacing, colors and conditional styles; the browser still applies the normal cascade, inheritance, layout and accessibility rules. Tailwind does not render components or repair an incorrect DOM structure.

This reading uses the v4 CSS-first configuration model. The example compiles a small interface and checks its actual computed styles in Chromium, including a missing runtime-generated class, viewport/container behavior, dark mode and keyboard focus. It uses plain HTML and JavaScript so those mechanisms remain separate from React or Next.js.

## Utilities, Variants & the CSS Cascade

A utility selects a focused styling behavior. `p-4` sets padding from the spacing scale, `grid-cols-2` defines grid tracks, and `text-white` selects a color. A utility can emit several declarations or work with other variables/rules; it is not necessarily exactly one CSS property.

A variant changes when or where a utility applies. `hover:bg-brand-600` responds to a state, while `md:grid-cols-2` applies at a configured minimum viewport width. Variants can compose, such as a responsive hover style, but the resulting rule still needs its selector and media conditions to match.

```html
<button
  type="button"
  class="bg-brand-500 hover:bg-brand-600 focus-visible:outline-brand-500 rounded-lg px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
>
  Save order
</button>
```

`brand` is a custom theme token defined later. The button uses native semantics and separate state styling. A class named `disabled:opacity-50` does not disable an enabled element; it styles the disabled state when that state exists.

Class attribute order is not a general conflict-resolution rule. With conflicting classes such as two padding values, generated CSS order, layers, specificity and importance determine the result. Appending another utility string does not reliably mean it wins. Select one intended variant at the component boundary or use a compatible, deliberately configured class-merging strategy.

Tailwind v4 uses CSS cascade layers. Ordinary unlayered author CSS can outrank normal layered rules even with a less specific selector. Inspect the browser's matched rules and computed values before adding more specificity or importance. A library reset, global selector or stylesheet import order can explain a result that looks like a missing utility.

Preflight supplies baseline styles, including resets that affect margins, headings, borders and controls. A heading retaining no browser-default size or a list losing default markers can be expected reset behavior, not a failed build. Add the intended typography explicitly and review third-party widgets that assume browser defaults.

## Source Detection & Generated CSS

Tailwind scans source text for class candidates; it does not execute application JavaScript to discover every possible runtime value. The production build must see complete utility names in the configured sources or receive an explicit supported source/safelist declaration.

```js
const tones = {
  info: 'bg-brand-500 text-white',
  neutral: 'bg-slate-100 text-slate-900',
};
```

This mapping exposes complete tokens to the scanner while allowing runtime selection. Constructing `'bg-' + color + '-500'` does not provide the complete class name in that source. It may appear to work when another file happens to contain the finished token, then fail after that unrelated file changes.

![Complete tokens in scanned files produce CSS rules; a runtime class fragment cannot request a new compiled rule.](/docs/tailwind-css/v1/source-detection.svg)

Source location matters in monorepos, shared packages, generated templates and ignored directories. A valid utility in a file outside detection scope can be absent from the output. Register relevant source paths instead of assuming every dependency or repository file is scanned. Broad source inclusion can also generate unrelated styles and hide an incomplete component contract.

The example makes its scope explicit:

```css
@import 'tailwindcss' source(none);
@source './index.html';
@source './variants.mjs';
```

It compiles only the fixture's declared class sources. Its browser test confirms that the complete `info` mapping produces a brand background while the deliberately concatenated background class produces no background rule. The latter element is an anti-example for learning, not a recommended production implementation.

For genuinely dynamic values, keep a stable class and supply a validated CSS custom property, for example `bg-[var(--tenant-color)]`. Tailwind can compile that fixed token without enumerating every possible color. A value supplied by application data is still subject to the application's input and rendering rules.

:::check{question="A background works locally only because another component contains the complete class name. Why can removing that component break the first one?"}
The scanner generated the rule from the other component's literal token. Runtime string fragments in the first component did not declare that rule independently. Use a complete class mapping, an explicit supported source declaration or a stable class with a dynamic CSS variable.
:::

## Theme Tokens & Custom Styles

The v4 theme is expressed through CSS theme variables. Namespaces connect tokens to utility families: a `--color-*` token enables related color utilities, while spacing, font and breakpoint namespaces address their own scales. A token's name is a design contract used across components, not just a local replacement for a hex value.

```css
@theme {
  --color-brand-500: #0369a1;
  --color-brand-600: #075985;
}
```

These tokens support the example's brand backgrounds and focus outline. Define semantic intent consistently: a reusable action color should not acquire a different meaning on every page. Changing one shared token can affect many states and components, so verify contrast and interaction after a theme change.

Use ordinary CSS variables for values that do not need to generate utilities. Arbitrary values such as a one-off grid template can express an exceptional layout, but repeated exceptions often indicate a missing token or reusable component. Keep the distinction between a deliberate exception and an undocumented second design system.

Custom CSS remains appropriate for selectors, complex composition or third-party integration. `@apply` can incorporate utilities into custom rules, but it is not a substitute for a component boundary or a reason to convert every repeated string into a global class. Shared component structure, behavior and accessibility usually belong together in the component implementation.

Tailwind v3 configuration examples cannot be copied blindly into v4. The integration packages, CSS entrypoint, source handling and theme setup differ. Legacy JavaScript configuration requires the supported compatibility path rather than being assumed to load automatically. Use the upgrade guide and compare rendered output, including reset, border and focus behavior.

## Layout, Viewport Breakpoints & Containers

Choose layout from content constraints. Flexbox handles a main-axis distribution with wrapping and cross-axis alignment; Grid defines tracks across rows and columns. `gap` belongs to the layout relationship, while margins describe element spacing. Applying a gap class without a supporting layout model does not create the intended flex/grid behavior.

Widths, minimum sizes and overflow interact. A flex/grid child with a long unbreakable value can resist shrinking; `min-w-0` and an explicit wrapping/overflow policy can matter more than another width class. An absolutely positioned child uses the appropriate containing block, not necessarily the element that looks visually closest.

Unprefixed utilities establish the base layout. A viewport breakpoint prefix applies from its configured minimum width upward; `sm:` does not mean “only phones.” Add breakpoint overrides when the layout needs more space instead of constructing every component from a fixed device label.

```html
<section class="grid grid-cols-1 gap-4 md:grid-cols-2">
  <article class="@container rounded-lg border p-4">
    <div class="flex flex-col gap-3 @sm:flex-row">...</div>
  </article>
</section>
```

`md:grid-cols-2` responds to viewport width. `@sm:flex-row` responds to the query container's width. Their named scales are distinct and need not represent the same threshold. Mark the containing element with `@container`; a reusable card can then adapt inside a narrow sidebar even when the overall browser is wide.

The browser fixture first verifies a one-column mobile grid and vertical card. At desktop width it verifies two columns and a horizontal card, then narrows only the container and confirms that the card becomes vertical while the viewport remains wide. This tests the layout condition rather than merely checking that the class string exists.

:::check{question="A card sits in a narrow sidebar on a wide desktop. Which condition should control a layout change based on the card's own available space?"}
A container query scoped to the intended query container. A viewport breakpoint sees the wide browser, not the sidebar's width. Define the container and verify the card at different container sizes inside the same viewport.
:::

## Interaction, Dark Mode & Accessibility

Use state variants that match the interaction. `focus-visible` can provide an appropriate keyboard focus indicator; `hover` alone excludes keyboard and touch interaction. `group-*` can style descendants from an ancestor state, and `peer-*` can respond to a suitable sibling relationship. Their selectors still depend on the actual DOM arrangement.

Attribute variants can reflect states such as expanded or selected. They do not implement state changes, keyboard navigation or ARIA semantics. A dropdown needs behavior and focus management in addition to styles. Preserve a logical DOM order when changing visual layout so reading and tab order remain meaningful.

Dark mode can follow a system media condition or an explicitly configured selector strategy. The example uses a root `.dark` class:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

A small script toggles that class; the compiled `dark:*` rules then apply. Persisting user preference, respecting system settings and preventing a theme flash during server rendering are application concerns that this fixture does not implement.

Test text, backgrounds, borders, focus and disabled states together. A darker background without matching text/control contrast is an incomplete theme. Preserve usable focus indicators, support reduced motion for nonessential animation and avoid relying only on color to convey an error or selected state.

Native `disabled` changes interaction, while `aria-disabled` primarily communicates a state and can require explicit behavioral handling. Opacity alone does neither. The fixture checks a native disabled button and its opacity, and uses keyboard navigation to verify the enabled button's visible outline. It is not a complete accessibility audit.

## Components, Build Integration & Diagnosis

In React or another component system, expose meaningful choices such as intent, size and disabled state. Map them to known class sets and keep structural markup/behavior in the component. An unrestricted `className` escape hatch can be useful, but callers need a documented ownership/conflict policy.

Install the integration matching the toolchain: the v4 PostCSS package, Vite integration or CLI as appropriate. Import the generated/processed stylesheet once through the intended build entry. A development-only CDN/runtime approach is not the same as producing the production stylesheet in a reproducible build.

When a style fails, inspect in order: whether the class is present on the element, whether its source was scanned, whether the CSS rule was generated and loaded, whether its state/media/container condition matches, and whether another cascade/layout rule wins. A DOM class without a generated rule is different from a generated rule whose condition is false.

The example uses Tailwind/CLI 4.3.5 and four Chromium scenarios covering compilation, layout conditions, selector dark mode and keyboard/disabled styling. CI builds the CSS and runs those browser assertions. One Chromium run does not establish behavior in every browser or certify all accessibility/visual requirements; verify the product's supported browser baseline and representative content.

:::check{question="A disabled-looking button has reduced opacity but still submits a form when activated. Which boundary is missing?"}
The intended interaction semantics. Styling does not disable an element. Use the appropriate native disabled behavior or implement the required behavior for the chosen accessible pattern, and test keyboard activation as well as appearance.
:::

[Runnable compiled CSS and browser assertions](https://github.com/LeandroCadena/engineering-knowledge-base/tree/main/examples/tailwind-css)
