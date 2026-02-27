# Admin Platform Components - Phase 1

Reusable UI components for building admin interfaces and wizards.

## Overview

Phase 1 provides four core components for building interactive admin workflows:

- **WizardFramework** - Multi-step wizard orchestrator
- **FormBuilder** - Dynamic form generation with validation
- **LivePreview** - Real-time dashboard preview component
- **DataSourceConnector** - Data source connection wizard

## Installation

Components are located in `public/js/components/` and can be imported as ES modules:

```javascript
import { WizardFramework } from '/js/components/wizard-framework.js';
import { FormBuilder } from '/js/components/form-builder.js';
import { LivePreview } from '/js/components/live-preview.js';
import { DataSourceConnector } from '/js/components/data-source-connector.js';
```

Include component CSS in your HTML:

```html
<link rel="stylesheet" href="/css/components/wizard.css">
<link rel="stylesheet" href="/css/components/form-builder.css">
<link rel="stylesheet" href="/css/components/live-preview.css">
<link rel="stylesheet" href="/css/components/data-source-connector.css">
```

## Components

### WizardFramework

Multi-step wizard orchestrator with navigation, validation, and step skipping.

**Features:**
- Step-by-step navigation with visual progress indicator
- Per-step validation
- Conditional step skipping
- Data persistence across steps
- Complete/cancel callbacks

**Usage:**

```javascript
const wizard = new WizardFramework({
  steps: [
    {
      id: 'step1',
      title: 'Basic Info',
      component: MyFormComponent,
      validate: (data) => data.name && data.email,
      skip: (data) => data.skipStep1  // Optional
    },
    {
      id: 'step2',
      title: 'Configuration',
      component: MyConfigComponent,
      validate: (data) => data.isValid
    }
  ],
  onComplete: (data) => {
    console.log('Wizard completed with data:', data);
  },
  onCancel: () => {
    console.log('Wizard cancelled');
  }
});

wizard.render(document.getElementById('wizard-container'));
```

**Methods:**
- `render(container)` - Render wizard in a container element
- `next()` - Move to next step (validates current step)
- `previous()` - Move to previous step
- `destroy()` - Clean up wizard and event listeners

**Properties:**
- `currentStepIndex` - Current step index (0-based)
- `currentStep` - Current step object
- `data` - Wizard data object (shared across steps)
- `isFirstStep` - Boolean: true if on first step
- `isLastStep` - Boolean: true if on last step

---

### FormBuilder

Dynamic form generation with validation from schema definitions.

**Features:**
- Dynamic form rendering from JSON schema
- Multiple field types: text, email, number, textarea, select
- Real-time validation
- Custom validators
- Required field indicators
- Help text support

**Usage:**

```javascript
const form = new FormBuilder({
  fields: [
    {
      id: 'name',
      type: 'text',
      label: 'Full Name',
      required: true,
      placeholder: 'John Doe',
      help: 'Enter your full legal name'
    },
    {
      id: 'email',
      type: 'email',
      label: 'Email Address',
      required: true,
      validate: (value) => {
        if (!value.endsWith('@company.com')) {
          return 'Must be a company email address';
        }
        return null;  // null means valid
      }
    },
    {
      id: 'age',
      type: 'number',
      label: 'Age',
      min: 18,
      max: 100
    },
    {
      id: 'role',
      type: 'select',
      label: 'Role',
      options: [
        { value: 'admin', label: 'Administrator' },
        { value: 'user', label: 'Standard User' }
      ]
    }
  ]
});

form.render(document.getElementById('form-container'));

// Get form data
const data = form.getData();

// Validate form
const result = form.validate(data);
if (result.valid) {
  console.log('Form is valid:', result.data);
} else {
  console.log('Form has errors:', result.errors);
  form.showErrors(result.errors);
}
```

**Methods:**
- `render(container)` - Render form in a container element
- `validate(data)` - Validate data against schema, returns `{valid, errors, data}`
- `getData()` - Get current form data
- `setData(data)` - Set form field values
- `showErrors(errors)` - Display validation errors
- `reset()` - Clear all form data and errors
- `destroy()` - Clean up form and event listeners

**Field Types:**
- `text` - Single-line text input
- `email` - Email input with validation
- `number` - Number input with min/max support
- `textarea` - Multi-line text input (supports `rows` property)
- `select` - Dropdown select (supports `options` array)

---

### LivePreview

Real-time dashboard preview component with size and mode controls.

**Features:**
- Preview placeholder for dashboards
- Size variants: mobile, tablet, desktop, TV
- Mode toggle: sample vs live data
- Clean, modern styling

**Usage:**

```javascript
const preview = new LivePreview({
  mode: 'sample',  // 'sample' or 'live'
  size: 'desktop', // 'mobile', 'tablet', 'desktop', 'tv'
  dashboardId: 'my-dashboard'
});

preview.render(document.getElementById('preview-container'));

// Update mode
preview.setMode('live');

// Update size
preview.setSize('tv');
```

**Methods:**
- `render(container)` - Render preview in a container element
- `setMode(mode)` - Set preview mode ('sample' or 'live')
- `setSize(size)` - Set preview size ('mobile', 'tablet', 'desktop', 'tv')
- `destroy()` - Clean up preview

---

### DataSourceConnector

Multi-step wizard for connecting to data sources.

**Features:**
- Three-step wizard: Select → Configure → Test
- Dynamic form fields based on source type
- Built-in validation for connection parameters
- Supports BigQuery, GCP Monitoring, Mock sources

**Usage:**

```javascript
const connector = new DataSourceConnector({
  availableSources: [
    { id: 'bigquery', name: 'Google BigQuery' },
    { id: 'gcp-monitoring', name: 'GCP Cloud Monitoring' },
    { id: 'mock', name: 'Mock Data' }
  ],
  onConnect: (data) => {
    console.log('Connected with config:', data);
    // data = { sourceType, name, projectId, ... }
  },
  onCancel: () => {
    console.log('Connection cancelled');
  }
});

connector.render(document.getElementById('connector-container'));
```

**Methods:**
- `render(container)` - Render connection wizard
- `destroy()` - Clean up connector

**Supported Data Sources:**
- **BigQuery**: requires name, projectId, optional dataset/location
- **GCP Monitoring**: requires name, projectId, optional refreshInterval
- **Mock**: requires name, optional delay/errorRate

---

## Component Composition

Components are designed to work together:

```javascript
// Example: FormBuilder inside WizardFramework
class MyFormStep {
  constructor(data) {
    this.data = data;
    this.form = new FormBuilder({ fields: [...] });
  }

  render(container) {
    this.form.render(container);
    if (this.data.existingValues) {
      this.form.setData(this.data.existingValues);
    }
  }
}

const wizard = new WizardFramework({
  steps: [{
    id: 'form-step',
    title: 'Enter Details',
    component: MyFormStep,
    validate: (data) => {
      // Access form data from wizard.data
      return data.name && data.email;
    }
  }],
  onComplete: (data) => console.log(data)
});
```

## Demo

See `/demo-wizard-integration.html` for a complete working example showing all components integrated together in a dashboard setup wizard.

## Best Practices

1. **Always clean up**: Call `destroy()` on components when removing them from the DOM to prevent memory leaks

2. **Validate before submit**: Use FormBuilder's `validate()` method before processing form data

3. **Handle errors**: All callbacks (onComplete, onCancel, custom validators) should have error handling

4. **Use safe DOM**: Components use safe DOM methods internally - avoid innerHTML with untrusted content

5. **Pre-fill data**: Use `setData()` to pre-fill forms when editing existing records

6. **Test validation**: Always test custom validators with edge cases (null, undefined, empty strings)

## Testing

All components have unit tests in `tests/components/`. Run tests with:

```bash
bun test tests/components/wizard-framework.test.js
bun test tests/components/form-builder.test.js
bun test tests/components/data-source-connector.test.js
```

## Styling

Components use a consistent design system with:
- Colors from Tailwind CSS palette
- 8px grid system
- Focus states with blue (#3b82f6) highlights
- Error states in red (#ef4444)
- Rounded corners (6-8px border-radius)

Override styles by adding custom CSS after component stylesheets.

## Accessibility

Components include basic accessibility features:
- Proper `<label>` elements with `for` attributes
- Required field indicators (*)
- Error messages associated with fields
- Focus states on interactive elements
- Semantic HTML structure

For production use, consider adding:
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader announcements
- High contrast mode support

## Browser Support

Components use modern JavaScript (ES6 modules) and require:
- ES6 module support
- DOM APIs (createElement, classList, etc.)
- No transpilation needed for modern browsers (Chrome 90+, Firefox 88+, Safari 15+)

## Contributing

When adding new components:
1. Follow the existing naming conventions
2. Use safe DOM methods (no innerHTML)
3. Include `destroy()` method for cleanup
4. Write tests in `tests/components/`
5. Document API in this README
6. Add demo examples

## License

Part of the MadHive TV Dashboards project.
