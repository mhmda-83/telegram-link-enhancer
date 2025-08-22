# Telegram Link Enhancer

A lightweight Chrome extension that automatically converts Telegram web links (t.me, telegram.me, telegram.dog) to deep links (tg:// protocol) for seamless desktop app integration.

## Features

- **Universal Link Detection**: Monitors all web pages for Telegram links using efficient DOM observation
- **Real-time Conversion**: Automatically transforms web links to deep links without page refresh
- **Protocol Support**: Handles usernames, phone numbers, contact tokens, background themes, and channel invites
- **Performance Optimized**: Debounced mutation processing and minimal DOM queries
- **Zero Dependencies**: Pure JavaScript implementation with no external libraries
- **Privacy Focused**: Runs locally with no data collection or external API calls

## Technical Details

- **Content Script** injection with `document_start` timing for early DOM access
- **MutationObserver** API for dynamic content monitoring
- **Debounced Processing** (16ms) for optimal performance on dynamic sites
- **Memory Management** with proper cleanup and observer disconnection

## Supported URL Patterns

- `t.me/username` → `tg://resolve?domain=username`
- `t.me/+1234567890` → `tg://resolve?phone=1234567890`  
- `t.me/contact/token` → `tg://contact?token=token`
- `t.me/bg/slug` → `tg://bg?slug=slug`
- Query parameter preservation for `text` and `profile` parameters

## Installation

1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory