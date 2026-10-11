import {fail} from './policy.js';
export function countDifference(expected,counted){
 if(!Number.isSafeInteger(expected)||expected<=0||!Number.isSafeInteger(counted)||counted<0||counted>=expected)fail('Enter a lower non-negative physical count; excess stock needs a reviewed source receipt');
 return expected-counted;
}
export function approveException(request,bundle,actor){
 if(!request||request.status!=='PENDING')fail('Pending exception required');
 if(request.requestedBy===actor)fail('A different administrator must review the exception');
 if(!bundle||bundle.qty!==request.expectedQty||bundle.stage!==request.stage||bundle.destination!==request.destination)fail('Bundle changed after counting; reject and recount');
 return countDifference(request.expectedQty,request.countedQty);
}
