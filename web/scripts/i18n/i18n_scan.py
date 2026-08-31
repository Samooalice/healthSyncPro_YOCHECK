#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""i18n 현황 스캐너 (Next.js/TypeScript 판).

참조: sdc_deploy/web/scripts/i18n/i18n_scan.py (Django/gettext 판)
이 프로젝트는 템플릿이 아니라 TSX/TS 이므로 집계 축을 다르게 잡는다.

  - 주석은 제외한다 (번역 대상 아님)
  - 남은 한글을 '구역'별로 분류한다:
      JSX  : JSX 텍스트 노드          -> 화면 문구, 최우선 번역 대상
      STR  : 코드 내 문자열 리터럴     -> 라벨/메시지 테이블, 번역 대상
  - '레이어'별로 분류한다:
      page   : src/app/**             (화면)
      comp   : src/components/**      (화면)
      action : **/actions.ts          (서버액션 - 사용자 메시지)
      api    : src/app/api/**         (응답/에러 메시지)
      lib    : src/lib/**, src/config/**

사용:
    python web/scripts/i18n/i18n_scan.py
    ... --leaks       파일별 상세(행번호)
    ... --strings     고유 문자열 목록 (빈도순)
    ... --fragments   3자 이하 파편 후보
"""
import json
import os
import re
import sys

# 콘솔 코드페이지가 cp949 여도 한글이 깨지지 않도록 출력 인코딩을 고정한다
# (npm run 등으로 호출될 때 PYTHONIOENCODING 이 없어도 안전).
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
SRC = os.path.join(ROOT, 'web', 'src')

KO = re.compile(r'[가-힣]')
LINE_COMMENT = re.compile(r'(?<![:\w])//[^\n]*')
BLOCK_COMMENT = re.compile(r'/\*.*?\*/', re.S)
SKIP_REGION = re.compile(r'//\s*i18n:skip-start\b.*?//\s*i18n:skip-end', re.S)

EXCLUDE_DIRS = ('generated',)

LAYERS = [
    ('api',    lambda p: p.startswith('app/api/')),
    ('action', lambda p: p.endswith('actions.ts')),
    ('page',   lambda p: p.startswith('app/')),
    ('comp',   lambda p: p.startswith('components/')),
    ('lib',    lambda p: p.startswith('lib/') or p.startswith('config/')),
]

STRING_LIT = re.compile(
    r'"(?:[^"\\\n]|\\.)*"'
    r"|'(?:[^'\\\n]|\\.)*'"
    r'|`(?:[^`\\]|\\.)*`', re.S)


def count_keys(d):
    return sum(count_keys(v) if isinstance(v, dict) else 1 for v in d.values())


def blank(m):
    """매치를 같은 행수의 공백으로 치환 - 행번호 보존."""
    return ''.join('\n' if c == '\n' else ' ' for c in m.group(0))


def layer_of(rel):
    for name, test in LAYERS:
        if test(rel):
            return name
    return 'etc'


def files():
    out = []
    for dirpath, dirnames, filenames in os.walk(SRC):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn.endswith(('.ts', '.tsx')):
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, SRC).replace(os.sep, '/')
                out.append((rel, full))
    return sorted(out)


def analyze(rel, full):
    raw = open(full, encoding='utf-8', errors='ignore').read()
    src = SKIP_REGION.sub(blank, raw)
    skipped = len(KO.findall(raw)) - len(KO.findall(src))
    src = BLOCK_COMMENT.sub(blank, src)
    src = LINE_COMMENT.sub(blank, src)

    ko_total = len(KO.findall(src))
    ko_comment = len(KO.findall(raw)) - ko_total - skipped

    canvas = list(src)
    strings = []
    for m in STRING_LIT.finditer(src):
        body = m.group(0)[1:-1]
        if KO.search(body):
            strings.append(body)
        for i in range(m.start(), m.end()):
            if canvas[i] != '\n':
                canvas[i] = ' '
    ko_str = sum(len(KO.findall(s)) for s in strings)
    rest = ''.join(canvas)
    ko_jsx = len(KO.findall(rest))

    leaks = []
    for i, line in enumerate(rest.splitlines(), 1):
        if KO.search(line):
            leaks.append((i, line.strip()))

    return dict(rel=rel, layer=layer_of(rel), ko_total=ko_total,
                ko_comment=ko_comment, ko_skip=skipped,
                ko_str=ko_str, ko_jsx=ko_jsx,
                strings=strings, leaks=leaks)


def main():
    args = set(sys.argv[1:])
    rows = [analyze(rel, full) for rel, full in files()]
    rows = [r for r in rows if r['ko_total'] or r['ko_comment']]

    if '--leaks' in args:
        for r in rows:
            if r['leaks']:
                print('\n-- ' + r['rel'])
                for ln, text in r['leaks']:
                    print('  %5d  %s' % (ln, text[:110]))
        return

    allstr = Counter()
    for r in rows:
        allstr.update(r['strings'])

    if '--strings' in args:
        for s, n in allstr.most_common():
            print('%4d  %s' % (n, s))
        print('\n고유 문자열 %d개 / 연 %d회' % (len(allstr), sum(allstr.values())))
        return

    if '--fragments' in args:
        for s, n in sorted(allstr.items(), key=lambda kv: len(kv[0])):
            if len(s.strip()) <= 3:
                print('%4d  %r' % (n, s))
        return

    print('=' * 78)
    print(' i18n 현황 스캔 - myhealtData_yochcek (web/src)')
    print('=' * 78)

    bylayer = defaultdict(lambda: dict(files=0, jsx=0, s=0, c=0, uniq=set()))
    for r in rows:
        b = bylayer[r['layer']]
        b['files'] += 1
        b['jsx'] += r['ko_jsx']
        b['s'] += r['ko_str']
        b['c'] += r['ko_comment']
        b['uniq'].update(r['strings'])

    print('\n[1] 레이어별 한글 분포 (문자수 기준)')
    print('%-8s%6s%11s%9s%11s%12s%11s' % (
        '레이어', '파일', 'JSX텍스트', '문자열', '번역대상', '주석(제외)', '고유문자열'))
    print('-' * 78)
    tj = ts = tc = 0
    for name in ['page', 'comp', 'action', 'api', 'lib', 'etc']:
        if name not in bylayer:
            continue
        b = bylayer[name]
        tj += b['jsx']
        ts += b['s']
        tc += b['c']
        print('%-8s%6d%11d%9d%11d%12d%11d' % (
            name, b['files'], b['jsx'], b['s'], b['jsx'] + b['s'],
            b['c'], len(b['uniq'])))
    print('-' * 78)
    print('%-8s%6d%11d%9d%11d%12d%11d' % (
        '합계', len(rows), tj, ts, tj + ts, tc, len(allstr)))

    print('\n[2] 번역 물량 요약')
    print('  - 번역 대상 한글     : %s자  (JSX %s + 문자열 %s)' % (
        format(tj + ts, ','), format(tj, ','), format(ts, ',')))
    print('  - 주석(번역 제외)    : %s자' % format(tc, ','))
    print('  - 고유 문자열 리터럴 : %s개' % format(len(allstr), ','))
    frag = [s for s in allstr if len(s.strip()) <= 3]
    print('  - 3자 이하 파편 후보 : %d개' % len(frag))

    print('\n[3] 상위 20개 파일 (번역 대상 문자수)')
    for r in sorted(rows, key=lambda r: -(r['ko_jsx'] + r['ko_str']))[:20]:
        print('  %6d  [%-6s] %s' % (r['ko_jsx'] + r['ko_str'], r['layer'], r['rel']))

    print('\n[4] i18n 인프라 점검')
    pkg = json.load(open(os.path.join(ROOT, 'web', 'package.json'),
                         encoding='utf-8'))
    deps = {}
    deps.update(pkg.get('dependencies', {}))
    deps.update(pkg.get('devDependencies', {}))
    for lib in ['next-intl', 'react-i18next', 'i18next', '@lingui/core',
                'next-i18next']:
        print('  %s %s' % ('OK  ' if lib in deps else 'NONE', lib))
    msg = os.path.join(ROOT, 'web', 'messages')
    print('  %s web/messages/ (번역 카탈로그)' % (
        'OK  ' if os.path.isdir(msg) else 'NONE'))
    for loc in ['ko', 'en', 'ja', 'vi', 'zh-Hans', 'zh-Hant']:
        f = os.path.join(msg, loc + '.json')
        if not os.path.exists(f):
            print('  NONE messages/%s.json' % loc)
            continue
        with open(f, encoding='utf-8') as fh:
            d = json.load(fh)
        n = count_keys(d)
        print('  %s messages/%s.json (%d keys)' % ('OK  ' if n else 'EMPTY', loc, n))
    # URL 전략: 쿠키 방식(상단 네비 언어 탭)이므로 로케일 라우팅 미들웨어는 두지 않는다.
    cfg = os.path.join(SRC, 'i18n', 'config.ts')
    print('  %s src/i18n/config.ts (쿠키 로케일 설정)' % (
        'OK  ' if os.path.exists(cfg) else 'NONE'))
    lay = open(os.path.join(SRC, 'app', 'layout.tsx'), encoding='utf-8').read()
    dynamic = 'HTML_LANG[locale]' in lay
    print('  %s <html lang> 동적 적용' % ('OK  ' if dynamic else 'HARD'))


if __name__ == '__main__':
    main()
