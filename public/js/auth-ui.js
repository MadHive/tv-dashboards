// ===========================================================================
// Auth UI — Google OAuth authentication interface
// ===========================================================================

window.AuthUI = (function () {
  'use strict';

  class AuthUI {
    constructor() {
      this.currentUser = null;
      this.authButton = null;

      this.createAuthButton();
      this.checkAuth();
    }

    createAuthButton() {
      this.authButton = document.createElement('button');
      this.authButton.id = 'auth-button';
      this.authButton.className = 'auth-button';
      this.authButton.style.display = 'none';
      document.body.appendChild(this.authButton);

      this.authButton.addEventListener('click', () => {
        if (this.currentUser) {
          this.showUserMenu();
        } else {
          this.login();
        }
      });
    }

    async checkAuth() {
      try {
        const response = await fetch('/auth/google/me');

        if (response.ok) {
          const user = await response.json();
          this.setUser(user);
        } else {
          this.setUser(null);
        }
      } catch (error) {
        console.error('[Auth] Failed to check authentication:', error);
        this.setUser(null);
      }
    }

    setUser(user) {
      this.currentUser = user;
      this.updateAuthButton();

      // Dispatch event for other components
      document.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: { user: this.currentUser }
      }));
    }

    updateAuthButton() {
      if (!this.authButton) return;

      // Clear existing content
      while (this.authButton.firstChild) {
        this.authButton.removeChild(this.authButton.firstChild);
      }

      if (this.currentUser) {
        // Show user avatar/name
        const avatar = document.createElement('img');
        avatar.className = 'auth-avatar';
        avatar.src = sanitizeURL(this.currentUser.picture);
        avatar.alt = this.currentUser.name || 'User';
        this.authButton.appendChild(avatar);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'auth-name';
        nameSpan.textContent = this.currentUser.name || 'User';
        this.authButton.appendChild(nameSpan);

        this.authButton.title = `Logged in as ${this.currentUser.email || ''}`;
      } else {
        // Show login button
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z');
        svg.appendChild(path);
        this.authButton.appendChild(svg);

        const span = document.createElement('span');
        span.textContent = 'Sign In';
        this.authButton.appendChild(span);

        this.authButton.title = 'Sign in with Google';
      }

      this.authButton.style.display = 'flex';
    }

    login() {
      window.location.href = '/auth/google/login';
    }

    logout() {
      window.location.href = '/auth/google/logout';
    }

    showUserMenu() {
      // Create simple dropdown menu
      const menu = document.createElement('div');
      menu.className = 'auth-menu';
      menu.innerHTML = `
        <div class="auth-menu-item" onclick="window.authUI.logout()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </div>
      `;

      // Position menu below button
      const rect = this.authButton.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = (rect.bottom + 8) + 'px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';

      document.body.appendChild(menu);

      // Close menu when clicking outside
      const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== this.authButton) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };

      setTimeout(() => {
        document.addEventListener('click', closeMenu);
      }, 100);
    }
  }

  return AuthUI;
})();

// Initialize auth UI on page load
window.addEventListener('DOMContentLoaded', () => {
  window.authUI = new window.AuthUI();
});
