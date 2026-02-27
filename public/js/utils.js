// ===========================================================================
// Utility Functions — Common helpers for client-side code
// ===========================================================================

(function (global) {
  'use strict';

  /**
   * Escapes HTML special characters to prevent XSS attacks
   * @param {string} str - String that may contain HTML
   * @returns {string} - HTML-safe string
   */
  global.escapeHTML = function (str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  /**
   * Safely sets text content (alternative to innerHTML)
   * @param {HTMLElement} element - Target element
   * @param {string} text - Text content to set
   */
  global.setText = function (element, text) {
    element.textContent = text || '';
  };

  /**
   * Creates an element with optional class and text content
   * @param {string} tag - HTML tag name
   * @param {string} className - CSS class(es) to add
   * @param {string} text - Text content (will be escaped)
   * @returns {HTMLElement}
   */
  global.createElement = function (tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  /**
   * Sanitizes a URL to prevent javascript: protocol XSS
   * @param {string} url - URL to sanitize
   * @returns {string} - Safe URL or empty string
   */
  global.sanitizeURL = function (url) {
    if (!url) return '';
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
      return '';
    }
    return url;
  };

})(window);
