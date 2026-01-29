# VHC Parts Authorized Sync Checklist

1. Create a job with VHC required and add a VHC item.
2. Add a part linked to the VHC item in Parts Authorized and set authorised = true.
3. Verify Customer Requests shows the authorised item and Write-Up rectification includes it.
4. Change pre_pick_location on the authorised part and refresh the job card; confirm the pre-pick value updates.
5. Link a note to the VHC item and confirm the Customer Requests entry reflects the latest linked note text.
6. Set authorised = false for all parts linked to the VHC item.
7. Confirm the VHC item is declined, Customer Requests entry is removed, rectification row is removed, and notes are unlinked.
8. Add a second part row for the same VHC item, authorise only one, and confirm the VHC item stays authorised.
9. If a VHC display id is used, confirm alias mapping updates the correct canonical VHC item.
