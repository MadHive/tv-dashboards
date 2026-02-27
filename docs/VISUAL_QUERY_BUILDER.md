# Visual Query Builder

## Overview

The Visual Query Builder is a React-based interface that allows users to build BigQuery SQL queries visually without writing code. It provides an intuitive drag-and-drop interface for selecting tables, columns, filters, and joins.

## Features

### 1. Table Selector
- Browse BigQuery datasets and tables
- Search functionality for quick table discovery
- Visual table cards showing column count
- Multi-table selection (up to 5 tables)
- Expandable dataset tree view

### 2. Column Picker
- Select columns from chosen tables via checkboxes
- Drag to reorder columns in SELECT clause
- Add column aliases (AS clause)
- Apply aggregation functions:
  - COUNT
  - SUM
  - AVG
  - MIN
  - MAX
- Visual configuration for each selected column

### 3. Filter Builder
- Visual WHERE clause builder
- Supported operators:
  - Equals (=)
  - Not Equals (!=)
  - Greater Than (>)
  - Less Than (<)
  - Greater or Equal (>=)
  - Less or Equal (<=)
  - LIKE
  - NOT LIKE
  - IN
  - NOT IN
  - BETWEEN
  - IS NULL
  - IS NOT NULL
- AND/OR logical operators
- Type-aware value inputs
- Dynamic filter addition/removal

### 4. Join Configuration
- Visual join builder for multi-table queries
- Join types:
  - INNER JOIN
  - LEFT JOIN
  - RIGHT JOIN
  - FULL OUTER JOIN
- Column-to-column mapping
- Visual join preview

### 5. SQL Preview
- Auto-generated SQL from visual selections
- Syntax highlighting
- Copy to clipboard
- Edit SQL manually (fallback to SQL mode)
- Real-time SQL generation

### 6. Query Results
- Test query execution
- Results table with pagination (50 rows per page)
- Row and column count display
- Error handling and display
- Save query workflow

## Usage

### Access the Query Builder

Navigate to: `http://tv.madhive.local/app/query-builder`

Or from the home page, click the "Visual Query Builder" card.

### Building a Query

1. **Select Tables**
   - Click to expand a dataset
   - Click on tables to select them (max 5)
   - Selected tables appear highlighted

2. **Select Columns**
   - Expand tables in the Column Picker
   - Check columns to include in SELECT
   - Optionally add aliases and aggregations
   - Use ↑↓ buttons to reorder columns

3. **Add Filters (Optional)**
   - Click "+ Add Filter"
   - Select column, operator, and value
   - Add multiple filters with AND/OR logic

4. **Configure Joins (Optional)**
   - Only shown when 2+ tables selected
   - Click "+ Add Join"
   - Select join type and column mappings

5. **Preview SQL**
   - SQL is auto-generated as you make selections
   - Click "Copy" to copy SQL to clipboard
   - Click "Edit SQL" to manually modify the query

6. **Test Query**
   - Click "Test Query" to execute
   - View results in the results panel
   - Results are paginated for readability

7. **Save Query**
   - Click "Save Query" button
   - Enter Query ID, Name, and Description
   - Query is saved to `config/queries.yaml`

### Keyboard Shortcuts

- **Ctrl/Cmd + C**: Copy SQL (when SQL preview is focused)

## Architecture

### Components

```
QueryBuilder (Page)
├── TableSelector
│   └── Card (UI component)
├── ColumnPicker
│   ├── Card
│   └── Badge
├── FilterBuilder
│   └── Card
├── JoinConfig
│   └── Card
├── SQLPreview
│   └── Card
└── QueryResults
    ├── Card
    └── Badge
```

### SQL Generation

The SQL generator (`src/lib/sql-generator.ts`) converts the visual state into valid BigQuery SQL:

- Escapes identifiers with backticks
- Properly handles string, number, boolean, and array values
- Builds complex WHERE clauses with proper parentheses
- Supports aggregation functions and GROUP BY
- Generates JOIN clauses with ON conditions
- Adds LIMIT clause

### API Integration

The Query Builder uses the existing API client (`src/lib/api.ts`) to:
- Fetch BigQuery schema: `GET /api/bigquery/schema`
- Execute queries: `POST /api/bigquery/execute`
- Save queries: `POST /api/queries/bigquery`

## Examples

### Example 1: Simple SELECT

**Visual Selections:**
- Table: `mad-master.analytics.events`
- Columns: `event_name`, `user_id`, `timestamp`
- Filter: `event_name = 'page_view'`
- Limit: 100

**Generated SQL:**
```sql
SELECT
  events.event_name,
  events.user_id,
  events.timestamp
FROM `mad-master.analytics.events`
WHERE event_name = 'page_view'
LIMIT 100
```

### Example 2: Aggregation with GROUP BY

**Visual Selections:**
- Table: `mad-master.analytics.events`
- Columns:
  - `event_name` (no aggregation)
  - `user_id` (aggregation: COUNT, alias: `user_count`)
- Limit: 100

**Generated SQL:**
```sql
SELECT
  events.event_name,
  COUNT(events.user_id) AS user_count
FROM `mad-master.analytics.events`
GROUP BY events.event_name
LIMIT 100
```

### Example 3: JOIN with Filters

**Visual Selections:**
- Tables:
  - `mad-master.analytics.users` (base)
  - `mad-master.analytics.events`
- Columns:
  - `users.name`
  - `events.event_name`
  - `events.timestamp`
- Join:
  - Type: INNER JOIN
  - Condition: `users.id = events.user_id`
- Filters:
  - `users.active = true` (AND)
  - `events.timestamp > '2024-01-01'`
- Limit: 100

**Generated SQL:**
```sql
SELECT
  users.name,
  events.event_name,
  events.timestamp
FROM `mad-master.analytics.users`
INNER JOIN `mad-master.analytics.events` ON users.id = events.user_id
WHERE users.active = true
  AND events.timestamp > '2024-01-01'
LIMIT 100
```

## Troubleshooting

### Schema Not Loading

If the schema doesn't load:
1. Check BigQuery authentication (Google OAuth)
2. Verify GCP project permissions
3. Check server logs: `tail -f server.log`
4. Try refreshing the page

### Query Execution Errors

Common errors:
- **Column not found**: Make sure column names match schema
- **Permission denied**: Check BigQuery IAM permissions
- **Syntax error**: Try editing SQL manually to fix
- **Timeout**: Query may be too complex, add more filters

### Empty Results

If query returns 0 rows:
- Check filter conditions
- Verify data exists in selected tables
- Try removing filters to see if data exists

## Future Enhancements

Potential improvements:
- [ ] ORDER BY visual builder
- [ ] HAVING clause for aggregations
- [ ] Subquery support
- [ ] Query templates
- [ ] Query history
- [ ] Export results to CSV
- [ ] Visual query diagram
- [ ] Smart column recommendations
- [ ] Query performance insights

## Related Documentation

- [BigQuery Guide](../BIGQUERY_GUIDE.md)
- [Data Sources](../DATASOURCES.md)
- [Query Management Architecture](../memory/MEMORY.md#query-management-architecture)
