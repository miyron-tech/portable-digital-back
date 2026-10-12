"""Сверка каталога portable с каталогом buydone: адреса, названия, тексты."""
import json, re, sys
from collections import Counter

portable_path, buydone_live_path, buydone_seed_path = sys.argv[1:4]
ours = json.load(open(portable_path))['services']
live = [json.loads(l) for l in open(buydone_live_path) if l.startswith('{')]
seed_src = open(buydone_seed_path, encoding='utf8').read()

def norm(t): return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', ' ', str(t).lower())).strip()

def texts(svc):
    out = {'slug': [svc.get('slug', '')], 'title': [svc.get('title', '')],
           'summary': [svc.get('summary', '')], 'description': [svc.get('description', '')],
           'features': list(svc.get('features') or []),
           'plan': [r.get('label', '') for r in svc.get('pricing', [])],
           'milestone': [m.get('title', '') for r in svc.get('pricing', []) for m in (r.get('milestones') or [])]}
    seo = svc.get('seo') or {}
    out['seo'] = [seo.get('metaTitle', ''), seo.get('metaDescription', '')]
    return out

theirs = {k: set() for k in ['slug','title','summary','description','features','plan','milestone','seo']}
for s in live:
    for k, v in texts(s).items(): theirs[k].update(norm(x) for x in v if x)
# Сид buydone: строковые литералы по ключам.
for key, field in [('slug','slug'),('title','title'),('summary','summary'),('description','description'),('label','plan'),('metaTitle','seo'),('metaDescription','seo')]:
    for m in re.finditer(rf"\b{key}:\s*\n?\s*'((?:[^'\\]|\\.)*)'", seed_src): theirs[field].add(norm(m.group(1)))
for m in re.finditer(r"\{ key: '[^']+', title: '((?:[^'\\]|\\.)*)'", seed_src): theirs['milestone'].add(norm(m.group(1)))
all_theirs = set().union(*theirs.values())

problems = []
for s in ours:
    for field, values in texts(s).items():
        for v in values:
            n = norm(v)
            if n and n in all_theirs:
                problems.append((s['slug'], field, v))
# Пересечение длинных фрагментов текста (8 слов подряд).
def shingles(t, k=8):
    w = norm(t).split(); return {' '.join(w[i:i+k]) for i in range(len(w)-k+1)}
their_sh = set()
for v in all_theirs: their_sh |= shingles(v)
for s in ours:
    for field in ['summary','description']:
        hit = shingles(s[field]) & their_sh
        if hit: problems.append((s['slug'], field+' (8-word overlap)', next(iter(hit))))

hourly = sum(1 for s in ours if any(r['model'] == 'hourly' for r in s['pricing']))
print(f"portable: {len(ours)} services, {hourly} with hourly pricing; buydone live: {len(live)}")
print('currencies:', Counter(s['currency'] for s in ours))
print('duplicate slugs inside portable:', [k for k, c in Counter(s['slug'] for s in ours).items() if c > 1])
print('duplicate titles inside portable:', [k for k, c in Counter(s['title'] for s in ours).items() if c > 1])
print(f'overlaps with buydone: {len(problems)}')
for p in problems: print('  ', p)
