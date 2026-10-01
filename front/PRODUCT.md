# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Angular 22, client-side only (no SSR), standalone components, lazy-loaded routes, state in `signal()`. Confirmed in Docs/DOCUMENTACION_CORREGIDA.md.

## Users
Owners and staff of small businesses (pymes) in Colombia. Non-technical people at a counter or in a stockroom, often in a hurry, on desktop or tablet. Roles: `erp_admin`, `erp_ventas`, `erp_inventario`; one person may hold several.

## Product Purpose
InSync is a multi-tenant ERP: inventory (productos), sales (ventas) and user management, one Flask backend instance per tenant. Success: a clerk registers a sale or adjusts stock in a few clicks without training.

## Positioning
Each tenant is its own isolated instance; the interface always states which company you are operating in.

## Operating Context
Modules: autenticacion, gestion-inventarios, gestion-ventas, gestion-usuarios. Backend data is in memory (lost on restart). Keycloak login is not wired into this phase: the frontend runs in demo mode with local in-memory data so navigation can be tested.

## Capabilities and Constraints
- Productos: list with page/size, create (unique codigo), update precio/stock. Only erp_inventario writes.
- Ventas: lines (producto, cantidad), total, stock deduction; history filterable by date range. erp_ventas registers; erp_admin reads history.
- Usuarios: erp_admin only; creation and tenant groups are pending on the backend.
- Currency COP; Spanish (es-CO) UI copy.
- Tenants shown are synthetic demo data.

## Brand Commitments
Name: InSync. Visual system pinned by Docs/MASTER.md (navy + green, Lexend + Source Sans 3, Swiss minimalism, light mode, SVG icons, reduced motion respected).

## Evidence on Hand
No real customers, logos or metrics. Do not invent any.

## Product Principles
1. Task before decoration: every screen is a working tool.
2. Always show the active tenant and what the current role may do.
3. Numbers are exact and scannable (tabular COP).
4. Errors name the problem and the fix.

## Accessibility & Inclusion
WCAG AA contrast, visible focus, keyboard-operable, prefers-reduced-motion.
