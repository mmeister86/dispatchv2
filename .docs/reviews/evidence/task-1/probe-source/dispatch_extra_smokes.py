from dispatch_provider_probe import *
from dispatch_paid_smokes import once, safe_error
import math

if sys.argv[1]=='embedding':
    name='requesty_embedding'
    if once(name):
        st,d=call('https://router.requesty.ai/v1/embeddings',{'Authorization':'Bearer '+E['REQUESTY_API_KEY'],'Content-Type':'application/json'},{'model':'openai/text-embedding-3-small','input':'Dispatch synthetic capability test.'})
        vs=d.get('data',[]);v=vs[0].get('embedding',[]) if vs else []
        persist(name,{**st,'model':'openai/text-embedding-3-small','dimensions':len(v),'finite_vector':bool(v) and all(isinstance(n,(int,float)) and math.isfinite(n) for n in v),'usage':d.get('usage',{}),'error':safe_error(d),'synthetic_data_only':True})
elif sys.argv[1]=='search':
    name='requesty_web_search'
    if once(name):
        body={'model':'anthropic/claude-haiku-4-5','max_tokens':512,'messages':[{'role':'user','content':'Use web search once to find the official Cloudflare R2 pricing page. Reply with one short sentence stating the Standard storage price per GB-month and cite the official page.'}],'tools':[{'type':'web_search_20250305','name':'web_search','max_uses':1,'allowed_domains':['developers.cloudflare.com']}]}
        st,d=call('https://router.requesty.ai/v1/messages',{'x-api-key':E['REQUESTY_API_KEY'],'anthropic-version':'2023-06-01','Content-Type':'application/json'},body)
        blocks=d.get('content',[]);citations=[];results=[];errors=[]
        for b in blocks:
            for c in b.get('citations',[]):
                citations.append({k:c[k] for k in ['type','url','title'] if k in c})
            if b.get('type')=='web_search_tool_result':
                content=b.get('content',[])
                if isinstance(content,list):
                    for item in content:
                        if item.get('type')=='web_search_result':results.append({k:item[k] for k in ['url','title'] if k in item})
                elif isinstance(content,dict):errors.append({k:content[k] for k in ['type','error_code'] if k in content})
        persist(name,{**st,'model':'anthropic/claude-haiku-4-5','max_tokens':512,'max_search_uses':1,'content_block_types':[b.get('type') for b in blocks],'citations':citations,'source_results':results,'tool_errors':errors,'stop_reason':d.get('stop_reason'),'usage':d.get('usage',{}),'error':safe_error(d),'synthetic_query_only':True,'raw_x_data_sent':False,'adapter':'direct Messages HTTPS; AI SDK not tested'})
