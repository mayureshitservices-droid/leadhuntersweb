# Implementation Plan: Mobile Card View for Super Admin

Refactor the Super Admin dashboard to use a mobile-friendly card layout for Customers and Telecallers, replacing horizontal tables on small screens to improve usability and data density.

## User Review Required

> [!IMPORTANT]
> The Alpine.js logic will be shared between the table rows (desktop) and mobile cards. This ensures that actions like inline editing and status toggling remain functional in both views without breaking the desktop experience.

## Proposed Changes

### Dashboard Refinement

#### [MODIFY] [admin_dashboard.ejs](file:///d:/Jack/Projects/leadHuntersWeb/src/views/admin_dashboard.ejs)

- **Customers Tab**:
    - Hide the existing table on mobile using `hidden md:table`.
    - Create a new loop (`<% businessOwners.forEach(...) %>`) inside a `md:hidden` div that renders each customer as a shadow-sm card.
    - Each card will display:
        - **Header**: Business Owner Name & Status Badge.
        - **Body**: Email and Mobile No (as clickable links).
        - **Footer**: Payment Terms and Action Buttons (Edit, Deactivate, Delete).
- **Telecallers Tab**:
    - Hide the existing table on mobile.
    - Create a card layout that summarizes the Device Alias, Model Name, and ID.
    - Include a prominent "Assign" button for mobile users.

## Verification Plan

### Manual Verification
1.  Toggle browser DevTools to mobile mode (Phone resolution).
2.  Verify the horizontal tables disappear and are replaced by clean, stacked cards.
3.  Test one **Status Toggle** on a mobile card to ensure the Alpine.js state updates accurately.
4.  Test **Edit** on mobile to ensure the inline inputs appear correctly within the card layout.
5.  Switch back to Desktop view to confirm zero regressions in the table layout.
