"use strict";(()=>{var e={};e.id=645,e.ids=[645],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7722:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>g,patchFetch:()=>f,requestAsyncStorage:()=>d,routeModule:()=>m,serverHooks:()=>y,staticGenerationAsyncStorage:()=>h});var s={};r.r(s),r.d(s,{POST:()=>u,runtime:()=>p});var n=r(9303),o=r(8716),a=r(670),i=r(1664),c=r(2223);let p="nodejs",l=new i.ZP;async function u(e){try{let t=await e.json(),r=t.resumeText?.trim(),s=t.jobDescription?.trim();if(!r||!s)return new Response(JSON.stringify({error:"resumeText and jobDescription are required"}),{status:400,headers:{"Content-Type":"application/json"}});let n=await l.chat.completions.create({model:"gpt-4o",max_tokens:1024,response_format:{type:"json_object"},messages:[{role:"system",content:"You are an ATS analyzer. You return only valid JSON."},{role:"user",content:(0,c.m)(r,s)}]}),o=n.choices[0]?.message?.content??"",a=o.replace(/^```json\n?/,"").replace(/\n?```$/,"").trim(),i=JSON.parse(a);if(!(i&&"object"==typeof i&&"number"==typeof i.score&&Array.isArray(i.matched_keywords)&&Array.isArray(i.missing_keywords)&&Array.isArray(i.suggestions)))return new Response(JSON.stringify({error:"Invalid score response shape",raw:o}),{status:500,headers:{"Content-Type":"application/json"}});return new Response(JSON.stringify({score:i}),{headers:{"Content-Type":"application/json"}})}catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Unknown error"}),{status:500,headers:{"Content-Type":"application/json"}})}}let m=new n.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/score/route",pathname:"/api/score",filename:"route",bundlePath:"app/api/score/route"},resolvedPagePath:"/Users/gnyaniwork/Documents/ResumeForge/app/api/score/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:d,staticGenerationAsyncStorage:h,serverHooks:y}=m,g="/api/score/route";function f(){return(0,a.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:h})}},2223:(e,t,r)=>{r.d(t,{j:()=>s,m:()=>n});let s=(e,t)=>`
You are an expert resume writer and ATS optimization specialist.

You will receive a master resume as JSON and a job description.
Your task is to return a tailored version of the resume JSON that maximizes 
ATS match for this specific job.

RULES:
1. Only use content that exists in the master resume JSON. Do not invent new 
   experience, credentials, or skills that are not already present.
2. You MAY rewrite bullet text to mirror the job description language and keywords, 
   as long as the underlying fact remains true and accurate.
3. Select the most relevant bullets for each role. You do not need to include all 
   bullets — pick the ones most relevant to the JD. Include at least 2 bullets 
   per role.
4. Rewrite the summary to speak directly to this specific role. 3–4 sentences max.
5. Reorder the skills categories to put the most JD-relevant categories first. 
   Within each category, put the most relevant skills first.
6. Include a project only if it is relevant to the JD. It is acceptable to return 
   an empty projects array if nothing is relevant.
7. Keep all contact and education fields exactly as they are in the source JSON.
8. Return ONLY a valid JSON object matching the source schema exactly.
   No markdown fences, no explanation text, no comments. Raw JSON only.

MASTER RESUME JSON:
${e}

JOB DESCRIPTION:
${t}
`,n=(e,t)=>`
You are an ATS (Applicant Tracking System) analyzer.

Compare the resume text against the job description and return a JSON object 
with exactly this shape:
{
  "score": <number 0–100>,
  "matched_keywords": [<string>, ...],
  "missing_keywords": [<string>, ...],
  "suggestions": [<string>, ...]
}

- score: overall ATS match percentage as an integer
- matched_keywords: important keywords/phrases from the JD present in the resume
- missing_keywords: important keywords/phrases from the JD absent from the resume
- suggestions: exactly 3 specific actionable suggestions to improve the score

Return ONLY valid JSON. No markdown fences, no explanation. Raw JSON only.

RESUME TEXT:
${e}

JOB DESCRIPTION:
${t}
`}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[948,822],()=>r(7722));module.exports=s})();