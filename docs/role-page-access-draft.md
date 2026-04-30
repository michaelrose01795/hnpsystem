# Role Page Access Draft

!!!!!!ONCE CHANGED HAVE CODEX UPDATE THE LOGINPRESENTATION PAGE AS WELL AS THE ORDER AND ACCESS WHICH THAT USER SELECTED HAS THE PRESENTATION GO IN!!!!!!!!!!!!!!!

TODO!!!!!!!!!!!!!
FIX IT SO THESE PAGES within the Role Page Access Draft file USE THE EXACT SAME FILE AS THE PAGES UI STYLE, ATM WHEN A PAGE UI IS UPDATED THIS DOESNT UPDATE THE UI WITHIN THE PRESENTATION PAGE, FIX THIS. make sure the ui files of every page has all of the buttons in the same position, every card, every feature which is inlcuded in the showcase section and every text within the same position and location as it does when using both the files combind eg using the app normally, the only differnce between each file (normal file and ui file) is that the ui file doesnt hold any functions, but the normal file page holds all of the files and just connects to the ui files features eg text box, button, all the features within the showcase etc. 



Use this as the working list for Presentation Mode/page access. Add/remove pages under each role, then number the pages in the order that role should see them.

Format to edit:
- Keep one route per line.
- Add `1.`, `2.`, `3.` when you want to lock the role's page order.
- Use `[jobNumber]`, `[accountId]`, etc. for dynamic pages.

## Accounts Manager

- /dashboard/accounts
- /accounts
- /accounts/create
- /accounts/edit/[accountId]
- /accounts/view/[accountId]
- /accounts/transactions/[accountId]
- /accounts/invoices
- /accounts/invoices/[invoiceId]
- /accounts/payslips
- /accounts/reports
- /accounts/settings
- /company-accounts
- /company-accounts/[accountNumber]
- /messages
- /newsfeed
- /profile

## Admin Manager

- /dashboard/admin
- /job-cards/waiting/nextjobs
- /job-cards/view
- /job-cards/[jobNumber]
- /admin/users
- /admin/profiles/[user]
- /accounts/payslips
- /hr/manager
- /messages
- /newsfeed
- /profile

## After Sales Director

- /dashboard/after-sales
- /dashboard
- /job-cards/view
- /job-cards/[jobNumber]
- /job-cards/waiting/nextjobs
- /parts/goods-in
- /messages
- /newsfeed
- /profile
- /tracking

## Customer

- /customer
- /customer/messages
- /customer/parts
- /customer/payments
- /customer/vehicles
- /customer/vhc
- /vhc/customer-preview/[jobNumber]
- /vhc/customer-view/[jobNumber]
- /vhc/share/[jobNumber]/[linkCode]

## General Manager

- /dashboard/managers
- /dashboard
- /job-cards/view
- /job-cards/[jobNumber]
- /job-cards/waiting/nextjobs
- /tracking
- /messages
- /newsfeed
- /profile

## HR Manager

- /hr
- /hr/manager
- /hr/attendance
- /hr/disciplinary
- /hr/employees
- /hr/leave
- /hr/payroll
- /hr/performance
- /hr/recruitment
- /hr/reports
- /hr/settings
- /hr/training
- /messages
- /newsfeed
- /profile

## Mobile Technician

- /mobile/dashboard
- /mobile/jobs
- /mobile/jobs/[jobNumber]
- /mobile/appointments
- /mobile/create
- /mobile/delivery/[jobNumber]
- /tech/consumables-request
- /messages
- /newsfeed
- /profile

## MOT Tester

- /dashboard/mot
- /job-cards/myjobs
- /job-cards/myjobs/[jobNumber]
- /job-cards/[jobNumber]
- /tech/efficiency
- /vhc
- /messages
- /newsfeed
- /profile

## Owner

- /dashboard/managers
- /hr/manager
- /admin/users
- /admin/profiles/[user]
- /accounts/payslips
- /messages
- /newsfeed
- /profile

## Painters

- /dashboard/painting
- /job-cards/myjobs
- /job-cards/myjobs/[jobNumber]
- /job-cards/[jobNumber]
- /messages
- /newsfeed
- /profile

## Parts Manager

- /dashboard/parts
- /parts
- /parts/manager
- /job-cards/view
- /job-cards/[jobNumber]
- /stock-catalogue
- /parts/create-order
- /parts/create-order/[orderNumber]
- /parts/deliveries
- /parts/deliveries/[deliveryId]
- /parts/delivery-planner
- /parts/goods-in
- /parts/goods-in/[goodsInNumber]
- /messages
- /newsfeed
- /profile

## Receptionist

- /dashboard
- /appointments
- /customers
- /customers/[customerSlug]
- /job-cards/create
- /job-cards/view
- /job-cards/[jobNumber]
- /messages
- /newsfeed
- /profile

## Sales Director

- /dashboard/managers
- /newsfeed
- /messages
- /profile

## Service Manager

- /dashboard/service
- /dashboard
- /customers
- /customers/[customerSlug]
- /job-cards/create
- /job-cards/waiting/nextjobs
- /job-cards/view
- /job-cards/[jobNumber]
- /parts/goods-in
- /mobile/appointments
- /mobile/create
- /messages
- /newsfeed
- /profile
- /tracking

## Techs

- /dashboard/workshop
- /tech/dashboard
- /job-cards/myjobs
- /job-cards/myjobs/[jobNumber]
- /job-cards/[jobNumber]
- /tech/consumables-request
- /tech/efficiency
- /vhc
- /messages
- /newsfeed
- /profile
- /tracking

## Valet Service

- /dashboard/valeting
- /valet
- /job-cards/valet/[jobnumber]
- /messages
- /newsfeed
- /profile

## Workshop Manager

- /dashboard/workshop
- /workshop/consumables-tracker
- /job-cards/waiting/nextjobs
- /job-cards/view
- /job-cards/[jobNumber]
- /clocking
- /clocking/[technicianSlug]
- /parts/goods-in
- /tracking
- /messages
- /newsfeed
- /profile


## Public / Signed Out

- /login
- /password-reset/reverted
- /unauthorized
