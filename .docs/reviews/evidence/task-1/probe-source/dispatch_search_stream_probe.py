from dispatch_provider_probe import *
from dispatch_paid_smokes import once,safe_error
name='requesty_web_search_stream'
if once(name):
    body={'model':'perplexity/sonar','max_tokens':256,'stream':True,'stream_options':{'include_usage':True},'messages':[{'role':'user','content':'Search for the official Cloudflare R2 pricing page. Give the Standard storage price in one sentence with a source citation. Use official Cloudflare documentation.'}],'tools':[{'type':'web_search'}]}
    req=urllib.request.Request('https://router.requesty.ai/v1/chat/completions',headers={'Authorization':'Bearer '+E['REQUESTY_API_KEY'],'Content-Type':'application/json'},data=json.dumps(body).encode())
    result={'model':body['model'],'max_tokens':256,'adapter':'direct streaming Chat Completions HTTPS; AI SDK not tested','sources':[],'citation_urls':[],'usage':{},'chunk_count':0,'text_received':False,'synthetic_query_only':True}
    start=time.monotonic()
    try:
        with urllib.request.urlopen(req,timeout=45) as r:
            result['status']=r.status
            for line in r:
                if not line.startswith(b'data:'):continue
                payload=line[5:].strip()
                if payload==b'[DONE]':break
                try:d=json.loads(payload)
                except:continue
                result['chunk_count']+=1
                if d.get('usage'):result['usage']=d['usage']
                for u in d.get('citations',[]):
                    if isinstance(u,str) and u.startswith('https://') and u not in result['citation_urls']:result['citation_urls'].append(u)
                for choice in d.get('choices',[]):
                    delta=choice.get('delta',{})
                    if delta.get('content'):result['text_received']=True
                    for source in delta.get('web_search',{}).get('content',[]):
                        if isinstance(source,dict):
                            safe={k:source[k] for k in ['url','title'] if k in source}
                            if safe not in result['sources']:result['sources'].append(safe)
                    if choice.get('finish_reason'):result['finish_reason']=choice['finish_reason']
    except urllib.error.HTTPError as ex:
        result['status']=ex.code
        try:result['error']=safe_error(json.loads(ex.read(100000)))
        except:result['error']='non-json-error'
    except Exception as ex:result['error_type']=type(ex).__name__
    result['duration_ms']=round((time.monotonic()-start)*1000)
    persist(name,result)
