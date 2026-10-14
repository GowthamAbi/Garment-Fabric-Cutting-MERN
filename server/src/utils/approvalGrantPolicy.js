export function includesApprovalGrant(values){
 return Array.isArray(values)&&values.some(value=>typeof value==="string"&&value.startsWith("approval."));
}

// Ordinary User Management edits must never silently revoke Owner-managed approval authority.
// The dedicated approval-grants endpoint is the only supported mutation path for these grants.
export function retainExistingApprovalGrants(editedPermissions,existingPermissions){
 if(!Array.isArray(editedPermissions)||!Array.isArray(existingPermissions))throw new TypeError("Permissions must be arrays");
 const retained=existingPermissions.filter(p=>typeof p==="string"&&p.startsWith("approval."));
 return [...new Set([...editedPermissions,...retained])];
}
