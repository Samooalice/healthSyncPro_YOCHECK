#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""메시지 카탈로그 조각 병합기.

stdin 으로 받은 JSON 조각을 web/messages/<locale>.json 에 깊은 병합한다.
카탈로그를 통째로 다시 쓰지 않고 네임스페이스 단위로 키워 나가기 위한 도구다.

사용:
    cat frag.json | python merge_messages.py ko
    python merge_messages.py ko < frag.json

키 정렬은 하지 않는다(작성 순서 = 화면 순서가 읽기 편하다).
기존 값이 있으면 조각의 값으로 덮어쓴다.
"""
import io
import json
import os
import sys

# 콘솔 코드페이지가 cp949 여도 한글이 깨지지 않도록 출력 인코딩을 고정한다
# (npm run 등으로 호출될 때 PYTHONIOENCODING 이 없어도 안전).
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
MSG = os.path.join(ROOT, 'web', 'messages')


def deep_merge(base, frag):
    for k, v in frag.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v
    return base


def main():
    if len(sys.argv) < 2:
        print('usage: merge_messages.py <locale>', file=sys.stderr)
        sys.exit(2)
    locale = sys.argv[1]
    path = os.path.join(MSG, locale + '.json')

    raw = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8').read()
    frag = json.loads(raw)

    base = {}
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            txt = f.read().strip()
            if txt:
                base = json.loads(txt)

    deep_merge(base, frag)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(base, f, ensure_ascii=False, indent=2)
        f.write('\n')

    def count(d):
        return sum(count(v) if isinstance(v, dict) else 1 for v in d.values())

    print('%s: %d keys' % (os.path.relpath(path, ROOT), count(base)))


if __name__ == '__main__':
    main()
