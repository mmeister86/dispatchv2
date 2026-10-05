import json, pathlib, urllib.request, urllib.error, urllib.parse, datetime, time, sys
ROOT=pathlib.Path('/Volumes/Speicher/Projekte/dispatch_v2')
E={}
for line in (ROOT/'.env.provider-check.local').read_text().splitlines():
    s=line.strip()
    if not s or s.startswith('#') or '=' not in s: continue
    k,v=s.split('=',1);v=v.strip()
    if len(v)>=2 and v[0]==v[-1] and v[0] in '\"\x27':v=v[1:-1]
    E[k.strip()]=v
OUT=ROOT/'.docs/reviews/evidence/task-1/access-checks-2026-09-18.json'
def call(url,headers=None,body=None):
    start=time.monotonic()
    req=urllib.request.Request(url,headers=headers or {},data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req,timeout=45) as r:
            raw=r.read(4_000_000); status=r.status
    except urllib.error.HTTPError as ex:
        status=ex.code; raw=ex.read(100000)
    except Exception as ex:return {'status':None,'error_type':type(ex).__name__},{}
    try: data=json.loads(raw)
    except: data={}
    return {'status':status,'duration_ms':round((time.monotonic()-start)*1000)},data

def persist(name,value):
    d=json.loads(OUT.read_text()) if OUT.exists() else {'date':'2026-09-18','paid_test_budget_eur':10,'checks':{}}
    d['checks'][name]=value
    OUT.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({name:value},ensure_ascii=False))

if __name__=='__main__':
    if sys.argv[1]=='requesty-catalog':
        key=E.get('REQUESTY_API_KEY','')
        assert key,'Missing key'
        selected=E.get('REQUESTY_TEST_MODEL','')
        status,data=call('https://router.requesty.ai/v1/models',{'Authorization':'Bearer '+key})
        models=data.get('data',[])
        chosen=[m for m in models if m.get('id')==selected]
        fields=['id','pricing','context_window','max_output_tokens','supports_tool_calling','supports_tool_use','supports_json_schema','supports_json_object','supports_json_output','supports_web_search','data_retention','data_retention_days','data_used_for_training']
        safe=[{k:m[k] for k in fields if k in m} for m in chosen]
        persist('requesty_catalog',{**status,'model_count':len(models),'selected_model_found':bool(chosen),'selected':safe})
        # Catalog metadata only; no keys or user content.
        cache=pathlib.Path('/tmp/dispatch-requesty-models.json');cache.write_text(json.dumps(models));cache.chmod(0o600)
    elif sys.argv[1]=='convex-reachability':
        res={}
        for name in ['CONVEX_URL','CONVEX_SITE_URL']:
            url=E.get(name,'').rstrip('/')
            parsed=urllib.parse.urlparse(url)
            if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith(('.convex.cloud','.convex.site')) or parsed.username or parsed.query:
                res[name]={'skipped':'missing_or_unexpected_url'};continue
            status,data=call(url)
            res[name]={**status,'authenticated':False,'scope':'origin-reachability-only'}
        persist('convex_reachability',res)
