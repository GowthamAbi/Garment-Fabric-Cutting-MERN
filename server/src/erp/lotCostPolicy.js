import {fail,safeInteger} from './policy.js';
export function allocateLotCost(amount,quantities,sent){
 if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(sent)||sent<=0||!quantities.length||quantities.some(q=>!Number.isSafeInteger(q)||q<=0)||quantities.reduce((n,q)=>n+q,0)!==sent)fail('Allocate lot costs before sales, loss or waste disposal; all originally sent pieces must be accounted for');
 let used=0;
 return quantities.map((q,i)=>{const value=i===quantities.length-1?amount-used:safeInteger(Number(BigInt(amount)*BigInt(q)/BigInt(sent)));used+=value;return value;});
}
