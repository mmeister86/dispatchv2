from dispatch_provider_probe import *
import math

def safe_error(data):
    e=data.get('error',{})
    msg=(e.get('message','') if isinstance(e,dict) else str(e)) or data.get('title','') or data.get('detail','')
    for val in E.values():
        if len(val)>5:msg=msg.replace(val,'[REDACTED]')
    return str(msg)[:250]
def once(name):
    if OUT.exists() and name in json.loads(OUT.read_text())['checks']:
        print(name+': already recorded, no repeat');return False
    return True

def chat(kind,diagnostic=False,model_override=None,suffix=''):
    name='requesty_'+kind+('_diagnostic' if diagnostic else '')+('_comparison' if model_override else '')+suffix
    if not once(name):return
    model=model_override or E['REQUESTY_TEST_MODEL']
    catalog=json.loads(pathlib.Path('/tmp/dispatch-requesty-models.json').read_text())
    m=next(x for x in catalog if x['id']==model)
    prices=m.get('pricing',[])
    assert prices and max(p.get('output_price',99) for p in prices)<0.0001,'Price preflight'
    payload={'model':model,'max_tokens':512,'messages':[{'role':'user','content':'Reply with only the word READY.'}]}
    if kind=='schema':
        payload['messages']=[{'role':'user','content':'Return the synthetic test object with status ready and count 2.'}]
        payload['response_format']={'type':'json_schema','json_schema':{'name':'dispatch_probe','strict':True,'schema':{'type':'object','properties':{'status':{'type':'string','enum':['ready']},'count':{'type':'integer','enum':[2]}},'required':['status','count'],'additionalProperties':False}}}
    elif kind=='tool':
        payload['messages']=[{'role':'user','content':'Call the echo_probe tool with value ready. This is a synthetic test with no external actions.'}]
        payload['tools']=[{'type':'function','function':{'name':'echo_probe','description':'A harmless synthetic echo test.','parameters':{'type':'object','properties':{'value':{'type':'string','enum':['ready']}},'required':['value'],'additionalProperties':False}}}]
        payload['tool_choice']={'type':'function','function':{'name':'echo_probe'}}
    status,d=call('https://router.requesty.ai/v1/chat/completions',{'Authorization':'Bearer '+E['REQUESTY_API_KEY'],'Content-Type':'application/json'},payload)
    choices=d.get('choices',[]);message=choices[0].get('message',{}) if choices else {}
    content=message.get('content') or '';valid=False
    if kind=='text':valid=content.strip()=='READY'
    elif kind=='schema':
        try:valid=json.loads(content)=={'status':'ready','count':2}
        except:pass
    elif kind=='tool':
        tc=message.get('tool_calls',[])
        try:valid=len(tc)==1 and tc[0]['function']['name']=='echo_probe' and json.loads(tc[0]['function']['arguments'])=={'value':'ready'}
        except:pass
    usage={k:d.get('usage',{})[k] for k in ['prompt_tokens','completion_tokens','total_tokens','cost'] if k in d.get('usage',{})}
    persist(name,{**status,'model':model,'max_tokens':512,'synthetic_data_only':True,'validated_expected_result':valid,'finish_reason':choices[0].get('finish_reason') if choices else None,'usage':usage,'error':safe_error(d),'response_model':d.get('model'),'synthetic_response':{k:v for k,v in message.items() if k in ['content','role','tool_calls']} if diagnostic else None,'reasoning_content_present':bool(message.get('reasoning_content')),'raw_x_data_sent':False,'adapter':'direct HTTPS; AI SDK not tested'})

if __name__=='__main__':
    if sys.argv[1] in ['text','schema','tool']:chat(sys.argv[1])
    elif sys.argv[1]=='current-model':
        for kind in ['text','schema','tool']:chat(kind,True,suffix='_azure_luna')
    elif sys.argv[1]=='diagnostics':
        chat('schema',True)
        chat('tool',True)
    elif sys.argv[1]=='comparison':
        chat('schema',True,'openai/gpt-4.1-nano')
        chat('tool',True,'openai/gpt-4.1-nano')
    elif sys.argv[1]=='x-read':
        checks=[('x_user_lookup','https://api.x.com/2/users/by/username/XDevelopers',0.01),('x_recent_search','https://api.x.com/2/tweets/search/recent?query=from%3AXDevelopers&max_results=10',0.05),('x_trends','https://api.x.com/2/trends/by/woeid/1?max_trends=1',0.01)]
        for name,url,ceiling in checks:
            if not once(name):continue
            st,d=call(url,{'Authorization':'Bearer '+E['X_APP_BEARER_TOKEN']})
            data=d.get('data'); count=len(data) if isinstance(data,list) else 1 if isinstance(data,dict) else 0
            persist(name,{**st,'resource_count':count,'documented_max_estimate_usd':ceiling,'actual_billed_usd':None,'error':safe_error(d),'content_retained':False,'model_processing':False})
            if st['status'] in [401,402,403,429] or st['status'] is None:break
