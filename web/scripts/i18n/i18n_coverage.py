#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""번역 카탈로그 커버리지 검사기.

기준어(ko) 카탈로그를 정본으로 두고 언어별로 다음을 점검한다.

  - 누락(missing)      : ko 에 있는데 해당 언어에 없는 키
  - 사장(orphan)       : 해당 언어에만 있고 ko 에 없는 키 (오타·이관 잔재)
  - 미번역(untranslated): ko 와 문자열이 완전히 같은 항목 (고유명사는 정상일 수 있음)
  - 플레이스홀더 불일치 : {name} 같은 치환자 집합이 ko 와 다른 항목  ← 런타임 버그 직결
  - ICU 인용 위험      : ' 바로 뒤에 { 가 오는 항목 (치환이 통째로 리터럴이 된다)

Phase 완료 판정(DoD)에 쓴다. 소스를 고치지 않는 읽기 전용 도구다.

사용:
    python web/scripts/i18n/i18n_coverage.py
    ... en            특정 언어만
    ... --list-missing  누락 키 전체 목록
"""
import io
import json
import os
import re
import sys

# 콘솔 코드페이지가 cp949 여도 한글이 깨지지 않도록 출력 인코딩을 고정한다
# (npm run 등으로 호출될 때 PYTHONIOENCODING 이 없어도 안전).
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
MSG = os.path.join(ROOT, 'web', 'messages')
BASE = 'ko'
LOCALES = ['en', 'ja', 'vi', 'zh-Hans', 'zh-Hant']

PLACEHOLDER = re.compile(r'\{(\w+)')
ICU_QUOTE_RISK = re.compile(r"'\{")
# 번역하지 않는 것이 정상인 키(고유명사·기호·코드 표기)
SAME_OK = {
    'common.dash', 'analyteValue.p1', 'analyteValue.p2', 'analyteValue.p3',
    'analyteValue.p4', 'phrMetric.egfr', 'phrMetric.bmi',
}


def flatten(d, prefix=''):
    out = {}
    for k, v in d.items():
        key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def load(locale):
    p = os.path.join(MSG, locale + '.json')
    if not os.path.exists(p):
        return None
    with io.open(p, encoding='utf-8') as f:
        txt = f.read().strip()
    return flatten(json.loads(txt) if txt else {})


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    targets = args or LOCALES

    base = load(BASE)
    if base is None:
        print('기준 카탈로그(%s.json)가 없습니다.' % BASE)
        sys.exit(1)

    print('=' * 74)
    print(' 번역 카탈로그 커버리지  (기준 %s: %d keys)' % (BASE, len(base)))
    print('=' * 74)
    print('%-10s%9s%9s%9s%9s%9s%8s' % (
        '언어', '보유', '누락', '사장', '미번역', '치환불일치', '커버리지'))
    print('-' * 74)

    problems = {}
    for loc in targets:
        cur = load(loc)
        if cur is None:
            print('%-10s%9s  (파일 없음)' % (loc, '-'))
            continue
        missing = [k for k in base if k not in cur or cur[k] in ('', None)]
        orphan = [k for k in cur if k not in base]
        same = [k for k in base
                if k in cur and cur[k] == base[k] and k not in SAME_OK]
        mismatch = []
        for k, v in base.items():
            if k not in cur or not isinstance(cur[k], str):
                continue
            if set(PLACEHOLDER.findall(v)) != set(PLACEHOLDER.findall(cur[k])):
                mismatch.append(k)
        done = len(base) - len(missing)
        print('%-10s%9d%9d%9d%9d%9d%7d%%' % (
            loc, len(cur), len(missing), len(orphan), len(same), len(mismatch),
            round(done * 100 / max(1, len(base)))))
        problems[loc] = dict(missing=missing, orphan=orphan, same=same,
                             mismatch=mismatch)

    # ICU 인용 위험은 언어와 무관하게 모든 카탈로그에서 본다.
    print('\n[ICU 인용 위험]  \' 바로 뒤 { 는 치환이 리터럴로 굳는다')
    risky = 0
    for loc in [BASE] + targets:
        cur = load(loc)
        if not cur:
            continue
        for k, v in cur.items():
            if isinstance(v, str) and ICU_QUOTE_RISK.search(v):
                print('  %s  %s' % (loc, k))
                risky += 1
    if not risky:
        print('  없음')

    for loc, p in problems.items():
        detail = p['missing'] if '--list-missing' in flags else p['missing'][:12]
        if p['missing']:
            print('\n[%s] 누락 %d개%s' % (
                loc, len(p['missing']),
                '' if '--list-missing' in flags else ' (앞 12개)'))
            for k in detail:
                print('  - %s   << %s' % (k, str(base[k])[:52]))
        if p['orphan']:
            print('\n[%s] 사장 %d개 (ko 에 없는 키)' % (loc, len(p['orphan'])))
            for k in p['orphan'][:12]:
                print('  - %s' % k)
        if p['mismatch']:
            print('\n[%s] 치환자 불일치 %d개  ← 런타임에서 값이 안 채워진다' % (
                loc, len(p['mismatch'])))
            for k in p['mismatch'][:12]:
                print('  - %s' % k)
                print('      ko: %s' % base[k])
                print('      %s: %s' % (loc, load(loc)[k]))


if __name__ == '__main__':
    main()
