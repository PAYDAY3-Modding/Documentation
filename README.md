# PAYDAY 3 Modding Documentation

Community documentation for playing PAYDAY 3 with mods and creating mods with the custom Unreal Engine editor, CrimeFactory, PDML, and the supporting modkit toolchain.

The documentation is written in AsciiDoc and built with [Antora](https://antora.org/).

## What this repository covers

The site is organised into **Playing with Mods** and **Developing Mods**.

Playing with Mods covers finding downloads on ModWorkshop, installing complete PDML mod folders into `PAYDAY3/Mods/`, and using Mod Organizer 2 with ModWorkshop's PAYDAY 3 plugin. PDML is the recommended mod format; loose PAK installation is documented as an older workflow being phased out.

Developing Mods documents the current PAYDAY 3 modding workflow, including:

- Installing the custom PAYDAY 3 Unreal Engine editor
- Setting up FModel and PAYDAY 3 mappings
- Setting up the Wwise integration required by the modkit
- Installing and updating the PAYDAY 3 modkit
- Generating the JMAP used by Suzie
- Working with cooked PAYDAY 3 assets in the editor
- Creating plugin-based mods with CrimeFactory
- Forging mods with CrimeFactory
- Loading and managing mods with PDML
- Creating custom heists
- Advanced asset, reflection, Blueprint, and runtime workflows
- Troubleshooting common editor, cook, Forge, and runtime problems

The documentation follows the toolchain as it exists today. Planned features, reverse-engineering theories, and unverified workflows should not be presented as finished instructions.

## Contributing

Contributions are welcome.

If you find incorrect information, an outdated workflow, a missing screenshot, or a section that could be clearer, open an issue or submit a pull request.

You do not need to write an entire finished guide before contributing. A small correction or a rough first pass at a missing page is still useful.

Before submitting a pull request:

1. Build the documentation locally.
2. Check that the pages you changed render correctly.
3. Verify that links and cross-references work.
4. Make sure instructions describe a workflow you have actually tested.
5. Do not include PAYDAY 3 base-game files or other content that cannot be redistributed.

For an overview of AsciiDoc syntax, see the [Asciidoctor documentation](https://docs.asciidoctor.org/asciidoc/latest/).

## Development setup

### Requirements

You need:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/)
- npm

### Install dependencies

Clone the repository, open a terminal in the repository root, and run:

```powershell
npm install
```

If `package-lock.json` is present and you want a clean reproducible install, you can use:

```powershell
npm ci
```

### Build the documentation

Run:

```powershell
npm run build
```

Antora writes the generated site to:

```text
build/site/
```

Open the generated homepage in a browser:

```powershell
start .\build\site\index.html
```

The `build/` directory is generated output. Do not edit the generated HTML directly.

## Editing documentation

Documentation source files live under `modules/`.

For example:

```text
modules/
├── ROOT/
├── playing-with-mods/
├── getting-started/
├── modkit/
├── CrimeFactory/
├── creating-mods/
├── custom-heists/
├── pdml/
├── advanced/
├── reference/
└── troubleshooting/
```

Each module normally contains:

```text
<module>/
├── pages/
├── images/
└── partials/
```

Edit `.adoc` files under `pages/` to change documentation content.

The sidebar is assembled in `modules/ROOT/nav.adoc`. Edit it to change the two main sections or the Playing with Mods links.

Each development module keeps its page links in `partials/nav.adoc`, included under Developing Mods. Edit those partials to add, remove, or reorder development pages.

Store screenshots and diagrams in the `images/` directory for the module that owns the page.

## Site UI

Custom site styling and header behavior live under:

```text
supplemental-ui/
├── css/
├── js/
└── partials/
```

The PAYDAY 3 dark theme is implemented in:

```text
supplemental-ui/css/site-extra.css
```

Search behavior is implemented in:

```text
supplemental-ui/js/docs-search.js
scripts/build-search.js
```

## Link previews

Each generated documentation page includes Open Graph and Twitter Card metadata for link previews with a title, description, and image.

The preview title comes from the page's AsciiDoc title. Add a `:description:` attribute directly beneath the title to set the preview text:

```asciidoc
= Installing Mods
:description: Install PAYDAY 3 mods with PDML and keep each mod in its own folder.
```

Pages without a description use the shared description in `site.keys.social-description` in `antora-playbook.yml`. All pages use the CrimeFactory dashboard image by default. Change `site.keys.social-image` and `site.keys.social-image-alt` to replace the shared image and its accessible description.

To give a page its own image, add these attributes beneath its title:

```asciidoc
:page-social-image: /payday3-modding/_images/editor-heist.png
:page-social-image-alt: A custom PAYDAY 3 heist open in the Unreal Engine editor.
```

Image paths start with `/` and are relative to the site base URL. For images in other modules, include the module name, for example `/payday3-modding/CrimeFactory/_images/CrimeFactory-dashboard.png`. Use PNG or JPEG files that are publicly accessible.

Set `site.url` in `antora-playbook.yml` to the published site's base URL without a trailing slash. The GitHub Pages deployment workflow uses the base URL from `actions/configure-pages`, including a custom domain if configured. For a local build targeting another host, set Antora's `URL` environment variable before running `npm run build`.

Preview metadata is rendered into the HTML at build time in `supplemental-ui/partials/head-social.hbs`. The `scripts/link-previews.js` Antora extension also copies it onto static redirects, including the site root, for crawlers that do not follow browser redirects. Rebuild and deploy the site before testing a public link in Discord or X. Local file links cannot be fetched by those services. Existing previews may remain cached after an update, and each service controls how much of the preview it displays.

## Repository layout

The main documentation areas are:

- `ROOT` for the landing page, terminology, and contribution information
- `playing-with-mods` for finding downloads, manual installation, and Mod Organizer 2 setup
- `getting-started` for the linear beginner setup and first-mod workflow
- `modkit` for the custom editor, cooked assets, reflection data, and modkit internals
- `CrimeFactory` for mod creation, templates, Forge, validation, and editor tooling
- `creating-mods` for task-oriented modding guides
- `custom-heists` for heist authoring workflows
- `pdml` for the runtime loader, mod structure, settings, dependencies, and APIs
- `advanced` for reverse-engineering and lower-level Unreal topics
- `reference` for paths, commands, terminology, and API reference material
- `troubleshooting` for symptom and error-oriented help

## Writing guidelines

Keep documentation practical and reproducible.

1. Document what the current toolchain actually does.
2. Prefer numbered procedures for setup and task pages.
3. Explain why a required step exists when that context prevents common mistakes.
4. Clearly distinguish mod-owned source content from PAYDAY 3 cooked content.
5. Never instruct users to redistribute PAYDAY 3 base-game assets.
6. Mark experimental, incomplete, and known-limitation workflows clearly.
7. Do not document guessed paths, class names, APIs, or runtime behavior as fact.
8. Keep the Getting Started section linear and beginner-friendly.
9. Move deeper implementation details into the relevant Modkit, Advanced, or Reference page and link to them.
10. Use the term **Forge** for CrimeFactory's cook/package action.
11. Use `PAYDAY3/Mods/` as the normal install location for CrimeFactory/PDML mods unless a specific workflow explicitly states otherwise.
12. Lead player installation guides with PDML and installing the complete mod folder. Keep loose PAK installation as secondary guidance for older downloads.

## Status labels

Use these consistently when a page needs to describe implementation status:

- **Supported**: part of the intended current workflow
- **Experimental**: implemented but still being validated
- **In progress**: actively being developed and not ready to rely on
- **Known limitation**: an understood capability gap

## Screenshots

Store screenshots in the `images/` directory belonging to the module that uses them.

Prefer descriptive file names such as:

```text
CrimeFactory-new-mod-window.png
CrimeFactory-dashboard.png
pdml-information-window.png
```

Crop screenshots to the UI that matters where possible, but keep enough surrounding context for the reader to understand where the control lives.

Do not include account credentials, private tokens, personal information, or other secrets in screenshots.

## Generated files

Do not manually edit files under:

```text
build/site/
```

They are regenerated from the AsciiDoc source whenever `npm run build` is run.
