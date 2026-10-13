/** Idempotent seeding never overwrites an owner's prices or licensed modules. */
export async function ensurePlanCatalogue(model,defaults){
 for(const plan of defaults){
  try{await model.updateOne({code:plan.code},{$setOnInsert:plan},{upsert:true});}
  catch(error){if(error.code!==11000||!await model.exists({code:plan.code}))throw error;}
 }
}
