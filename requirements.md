# Expense & Budget Visualizer - Specifications

## Project Overview
Mobile-friendly Expense & Budget Visualizer web application built with HTML, CSS, and Vanilla JavaScript using Local Storage and Chart.js.

## Technical Constraints
- **TC-1 (Technology Stack)**: HTML, CSS (`css/style.css`), Vanilla JavaScript (`js/app.js`), no backend required.
- **TC-2 (Data Storage)**: Browser `localStorage` API (client-side only).
- **TC-3 (Browser Compatibility)**: Works across modern browsers (Chrome, Firefox, Edge, Safari) on desktop and mobile.

## Non-Functional Requirements
- **NFR-1 (Simplicity)**: Clean, minimal interface; zero build/test setup required.
- **NFR-2 (Performance)**: Instant UI updates and responsive interactions.
- **NFR-3 (Visual Design)**: Clear hierarchy, readable typography, accessible color contrast.

## Implemented MVP Features
1. **Input Form**: Item Name, Amount, Category (Food, Transport, Fun + custom categories), and Date with validation.
2. **Transaction List**: Scrollable list showing item name, amount, category badge, date, and delete button.
3. **Total Balance**: Real-time total spending display at the top with automatic updates.
4. **Visual Chart**: Dynamic Chart.js doughnut/pie chart displaying spending distribution by category.

## Implemented Optional Challenges
1. **Allow users to add custom categories**
2. **Monthly summary view** (Filter by month + monthly metrics breakdown)
3. **Sort transactions by amount or category** (Plus newest/oldest sorting)
4. **Highlight spending over a set limit** (Configurable threshold alert & visual highlight)
5. **Dark/light mode toggle** (Persisted in `localStorage`)
