# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a simple static website for Rosehip Studio - a single-page HTML site with no build system or dependencies. The entire website is contained in `index.html` with embedded CSS and JavaScript.

**Repository URL**: https://github.com/lorenka/rosehip-studio

## Architecture

The website uses a configuration-driven approach with all content and styling controlled through the `SITE_CONFIG` object in `index.html:25-68`. Key architectural elements:

- **Single HTML File**: Everything is contained in `index.html` - no separate CSS/JS files
- **Configuration System**: Content, colors, and social links are managed through `SITE_CONFIG`
- **Color Schemes**: Dynamic theming system using predefined color schemes (rose, blue, green, purple, orange, teal)
- **Responsive Design**: Built with Tailwind CSS from CDN for mobile-first responsive layout
- **Client-Side Rendering**: JavaScript dynamically populates content from configuration on page load

## Key Configuration Areas

- **Theme Settings**: `colorScheme` property controls site-wide color palette
- **Content Management**: Hero text, services, about section, and social links all configurable
- **Logo/Wordmark**: Toggle between text or image logo via `useImageLogo` setting
- **Analytics**: Commented-out Google Analytics setup ready for implementation

## Development Workflow

Since this is a static site with no build process:
- Open `index.html` directly in browser for testing
- All changes are made directly to the HTML file
- No installation, build, or deployment commands needed
- Simply modify the `SITE_CONFIG` object for content changes

## Social Integration

The site includes dynamic social media links and a Substack newsletter embed. Social links are configured in `SITE_CONFIG.socialLinks` and automatically applied to the Connect section.