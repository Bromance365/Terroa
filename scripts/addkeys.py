import json,sys
def merge(a,b):
    for k,v in b.items():
        if isinstance(v,dict): merge(a.setdefault(k,{}),v)
        else: a[k]=v
fr=json.loads(sys.argv[1]); en=json.loads(sys.argv[2])
for lang,add in (('fr-CA',fr),('en-CA',en)):
    p=f'messages/{lang}.json'
    d=json.load(open(p)); merge(d,add)
    json.dump(d,open(p,'w'),ensure_ascii=False,indent=2); open(p,'a').write('\n')
print('ok')
