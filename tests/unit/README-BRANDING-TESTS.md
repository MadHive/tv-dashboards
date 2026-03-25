# Branding & Positioning Test Suite

This test suite enforces brand consistency, color theming, and overlay positioning across the TV dashboards platform.

## Test Coverage

### 1. Theme System Tests (`themes.test.js`)

Validates the theme color system to ensure:

- **Theme Structure**: All themes have required color properties
- **Client Branding**: Logo paths and metadata are correctly configured
- **Color Accessibility**: Text colors provide sufficient contrast
- **CSS Variable Mapping**: All theme properties map to CSS variables

**What it catches:**
- Missing theme properties
- Invalid color formats
- Insufficient color contrast
- Broken logo paths

### 2. Branding Enforcement Tests (`branding-enforcement.test.js`)

Ensures CSS and JavaScript code follows theming best practices:

- **CSS Theming**: No hardcoded MadHive colors in stylesheets
- **Logo Display**: Client logos shown at correct size (48px height)
- **Header Branding**: Theme colors applied to entire page
- **Theme Consistency**: All UI elements use themeable variables

**What it catches:**
- Hardcoded colors like `#FDA4D4` instead of `var(--accent)`
- References to `--mh-pink` or `--mh-hot-pink` outside :root
- Missing CSS variable assignments
- Incorrect logo dimensions

### 3. Overlay Positioning Tests (`overlay-positioning.test.js`)

Validates map overlay configurations and positioning:

- **Position Format**: Overlays use valid px or % values
- **No NaN Values**: Positions don't contain NaN (from invalid calculations)
- **Regional Panels**: West/Central/East visibility flags are set
- **Uniform Sizing**: Studio controls for standardizing panel sizes
- **Alignment Guides**: Visual guides for precise positioning

**What it catches:**
- Invalid position formats
- NaN values in overlay positions
- Missing visibility flags
- Out-of-range position values
- Missing alignment guide functionality

## Running the Tests

### Run all branding tests:
```bash
bun test tests/unit/themes.test.js tests/unit/branding-enforcement.test.js tests/unit/overlay-positioning.test.js
```

### Run specific test suite:
```bash
bun test tests/unit/themes.test.js
```

### Watch mode (re-run on file changes):
```bash
bun test --watch tests/unit/
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run branding tests
  run: bun test tests/unit/themes.test.js tests/unit/branding-enforcement.test.js tests/unit/overlay-positioning.test.js
```

## Test Scenarios

### ✅ Valid Theme Configuration
```javascript
{
  name: 'FOX',
  logoText: 'FOX',
  logoSub: 'CORPORATION',
  bg: '#00263E',
  accent: '#D2232B',
  logoImage: '/img/fox-logo.svg'
}
```

### ❌ Invalid Theme (Will Fail)
```javascript
{
  name: 'FOX',
  // Missing logoText, logoSub
  bg: 'blue', // Invalid hex format
  accent: '#D2232B'
  // Missing logoImage
}
```

### ✅ Valid Overlay Position
```yaml
overlayPositions:
  east:
    top: 2.62%
    left: 52.10%
    width: 160px
    height: 115px
```

### ❌ Invalid Overlay Position (Will Fail)
```yaml
overlayPositions:
  east:
    top: NaN%        # Invalid NaN value
    left: -50px      # Negative position (allowed but warns)
    width: 50px      # Too small (< 100px)
```

## Adding New Tests

When adding new client themes or features:

1. **New Theme**: Add to the THEMES object in `themes.test.js`
2. **New CSS File**: Add to `cssFiles` array in `branding-enforcement.test.js`
3. **New Overlay Type**: Add validation in `overlay-positioning.test.js`

## Common Failures & Fixes

### "Found hardcoded MadHive colors"
**Fix**: Replace `#FDA4D4` with `var(--accent)` in CSS

### "Logo image height should be 48px"
**Fix**: Update logo styling in `public/js/app.js` to use `height:48px`

### "Missing theme property: accent"
**Fix**: Add all required color properties to theme definition

### "NaN value in overlay position"
**Fix**: Check overlay position calculations in Studio, ensure valid numbers

## Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
echo "Running branding tests..."
bun test tests/unit/themes.test.js tests/unit/branding-enforcement.test.js
if [ $? -ne 0 ]; then
  echo "❌ Branding tests failed. Fix errors before committing."
  exit 1
fi
```

## Maintenance

- **Update themes**: When adding new client themes, update `THEMES` object in tests
- **Update CSS variables**: If adding new CSS variables, update validation tests
- **Update overlay types**: Add new overlay types to position validation

## Questions?

See main test README at `tests/README.md` or ask the platform team.
