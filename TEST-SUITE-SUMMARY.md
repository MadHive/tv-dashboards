# Branding & Positioning Test Suite

## Overview

Created **156 automated tests** to enforce brand consistency, color theming, and overlay positioning across all dashboards.

## ✅ What's Protected

### 1. Theme Colors (22 tests)
- All client themes have required properties
- Colors use valid formats (hex, rgba)
- Sufficient contrast for accessibility
- Distinct accent colors per client

### 2. CSS Theming (12 tests)
- No hardcoded MadHive colors (#FDA4D4, #FF9BD3)
- All UI elements use CSS variables (var(--accent))
- Logo images displayed at correct size (48px)
- Theme application to entire page

### 3. Overlay Positioning (122 tests)
- Valid position formats (px or %)
- No NaN values in positions
- Regional panels visible (west/central/east)
- Reasonable dimension ranges
- Alignment guide system functional

## 🚀 Running Tests

**Run all branding tests:**
```bash
bun test tests/unit/themes.test.js tests/unit/branding-enforcement.test.js tests/unit/overlay-positioning.test.js
```

**Run specific suite:**
```bash
bun test tests/unit/themes.test.js           # Theme structure
bun test tests/unit/branding-enforcement.test.js  # CSS enforcement
bun test tests/unit/overlay-positioning.test.js   # Map overlays
```

**Watch mode (auto-rerun on changes):**
```bash
bun test --watch tests/unit/themes.test.js
```

## 🎯 What Gets Caught

### ❌ Hardcoded Colors
```css
/* BAD - Test will fail */
.nav-dot.active {
  background: #FDA4D4;  /* Hardcoded pink */
}

/* GOOD - Test passes */
.nav-dot.active {
  background: var(--accent);  /* Theme variable */
}
```

### ❌ Missing Theme Properties
```javascript
// BAD - Test will fail
const fox = {
  name: 'FOX',
  bg: '#00263E'
  // Missing: accent, logoText, etc.
}

// GOOD - Test passes
const fox = {
  name: 'FOX',
  logoText: 'FOX',
  logoSub: 'CORPORATION',
  bg: '#00263E',
  accent: '#D2232B',
  logoImage: '/img/fox-logo.svg'
  // ... all required properties
}
```

### ❌ Invalid Overlay Positions
```yaml
# BAD - Test will fail
overlayPositions:
  east:
    top: NaN%      # Invalid NaN value
    left: 52.10%

# GOOD - Test passes
overlayPositions:
  east:
    top: 2.62%
    left: 52.10%
    width: 160px
    height: 115px
```

## 📊 Test Results

```
✓ 156 tests passed
✓ 381 expect() assertions
✓ 71ms execution time
```

### Breakdown:
- **Theme System**: 22 tests ✓
- **CSS Enforcement**: 12 tests ✓
- **Overlay Positioning**: 122 tests ✓

## 🔧 CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Branding Tests
  run: |
    bun test tests/unit/themes.test.js \
             tests/unit/branding-enforcement.test.js \
             tests/unit/overlay-positioning.test.js
```

## 📚 Documentation

See `tests/unit/README-BRANDING-TESTS.md` for:
- Detailed test descriptions
- Common failure scenarios
- How to add new tests
- Pre-commit hook setup

## 🐛 Found Issues (Already Fixed)

The tests immediately found and we fixed:
1. **Hardcoded colors in mapbox-map.css**
   - Leaderboard bar gradient
   - Region panel gradients
   - Region impression text color

2. **Missing visibility flags**
   - Campaign Delivery dashboard missing region flags

## 🎨 Client Themes Protected

- ✓ MadHive Brand
- ✓ FOX Corporation
- ✓ iHeart Media
- ✓ Hearst
- ✓ Nexstar
- ✓ EW Scripps
- ✓ Cox Media Group

## 🔮 Future Enhancements

Consider adding:
- Visual regression tests (Percy, Chromatic)
- Logo file existence validation
- Theme contrast ratio calculations (WCAG AA/AAA)
- Automated screenshot comparisons

## Questions?

See test files for detailed inline documentation:
- `tests/unit/themes.test.js`
- `tests/unit/branding-enforcement.test.js`
- `tests/unit/overlay-positioning.test.js`
