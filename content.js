(function () {
  'use strict';

  const CONFIG = {
    TELEGRAM_HOSTS: new Set([
      't.me',
      'telegram.me',
      'telegram.dog',
      'www.t.me',
      'www.telegram.me',
      'www.telegram.dog',
    ]),

    RESERVED_PATHS: new Set([
      'joinchat',
      'proxy',
      'login',
      's', // /s/username redirects to /username
      'iv',
      'share',
      'addstickers',
      'addtheme',
      'addemoji',
      'bg',
      'contact',
      'c',
      'a',
      'k',
    ]),

    USERNAME_PATTERN: /^[a-zA-Z0-9_]{3,}$/,

    MUTATION_DEBOUNCE_MS: 16, // ~60fps
  };

  /**
   * Check if hostname belongs to Telegram
   * @param {string} hostname - The hostname to check
   * @returns {boolean}
   */
  function isTelegramHost(hostname) {
    return CONFIG.TELEGRAM_HOSTS.has(hostname?.toLowerCase() || '');
  }

  /**
   * Safely encode URI component with fallback
   * @param {string} str - String to encode
   * @returns {string}
   */
  function safeEncodeURIComponent(str) {
    try {
      return encodeURIComponent(str);
    } catch (error) {
      console.warn('Failed to encode URI component:', str, error);
      return str;
    }
  }

  /**
   * Build deep link URL from Telegram web URL
   * @param {URL} urlObj - Parsed URL object
   * @returns {string|null} - Deep link or null if not convertible
   */
  function builddeepLink(urlObj) {
    try {
      const pathParts = urlObj.pathname
        .split('/')
        .filter((part) => part.length > 0);

      if (pathParts.length === 0) return null;

      let [firstPart, secondPart] = pathParts;
      const params = new URLSearchParams(urlObj.search);

      if (firstPart.toLowerCase() === 's' && secondPart) {
        firstPart = secondPart;
      }

      if (firstPart.toLowerCase() === 'contact' && secondPart) {
        return `tg://contact?token=${safeEncodeURIComponent(secondPart)}`;
      }

      if (firstPart.toLowerCase() === 'bg' && secondPart) {
        let deepLink = `tg://bg?slug=${safeEncodeURIComponent(secondPart)}`;
        const mode = params.get('mode');
        if (mode) {
          deepLink += `&mode=${safeEncodeURIComponent(mode)}`;
        }
        return deepLink;
      }

      // Handle phone numbers: /+1234567890
      if (firstPart.startsWith('+')) {
        const phoneNumber = firstPart.slice(1); // Remove '+' prefix
        if (!phoneNumber) return null;

        let deepLink = `tg://resolve?phone=${safeEncodeURIComponent(
          phoneNumber
        )}`;

        if (params.has('text')) {
          deepLink += `&text=${safeEncodeURIComponent(params.get('text'))}`;
        }
        if (params.has('profile')) {
          deepLink += '&profile=1';
        }

        return deepLink;
      }

      const normalizedFirst = firstPart.toLowerCase();
      if (
        !CONFIG.RESERVED_PATHS.has(normalizedFirst) &&
        CONFIG.USERNAME_PATTERN.test(firstPart)
      ) {
        let deepLink = `tg://resolve?domain=${safeEncodeURIComponent(
          firstPart
        )}`;

        if (params.has('text')) {
          deepLink += `&text=${safeEncodeURIComponent(params.get('text'))}`;
        }
        if (params.has('profile')) {
          deepLink += '&profile=1';
        }

        return deepLink;
      }

      return null;
    } catch (error) {
      console.warn('Error building deep link for URL:', urlObj.href, error);
      return null;
    }
  }

  /**
   * Convert single anchor element to deep link if applicable
   * @param {HTMLAnchorElement} anchor - The anchor element to process
   * @returns {boolean} - True if link was modified
   */
  function convertAnchorToDeepLink(anchor) {
    if (!anchor?.href || anchor.tagName !== 'A') {
      return false;
    }

    if (anchor.href.startsWith('tg://')) {
      return false;
    }

    let urlObj;
    try {
      urlObj = new URL(anchor.href);
    } catch (error) {
      return false;
    }

    if (!isTelegramHost(urlObj.hostname)) {
      return false;
    }

    const deepLink = builddeepLink(urlObj);
    if (!deepLink) {
      return false;
    }

    if (anchor.href !== deepLink) {
      anchor.href = deepLink;
      return true;
    }

    return false;
  }

  /**
   * Process all anchor elements within a root element
   * @param {Element|Document} root - Root element to search within
   * @returns {number} - Number of links converted
   */
  function processAllAnchors(root = document) {
    let convertedCount = 0;

    try {
      const anchors = root.querySelectorAll('a[href]');
      for (const anchor of anchors) {
        if (convertAnchorToDeepLink(anchor)) {
          convertedCount++;
        }
      }
    } catch (error) {
      console.error('Error processing anchors:', error);
    }

    return convertedCount;
  }

  /**
   * Debounced mutation processor
   */
  let mutationTimeout;
  const pendingNodes = new Set();

  function processPendingMutations() {
    if (pendingNodes.size === 0) return;

    let processedCount = 0;
    for (const node of pendingNodes) {
      if (!document.contains(node)) continue;

      if (node.tagName === 'A') {
        if (convertAnchorToDeepLink(node)) {
          processedCount++;
        }
      } else {
        processedCount += processAllAnchors(node);
      }
    }

    pendingNodes.clear();

    if (processedCount > 0) {
      console.debug(`Telegram Deep Link: Converted ${processedCount} links`);
    }
  }

  function scheduleMutationProcessing() {
    if (mutationTimeout) return;

    mutationTimeout = setTimeout(() => {
      mutationTimeout = null;
      processPendingMutations();
    }, CONFIG.MUTATION_DEBOUNCE_MS);
  }

  /**
   * Handle DOM mutations
   * @param {MutationRecord[]} mutations - Array of mutation records
   */
  function handleMutations(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            pendingNodes.add(node);
          }
        }
      } else if (
        mutation.type === 'attributes' &&
        mutation.target.tagName === 'A' &&
        mutation.attributeName === 'href'
      ) {
        pendingNodes.add(mutation.target);
      }
    }

    if (pendingNodes.size > 0) {
      scheduleMutationProcessing();
    }
  }

  /**
   * Initialize the extension
   */
  function initialize() {
    try {
      const initialCount = processAllAnchors();
      if (initialCount > 0) {
        console.debug(
          `Telegram Deep Link: Initial conversion of ${initialCount} links`
        );
      }

      const observer = new MutationObserver(handleMutations);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href'],
      });

      window.addEventListener('beforeunload', () => {
        observer.disconnect();
        if (mutationTimeout) {
          clearTimeout(mutationTimeout);
        }
        pendingNodes.clear();
      });
    } catch (error) {
      console.error(
        'Failed to initialize Telegram Deep Link extension:',
        error
      );
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
