# Accessibility Guidelines

## WCAG 2.1 AA Compliance

The Data Explorer meets WCAG 2.1 AA standards:

### Keyboard Navigation
- **Arrow keys**: Navigate query list
- **Enter**: Execute selected query
- **Escape**: Clear search input (future)
- **Tab**: Navigate between sections

### Screen Reader Support
- All inputs have labels (visible or visually-hidden)
- Loading states announce via `aria-live="polite"`
- Errors announce via `aria-live="assertive"`
- Table has caption describing data source and row count
- Query list has `role="listbox"` and items have `role="option"`

### Color Contrast
- All text meets 4.5:1 contrast ratio
- Body text: madhive-chalk/90 (improved from /80)
- Muted text: madhive-chalk/60
- Focus indicators: madhive-pink (high contrast)

### Focus Management
- Clear focus rings on all interactive elements
- Focus moves to results after query execution
- Tab order is logical (header → search → list → results → actions)

## Testing

### Manual Testing
1. **Keyboard only**: Navigate entire page without mouse
2. **Screen reader**: Test with VoiceOver (macOS) or NVDA (Windows)
3. **Color contrast**: Verify with browser DevTools
4. **Zoom**: Test at 200% zoom level

### Automated Testing
- Use axe DevTools browser extension
- Run Lighthouse accessibility audit

## Known Limitations
- GCP metric queries timeout (>30s) - temporarily disabled
- Large tables (1000+ rows) may impact performance
