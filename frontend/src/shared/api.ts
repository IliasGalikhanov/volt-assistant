export class APIError extends Error {constructor(public code:string,message:string){super(message)}}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const headers=new Headers(options.headers);if(options.method&&options.method!=='GET')headers.set('X-Volt-Request','1');
 if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
 const response=await fetch('/api'+path,{...options,headers,credentials:'same-origin'});
 const body=await response.json();if(!response.ok)throw new APIError(body.code??'request_failed',body.message??'Request failed');return body as T;
}
export function post<T>(path:string,body:unknown){return api<T>(path,{method:'POST',body:JSON.stringify(body)})}
export function ds(dataset:string){return `dataset=${encodeURIComponent(dataset)}`}
