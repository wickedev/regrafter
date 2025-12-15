# Regrafter Documentation Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
yarn
```

## Local Development

```bash
yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true yarn deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.

## i18n (Internationalization)

### Writing Translations

To generate translation files for Korean:

```bash
yarn write-translations --locale ko
```

### Building for a Specific Locale

Build English version:
```bash
yarn build
```

Build Korean version:
```bash
yarn build --locale ko
```

Build all locales:
```bash
yarn build --locale en --locale ko
```

### Starting Development Server for a Specific Locale

Start with Korean locale:
```bash
yarn start --locale ko
```

## Project Structure

```
website/
├── docs/                   # English documentation
│   ├── intro.md
│   ├── api/
│   │   ├── overview.md
│   │   └── errors.md
│   ├── concepts/
│   │   ├── dependencies.md
│   │   └── mathematical-analysis.md
│   └── examples/
│       └── basic.md
├── i18n/
│   └── ko/                # Korean translations
│       ├── code.json
│       ├── docusaurus-plugin-content-docs/
│       │   └── current/
│       │       └── intro.md
│       └── docusaurus-theme-classic/
│           ├── navbar.json
│           └── footer.json
├── src/
│   └── css/
│       └── custom.css
├── static/
│   └── img/
├── docusaurus.config.ts   # Site configuration
├── sidebars.ts            # Sidebar configuration
└── package.json
```

## Adding New Documentation

1. Add your new documentation file to the `docs/` directory
2. The sidebar will automatically pick up new files
3. For Korean translations, create corresponding files in `i18n/ko/docusaurus-plugin-content-docs/current/`

## Contributing

When contributing documentation:

1. Write the English version in `docs/`
2. Add Korean translation in `i18n/ko/docusaurus-plugin-content-docs/current/`
3. Test both locales locally before submitting
