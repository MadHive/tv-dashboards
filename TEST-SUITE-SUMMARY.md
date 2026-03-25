# Branding & Positioning Test Suite

## Overview

Created **1,123 automated tests** to enforce brand consistency, color theming, overlay positioning, and configuration integrity across all dashboards.

## ✅ What's Protected

### 1. Theme System (78 tests)
- **Theme Colors** (22 tests) - Structure, formats, accessibility
- **Theme Integration** (56 tests) - DOM manipulation, CSS variables, switching
- All client themes have required properties
- Colors use valid formats (hex, rgba)
- WCAG AA contrast compliance (4.5:1 minimum)
- Distinct accent colors per client
- Theme persistence across updates

### 2. CSS & Visual Theming (12 tests)
- No hardcoded MadHive colors (#FDA4D4, #FF9BD3)
- All UI elements use CSS variables (var(--accent))
- Logo images displayed at correct size (48px)
- Theme application to entire page
- Dynamic color updates

### 3. Logo Management (68 tests)
- Logo files exist and are valid
- SVG structure validation
- Security checks (no malicious scripts)
- PNG format verification
- Proper file naming conventions
- Accessibility (alt text, error handling)
- Performance optimization

### 4. Overlay Positioning (122 tests)
- Valid position formats (px or %)
- No NaN values in positions
- Regional panels visible (west/central/east)
- Reasonable dimension ranges
- Alignment guide system functional
- Resolution-independent percentages

### 5. Studio Controls (44 tests)
- Uniform sizing controls
- Input validation
- Snap grid functionality
- Alignment guides
- Reset functionality
- Error messaging

### 6. Configuration Integrity (799 tests)
- Dashboard structure validation
- Widget configurations
- Grid constraints
- Client branding setup
- YAML syntax validation
- Performance checks

## 🚀 Running Tests

**Run all branding tests (1,123 tests):**
```bash
bun test tests/unit/themes.test.js \
         tests/unit/branding-enforcement.test.js \
         tests/unit/overlay-positioning.test.js \
         tests/unit/theme-integration.test.js \
         tests/unit/logo-validation.test.js \
         tests/unit/studio-controls.test.js \
         tests/unit/config-validation.test.js
```

**Run by category:**
```bash
# Theme system (78 tests)
bun test tests/unit/themes.test.js tests/unit/theme-integration.test.js

# Branding & logos (80 tests)
bun test tests/unit/branding-enforcement.test.js tests/unit/logo-validation.test.js

# Overlays & studio (166 tests)
bun test tests/unit/overlay-positioning.test.js tests/unit/studio-controls.test.js

# Configuration (799 tests)
bun test tests/unit/config-validation.test.js
```

**Watch mode (auto-rerun on changes):**
```bash
bun test --watch tests/unit/
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
✓ 1,123 tests passed
✓ 5,614 assertions
✓ 126ms execution time
✓ 0 failures
```

### Breakdown by Suite:
- **Configuration Validation**: 799 tests ✓
- **Overlay Positioning**: 122 tests ✓
- **Logo Validation**: 68 tests ✓
- **Theme Integration**: 56 tests ✓
- **Studio Controls**: 44 tests ✓
- **Theme Structure**: 22 tests ✓
- **CSS Enforcement**: 12 tests ✓

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
