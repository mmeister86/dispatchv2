from dispatch_provider_probe import *
from dispatch_paid_smokes import once,safe_error
MODEL='vertex/gemini-3.5-flash-lite@eu'
BASE='https://router.eu.requesty.ai/v1'
CATALOG=json.loads(pathlib.Path('/tmp/dispatch-requesty-models.json').read_text())
meta=next(x for x in CATALOG if x.get('id')==MODEL)
assert meta.get('supports_web_search') is True
assert max(p.get('output_price',99) for p in meta.get('pricing',[]))<0.00001

def smoke(kind):
    name='requesty_vertex_eu_'+kind
    if not once(name):return
    body={'model':MODEL,'max_tokens':512,'messages':[{'role':'user','content':'Reply with only the word READY.'}]}
    if kind=='schema':
        body['messages']=[{'role':'user','content':'Return the synthetic test object with status ready and count 2.'}]
        body['response_format']={'type':'json_schema','json_schema':{'name':'dispatch_probe','strict':True,'schema':{'type':'object','properties':{'status':{'type':'string','enum':['ready']},'count':{'type':'integer','enum':[2]}},'required':['status','count'],'additionalProperties':False}}}
    elif kind=='tool':
        body['messages']=[{'role':'user','content':'Call echo_probe with value ready. This is a synthetic test without external effects.'}]
        body['tools']=[{'type':'function','function':{'name':'echo_probe','description':'Harmless synthetic echo test','parameters':{'type':'object','properties':{'value':{'type':'string','enum':['ready']}},'required':['value'],'additionalProperties':False}}}]
        body['tool_choice']={'type':'function','function':{'name':'echo_probe'}}
    st,d=call(BASE+'/chat/completions',{'Authorization':'Bearer '+E['REQUESTY_API_KEY'],'Content-Type':'application/json'},body)
    choices=d.get('choices',[]);msg=choices[0].get('message',{}) if choices else {};valid=False
    try:
        if kind=='text':valid=msg.get('content','').strip()=='READY'
        elif kind=='schema':valid=json.loads(msg.get('content',''))=={'status':'ready','count':2}
        else:
            ts=msg.get('tool_calls',[])
            valid=len(ts)==1 and ts[0]['function']['name']=='echo_probe' and json.loads(ts[0]['function']['arguments'])=={'value':'ready'}
    except (ValueError,KeyError,TypeError):pass
    usage={k:d.get('usage',{})[k] for k in ['prompt_tokens','completion_tokens','total_tokens','cost'] if k in d.get('usage',{})}
    persist(name,{**st,'model':MODEL,'base_url':BASE,'response_model':d.get('model'),'max_tokens':512,'synthetic_data_only':True,'validated_expected_result':valid,'finish_reason':choices[0].get('finish_reason') if choices else None,'usage':usage,'error':safe_error(d),'message_fields':[k for k in msg if k not in ['reasoning_content','reasoning_signature']],'adapter':'direct HTTPS; AI SDK not tested','request_fallback_configured':False})

if __name__=='__main__':
    if sys.argv[1]=='basic':
        for k in ['text','schema','tool']:smoke(k)
    elif sys.argv[1] in ['search','search_official_domain']:
        name='requesty_vertex_eu_'+sys.argv[1]
        if not once(name):sys.exit()
        body={'model':MODEL,'max_tokens':512,'stream':True,'stream_options':{'include_usage':True},'messages':[{'role':'user','content':'Use web search to find the official Cloudflare R2 pricing page. Give its Standard storage price in one sentence of at most 20 words with a source citation. This is a public documentation capability test.'}],'tools':[{'type':'web_search'}]}
        if sys.argv[1]=='search_official_domain':
            body['messages'][0]['content']='Use web search with query site:developers.cloudflare.com/r2/pricing/ Cloudflare R2 Standard storage price. Answer in at most 20 words with a citation from that official domain. This is a public documentation capability test.'
        result={'model':MODEL,'base_url':BASE,'max_tokens':512,'sources':[],'citation_urls':[],'usage':{},'chunk_count':0,'text_received':False,'stream_done':False,'public_documentation_query_only':True,'request_fallback_configured':False,'adapter':'direct streaming HTTPS; AI SDK not tested'}
        start=time.monotonic();text_parts=[]
        req=urllib.request.Request(BASE+'/chat/completions',headers={'Authorization':'Bearer '+E['REQUESTY_API_KEY'],'Content-Type':'application/json'},data=json.dumps(body).encode())
        try:
            with urllib.request.urlopen(req,timeout=45) as r:
                result['status']=r.status
                for line in r:
                    if not line.startswith(b'data:'):continue
                    raw=line[5:].strip()
                    if raw==b'[DONE]':result['stream_done']=True;break
                    try:d=json.loads(raw)
                    except:continue
                    result['chunk_count']+=1
                    if d.get('model'):result['response_model']=d['model']
                    if d.get('usage'):result['usage']={k:d['usage'][k] for k in ['prompt_tokens','completion_tokens','total_tokens','cost'] if k in d['usage']}
                    if d.get('error'):result['error']=safe_error(d)
                    for u in d.get('citations',[]):
                        if isinstance(u,str) and u.startswith('https://') and u not in result['citation_urls']:result['citation_urls'].append(u)
                    for c in d.get('choices',[]):
                        delta=c.get('delta',{})
                        if delta.get('content'):
                            result['text_received']=True;text_parts.append(delta['content'])
                        for src in delta.get('web_search',{}).get('content',[]):
                            if isinstance(src,dict):
                                safe={k:src[k] for k in ['title'] if k in src}
                                if src.get('url'):safe['url_host']=urllib.parse.urlparse(src['url']).hostname
                                if safe not in result['sources']:result['sources'].append(safe)
                        if c.get('finish_reason'):result['finish_reason']=c['finish_reason']
        except urllib.error.HTTPError as ex:
            result['status']=ex.code
            try:result['error']=safe_error(json.loads(ex.read(100000)))
            except:result['error']='non-json-error'
        except Exception as ex:result['error_type']=type(ex).__name__
        answer=''.join(text_parts)
        result['answer_contains_expected_price']='0.015' in answer
        result['answer_contains_source_marker']=any(x in answer for x in ['[1]','https://','[Source','[source'])
        result['duration_ms']=round((time.monotonic()-start)*1000)
        persist(name,result)
